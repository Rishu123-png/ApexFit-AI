import { DEFAULT_PREFERENCES, type NutritionEntry, type Preferences, type UserProfile, type WorkoutSession } from '@/lib/types';

/**
 * Data schema version used for records stored in Firebase and local recovery.
 * Reads accept prior versions and normalize them in memory, so a deployment
 * never locks existing members out while their data is being upgraded.
 */
export const CURRENT_DATA_SCHEMA_VERSION = 1;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null ? value as UnknownRecord : {};
}

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function withDataVersion<T extends object>(value: T): T & { schemaVersion: number } {
  return { ...value, schemaVersion: CURRENT_DATA_SCHEMA_VERSION };
}

/** Legacy nutrition rows used `verified`; it now maps to the clearer `reference` label. */
export function migrateNutritionEntry(id: string, value: unknown): NutritionEntry {
  const raw = record(value);
  const source = raw.source === 'verified' ? 'reference' : raw.source;
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : 'Unnamed food',
    portionLabel: typeof raw.portionLabel === 'string' ? raw.portionLabel : 'portion not specified',
    meal: raw.meal === 'lunch' || raw.meal === 'snacks' || raw.meal === 'dinner' ? raw.meal : 'breakfast',
    servings: finite(raw.servings, 1),
    calories: finite(raw.calories, 0),
    protein: finite(raw.protein, 0),
    carbs: finite(raw.carbs, 0),
    fat: finite(raw.fat, 0),
    source: source === 'reference' || source === 'estimate' || source === 'custom' ? source : 'custom',
    loggedAt: finite(raw.loggedAt, Date.now()),
    schemaVersion: finite(raw.schemaVersion, 0),
  };
}

export function migratePreferences(value: unknown): Preferences {
  const raw = record(value);
  return {
    calorieTarget: finite(raw.calorieTarget, DEFAULT_PREFERENCES.calorieTarget),
    proteinTarget: finite(raw.proteinTarget, DEFAULT_PREFERENCES.proteinTarget),
    waterTargetMl: finite(raw.waterTargetMl, DEFAULT_PREFERENCES.waterTargetMl),
    dietaryPreference: raw.dietaryPreference === 'veg' || raw.dietaryPreference === 'non-veg' || raw.dietaryPreference === 'eggetarian' || raw.dietaryPreference === 'vegan'
      ? raw.dietaryPreference
      : DEFAULT_PREFERENCES.dietaryPreference,
    schemaVersion: finite(raw.schemaVersion, 0),
  };
}

export function migrateProfile(value: unknown): UserProfile | null {
  const raw = record(value);
  if (typeof raw.displayName !== 'string' || typeof raw.email !== 'string') return null;
  return {
    ...raw,
    displayName: raw.displayName,
    email: raw.email,
    createdAt: finite(raw.createdAt, 0),
    schemaVersion: finite(raw.schemaVersion, 0),
  };
}

export function migrateWorkoutSession(id: string, value: unknown): WorkoutSession | null {
  const raw = record(value);
  if (typeof raw.planId !== 'string' || typeof raw.planName !== 'string') return null;
  const status = raw.status === 'completed' ? 'completed' : 'partial';
  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises
        .filter((item): item is UnknownRecord => typeof item === 'object' && item !== null)
        .map((item) => ({
          exerciseId: typeof item.exerciseId === 'string' ? item.exerciseId : '',
          name: typeof item.name === 'string' ? item.name : 'Exercise',
          targetSets: finite(item.targetSets, 0),
          completedSets: finite(item.completedSets, 0),
        }))
    : [];
  return {
    ...raw,
    id,
    planId: raw.planId,
    planName: raw.planName,
    status,
    startedAt: finite(raw.startedAt, 0),
    endedAt: finite(raw.endedAt, 0),
    durationSec: finite(raw.durationSec, 0),
    totalSets: finite(raw.totalSets, 0),
    exercises,
    schemaVersion: finite(raw.schemaVersion, 0),
  };
}
