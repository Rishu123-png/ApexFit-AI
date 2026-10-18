
import {
  ref,
  get,
  set,
  push,
  remove,
  update,
  onValue,
  query,
  orderByChild,
  startAt,
  limitToLast,
  runTransaction,
  type Unsubscribe,
} from 'firebase/database';
import { getFirebase } from '@/lib/firebase/client';
import type {
  NutritionEntry,
  Preferences,
  UserProfile,
  WorkoutSession,
  BodyMetric,
  SavedRecipe,
} from '@/lib/types';
import { DEFAULT_PREFERENCES } from '@/lib/types';
import { daysAgoTs } from '@/lib/dates';
import {
  migrateNutritionEntry,
  migratePreferences,
  migrateProfile,
  migrateWorkoutSession,
  withDataVersion,
  CURRENT_DATA_SCHEMA_VERSION,
} from '@/lib/data/schema';

function db() {
  const fb = getFirebase();
  if (!fb) throw new Error('Firebase is not configured.');
  return fb.db;
}

const userRef = (uid: string, path: string) => ref(db(), `users/${uid}/${path}`);
type SubscriptionError = (error: Error) => void;

// ── Profile & preferences ────────────────────────────────────────────────────

export async function createProfile(
  uid: string,
  profile: Omit<UserProfile, 'createdAt'>,
): Promise<void> {
  const root = ref(db());
  await update(root, {
    [`users/${uid}/profile`]: withDataVersion({ ...profile, createdAt: Date.now() }),
    [`users/${uid}/preferences`]: withDataVersion(DEFAULT_PREFERENCES),
  });
}

/** Create only missing records after a provider sign-in; never overwrite user edits. */
export async function ensureProfile(
  uid: string,
  profile: Omit<UserProfile, 'createdAt'>,
): Promise<void> {
  const [profileSnap, prefsSnap] = await Promise.all([
    get(userRef(uid, 'profile')),
    get(userRef(uid, 'preferences')),
  ]);
  const writes: Promise<void>[] = [];
  if (!profileSnap.exists()) writes.push(set(userRef(uid, 'profile'), withDataVersion({ ...profile, createdAt: Date.now() })));
  if (!prefsSnap.exists()) writes.push(set(userRef(uid, 'preferences'), withDataVersion(DEFAULT_PREFERENCES)));
  await Promise.all(writes);
}

export function subscribeProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  return onValue(userRef(uid, 'profile'), (s) => cb(s.exists() ? migrateProfile(s.val()) : null), onError);
}

export function subscribePreferences(
  uid: string,
  cb: (prefs: Preferences) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  return onValue(userRef(uid, 'preferences'), (s) =>
    cb(s.exists() ? migratePreferences(s.val()) : DEFAULT_PREFERENCES),
    onError,
  );
}

export async function savePreferences(uid: string, prefs: Preferences): Promise<void> {
  await set(userRef(uid, 'preferences'), withDataVersion(prefs));
}

export function updateProfileFields(
  uid: string,
  fields: Partial<UserProfile>,
): Promise<void> {
  return update(userRef(uid, 'profile'), { ...fields, schemaVersion: CURRENT_DATA_SCHEMA_VERSION });
}

/** Store a self-reported check-in only. Camera frames/photos are never written. */
export async function saveBodyMetric(uid: string, metric: Omit<BodyMetric, 'recordedAt'>): Promise<void> {
  const recordedAt = Date.now();
  await set(userRef(uid, `bodyMetrics/${recordedAt}`), { ...metric, recordedAt } satisfies BodyMetric);
}

export function subscribeBodyMetrics(
  uid: string,
  cb: (metrics: BodyMetric[]) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  const q = query(userRef(uid, 'bodyMetrics'), orderByChild('recordedAt'), limitToLast(60));
  return onValue(q, (snapshot) => {
    if (!snapshot.exists()) return cb([]);
    cb(
      Object.values(snapshot.val() as Record<string, BodyMetric>)
        .filter((value) => Number.isFinite(value.weightKg) && Number.isFinite(value.heightCm) && Number.isFinite(value.recordedAt))
        .sort((a, b) => a.recordedAt - b.recordedAt),
    );
  }, onError);
}

// ── Nutrition ────────────────────────────────────────────────────────────────

export function subscribeNutritionDay(
  uid: string,
  dayKey: string,
  cb: (entries: NutritionEntry[]) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  return onValue(userRef(uid, `nutrition/${dayKey}`), (s) => {
    if (!s.exists()) return cb([]);
    const val = s.val() as Record<string, unknown>;
    cb(
      Object.entries(val)
        .map(([id, entry]) => migrateNutritionEntry(id, entry))
        .sort((a, b) => a.loggedAt - b.loggedAt),
    );
  }, onError);
}

export async function addNutritionEntry(
  uid: string,
  dayKey: string,
  entry: Omit<NutritionEntry, 'id'>,
): Promise<string> {
  const node = push(userRef(uid, `nutrition/${dayKey}`));
  await set(node, withDataVersion(entry));
  return node.key as string;
}

/** Atomically add a group of nutrition entries (e.g. one food-scan result). */
export async function addNutritionEntries(
  uid: string,
  dayKey: string,
  entries: Omit<NutritionEntry, 'id'>[],
): Promise<string[]> {
  const dayRef = userRef(uid, `nutrition/${dayKey}`);
  const batch: Record<string, Omit<NutritionEntry, 'id'>> = {};
  const ids: string[] = [];
  for (const entry of entries) {
    const node = push(dayRef);
    const id = node.key;
    if (!id) throw new Error('Could not allocate a nutrition entry ID.');
    ids.push(id);
    batch[id] = withDataVersion(entry);
  }
  if (ids.length > 0) await update(dayRef, batch);
  return ids;
}

export async function updateNutritionEntry(
  uid: string,
  dayKey: string,
  entryId: string,
  entry: Omit<NutritionEntry, 'id'>,
): Promise<void> {
  await set(userRef(uid, `nutrition/${dayKey}/${entryId}`), withDataVersion(entry));
}

export async function deleteNutritionEntry(
  uid: string,
  dayKey: string,
  entryId: string,
): Promise<void> {
  await remove(userRef(uid, `nutrition/${dayKey}/${entryId}`));
}

// ── Saved recipes / reusable meals ───────────────────────────────────────────

export type SavedRecipeDraft = Omit<SavedRecipe, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>;

function migrateRecipe(id: string, value: unknown): SavedRecipe | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== 'string' || raw.name.length === 0) return null;
  const defaultMeal = raw.defaultMeal === 'lunch' || raw.defaultMeal === 'snacks' || raw.defaultMeal === 'dinner'
    ? raw.defaultMeal
    : 'breakfast';
  const number = (key: string) => typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? raw[key] as number : 0;
  return {
    id,
    schemaVersion: number('schemaVersion'),
    name: raw.name,
    portionLabel: typeof raw.portionLabel === 'string' ? raw.portionLabel : '1 serving',
    defaultMeal,
    calories: number('calories'),
    protein: number('protein'),
    carbs: number('carbs'),
    fat: number('fat'),
    createdAt: number('createdAt'),
    updatedAt: number('updatedAt'),
  };
}

export function subscribeSavedRecipes(
  uid: string,
  cb: (recipes: SavedRecipe[]) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  return onValue(userRef(uid, 'recipes'), (snapshot) => {
    if (!snapshot.exists()) return cb([]);
    const recipes = Object.entries(snapshot.val() as Record<string, unknown>)
      .map(([id, recipe]) => migrateRecipe(id, recipe))
      .filter((recipe): recipe is SavedRecipe => recipe !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    cb(recipes);
  }, onError);
}

export async function saveRecipe(uid: string, recipe: SavedRecipeDraft): Promise<string> {
  const node = push(userRef(uid, 'recipes'));
  const now = Date.now();
  await set(node, withDataVersion({ ...recipe, createdAt: now, updatedAt: now }));
  return node.key as string;
}

export async function deleteRecipe(uid: string, recipeId: string): Promise<void> {
  await remove(userRef(uid, `recipes/${recipeId}`));
}

/** Atomically log a food and save it as a reusable recipe when requested. */
export async function addNutritionEntryWithRecipe(
  uid: string,
  dayKey: string,
  entry: Omit<NutritionEntry, 'id'>,
  recipe: SavedRecipeDraft,
): Promise<{ entryId: string; recipeId: string }> {
  const entryNode = push(userRef(uid, `nutrition/${dayKey}`));
  const recipeNode = push(userRef(uid, 'recipes'));
  if (!entryNode.key || !recipeNode.key) throw new Error('Could not allocate entry IDs.');
  const now = Date.now();
  await update(ref(db()), {
    [`users/${uid}/nutrition/${dayKey}/${entryNode.key}`]: withDataVersion(entry),
    [`users/${uid}/recipes/${recipeNode.key}`]: withDataVersion({ ...recipe, createdAt: now, updatedAt: now }),
  });
  return { entryId: entryNode.key, recipeId: recipeNode.key };
}

// ── Hydration ────────────────────────────────────────────────────────────────

export function subscribeHydration(
  uid: string,
  dayKey: string,
  cb: (totalMl: number) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  return onValue(userRef(uid, `hydration/${dayKey}`), (s) => {
    if (!s.exists()) return cb(0);
    cb((s.val() as { totalMl?: number }).totalMl ?? 0);
  }, onError);
}

export async function logWater(uid: string, dayKey: string, ml: number): Promise<void> {
  await runTransaction(userRef(uid, `hydration/${dayKey}/totalMl`), (cur) => {
    const next = (typeof cur === 'number' ? cur : 0) + ml;
    return Math.max(0, next);
  });
  if (ml > 0) {
    await set(push(userRef(uid, `hydration/${dayKey}/logs`)), { ml, ts: Date.now() });
  }
}

// ── Workouts ─────────────────────────────────────────────────────────────────

export async function saveWorkoutSession(
  uid: string,
  session: Omit<WorkoutSession, 'id'>,
  sessionId?: string,
): Promise<string> {
  // A server-started session provides a preallocated ID. Falling back to push
  // preserves private self-reported logging when the verification service is
  // unavailable; only the preallocated path can later earn Arena XP.
  const node = sessionId
    ? userRef(uid, `workouts/${sessionId}`)
    : push(userRef(uid, 'workouts'));
  await set(node, withDataVersion(session));
  return node.key as string;
}

/** Recent sessions (any age). */
export function subscribeRecentWorkouts(
  uid: string,
  count: number,
  cb: (sessions: WorkoutSession[]) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  const q = query(userRef(uid, 'workouts'), orderByChild('startedAt'), limitToLast(count));
  return onValue(q, (s) => {
    if (!s.exists()) return cb([]);
    const val = s.val() as Record<string, unknown>;
    cb(
      Object.entries(val)
        .map(([id, workout]) => migrateWorkoutSession(id, workout))
        .filter((workout): workout is WorkoutSession => workout !== null)
        .sort((a, b) => b.startedAt - a.startedAt),
    );
  }, onError);
}

/** Sessions from the last 7 local days (for weekly activity). */
export function subscribeWeekWorkouts(
  uid: string,
  cb: (sessions: WorkoutSession[]) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  const q = query(userRef(uid, 'workouts'), orderByChild('startedAt'), startAt(daysAgoTs(6)));
  return onValue(q, (s) => {
    if (!s.exists()) return cb([]);
    const val = s.val() as Record<string, unknown>;
    cb(
      Object.entries(val)
        .map(([id, workout]) => migrateWorkoutSession(id, workout))
        .filter((workout): workout is WorkoutSession => workout !== null),
    );
  }, onError);
}

// ── One-shot reads (rare; subscriptions preferred) ───────────────────────────

export async function getPreferencesOnce(uid: string): Promise<Preferences> {
  const s = await get(userRef(uid, 'preferences'));
  return s.exists() ? migratePreferences(s.val()) : DEFAULT_PREFERENCES;
}

// ── Recovery check-ins (readiness factors; user-owned, private) ──────────────

export interface RecoveryCheckinRecord {
  sleepHrs?: number;
  energy?: number; // 1–5
  soreness?: number; // 1–5
  createdAt: number;
}

export async function saveCheckin(uid: string, dayKey: string, checkin: Omit<RecoveryCheckinRecord, 'createdAt'>): Promise<void> {
  // A user may update only one check-in field later. Merge it instead of
  // replacing the whole day and silently deleting sleep/energy/soreness data.
  await update(userRef(uid, `checkins/${dayKey}`), { ...checkin, createdAt: Date.now() });
}

export function subscribeCheckins(
  uid: string,
  days: number,
  cb: (items: Record<string, RecoveryCheckinRecord>) => void,
  onError?: SubscriptionError,
): Unsubscribe {
  const q = query(userRef(uid, 'checkins'), limitToLast(days));
  return onValue(q, (s) => cb(s.exists() ? (s.val() as Record<string, RecoveryCheckinRecord>) : {}), onError);
}
