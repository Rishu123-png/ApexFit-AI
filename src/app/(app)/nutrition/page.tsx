'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { FOODS, FOOD_CATEGORIES } from '@/lib/data/foods';
import {
  addNutritionEntry,
  updateNutritionEntry,
  deleteNutritionEntry,
  subscribeNutritionDay,
  subscribeHydration,
  subscribePreferences,
  savePreferences,
  logWater,
} from '@/lib/db';
import { dateKey } from '@/lib/dates';
import { claimArena } from '@/lib/arena/client';
import { safeCalorieTarget, safeProteinTarget, safeWaterTarget } from '@/lib/health/targets';
import {
  DEFAULT_PREFERENCES,
  type DietaryPreference,
  type FoodItem,
  type MealType,
  type NutritionEntry,
  type Preferences,
} from '@/lib/types';
import { GlassCard, SectionTitle, Badge, Button, Field, Alert, EmptyState } from '@/components/ui';
import { MacroBar, ProgressRing } from '@/components/charts';
import { IconPlus, IconX, IconTrash, IconEdit, IconCheck, IconBowl, IconDroplet, IconShield, IconInfo } from '@/components/icons';
import { clsx } from '@/lib/clsx';

const MEALS: { id: MealType; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'dinner', label: 'Dinner' },
];

function NutritionInner() {
  const { user, getIdToken } = useAuth();
  const uid = user!.uid;
  const today = dateKey();
  const params = useSearchParams();

  const [entries, setEntries] = useState<NutritionEntry[] | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [waterMl, setWaterMl] = useState(0);

  // Add/Edit form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [meal, setMeal] = useState<MealType>('breakfast');
  const [servings, setServings] = useState('1');
  const [cName, setCName] = useState('');
  const [cCals, setCCals] = useState('');
  const [cProtein, setCProtein] = useState('');
  const [cCarbs, setCCarbs] = useState('');
  const [cFat, setCFat] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Preferences form
  const [prefDraft, setPrefDraft] = useState<string>('');
  const [prefSaved, setPrefSaved] = useState(false);
  const [waterBusy, setWaterBusy] = useState(false);

  useEffect(() => subscribeNutritionDay(uid, today, setEntries), [uid, today]);
  useEffect(() => subscribePreferences(uid, setPrefs), [uid]);
  useEffect(() => subscribeHydration(uid, today, setWaterMl), [uid, today]);

  useEffect(() => {
    if (params.get('add') === '1') openForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const list = entries ?? [];
    return {
      calories: list.reduce((s, e) => s + e.calories * e.servings, 0),
      protein: list.reduce((s, e) => s + e.protein * e.servings, 0),
      carbs: list.reduce((s, e) => s + e.carbs * e.servings, 0),
      fat: list.reduce((s, e) => s + e.fat * e.servings, 0),
    };
  }, [entries]);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return FOODS;
    return FOODS.filter((f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q));
  }, [search]);

  function openForm(entry?: NutritionEntry) {
    setFormOpen(true);
    setFormError('');
    if (entry) {
      setEditingId(entry.id);
      setMeal(entry.meal);
      setServings(String(entry.servings));
      const food = FOODS.find((f) => f.name === entry.name);
      setSelectedFood(food ?? null);
      setCustomMode(!food);
      setCName(entry.name);
      setCCals(String(entry.calories));
      setCProtein(String(entry.protein));
      setCCarbs(String(entry.carbs));
      setCFat(String(entry.fat));
    } else {
      setEditingId(null);
      setSelectedFood(null);
      setCustomMode(false);
      setServings('1');
      setCName('');
      setCCals('');
      setCProtein('');
      setCCarbs('');
      setCFat('');
    }
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setSearch('');
    setFormError('');
  }

  async function saveEntry() {
    const qty = Number(servings);
    if (!(qty > 0 && qty <= 20)) {
      setFormError('Servings must be between 0.25 and 20.');
      return;
    }
    let payload: Omit<NutritionEntry, 'id'>;
    if (customMode) {
      const nums = [cCals, cProtein, cCarbs, cFat].map(Number);
      if (!cName.trim() || cName.trim().length > 120) return setFormError('Enter a food name (max 120 chars).');
      if (nums.some((n) => !Number.isFinite(n) || n < 0)) return setFormError('Nutrition values must be valid non-negative numbers.');
      if (nums[0] > 3000 || nums.some((n) => n > 600)) return setFormError('One or more values are implausibly high for a single portion.');
      payload = {
        name: cName.trim(),
        portionLabel: 'custom portion',
        meal,
        servings: qty,
        calories: nums[0],
        protein: nums[1],
        carbs: nums[2],
        fat: nums[3],
        source: 'custom',
        loggedAt: Date.now(),
      };
    } else {
      if (!selectedFood) return setFormError('Pick a food from the list, or switch to custom entry.');
      payload = {
        name: selectedFood.name,
        portionLabel: selectedFood.portionLabel,
        meal,
        servings: qty,
        calories: selectedFood.calories,
        protein: selectedFood.protein,
        carbs: selectedFood.carbs,
        fat: selectedFood.fat,
        source: selectedFood.source,
        loggedAt: Date.now(),
      };
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) await updateNutritionEntry(uid, today, editingId, payload);
      else await addNutritionEntry(uid, today, payload);
      closeForm();
      void claimArenaXP();
    } catch {
      setFormError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  /** Best-effort Arena claims — the server re-validates eligibility, caps and
   *  idempotency. Silent for non-participants. */
  async function claimArenaXP() {
    try {
      const token = await getIdToken();
      await claimArena(token, 'nutrition_milestone').catch(() => undefined);
      await claimArena(token, 'daily_mission').catch(() => undefined);
    } catch {
      /* Arena unavailable — logging already succeeded */
    }
  }

  async function removeEntry(id: string) {
    try {
      await deleteNutritionEntry(uid, today, id);
    } catch {
      setFormError('Couldn’t delete that entry.');
    }
  }

  async function quickWater(ml: number) {
    setWaterBusy(true);
    try {
      await logWater(uid, today, ml);
    } finally {
      setWaterBusy(false);
    }
  }

  const [prefForm, setPrefForm] = useState<{ cal: string; protein: string; water: string; diet: DietaryPreference } | null>(null);
  useEffect(() => {
    setPrefForm({
      cal: String(prefs.calorieTarget),
      protein: String(prefs.proteinTarget),
      water: String(prefs.waterTargetMl),
      diet: prefs.dietaryPreference ?? 'non-veg',
    });
  }, [prefs]);

  async function savePrefs() {
    if (!prefForm) return;
    // Health-safe policy (§14): dangerous targets are REJECTED with guidance,
    // never silently clamped into something the user didn't intend.
    const cal = safeCalorieTarget(Number(prefForm.cal));
    if (!cal.ok) return setPrefDraft(cal.reason!);
    const protein = safeProteinTarget(Number(prefForm.protein));
    if (!protein.ok) return setPrefDraft(protein.reason!);
    const water = safeWaterTarget(Number(prefForm.water));
    if (!water.ok) return setPrefDraft(water.reason!);

    setPrefDraft('');
    await savePreferences(uid, {
      calorieTarget: cal.value!,
      proteinTarget: protein.value!,
      waterTargetMl: water.value!,
      dietaryPreference: prefForm.diet,
    });
    setPrefSaved(true);
    setTimeout(() => setPrefSaved(false), 2500);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Nutrition <span className="neon-text">tracker</span></h1>
          <p className="mt-1 text-sm text-slate-400">Log meals against your daily targets. Food-DB, custom and AI-estimated values are always labelled — estimates stay editable.</p>
        </div>
        <Button glow onClick={() => (formOpen ? closeForm() : openForm())}>
          {formOpen ? <><IconX width={15} /> Close</> : <><IconPlus width={15} /> Add food</>}
        </Button>
      </div>

      {/* Daily totals */}
      <GlassCard>
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing size={104} percent={totals.calories / prefs.calorieTarget} label={`${Math.round(totals.calories)}`} sublabel={`/ ${prefs.calorieTarget} kcal`} />
          <div className="min-w-[220px] flex-1 space-y-3">
            <MacroBar label="Protein" value={totals.protein} target={prefs.proteinTarget} unit="g" tone="#34d399" />
            <MacroBar label="Carbs" value={totals.carbs} target={Math.round(prefs.calorieTarget * 0.5 / 4)} unit="g" tone="#fbbf24" />
            <MacroBar label="Fat" value={totals.fat} target={Math.round(prefs.calorieTarget * 0.3 / 9)} unit="g" tone="#fb7185" />
          </div>
          {/* Hydration quick card */}
          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:w-auto sm:min-w-[190px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400"><IconDroplet width={14} className="text-electric-300" /> Water</span>
              <span className="text-xs text-slate-400">{waterMl} / {prefs.waterTargetMl} ml</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {[250, 500].map((ml) => (
                <Button key={ml} variant="outline" className="flex-1 px-2 py-1.5 text-xs" onClick={() => quickWater(ml)} loading={waterBusy}>
                  +{ml}
                </Button>
              ))}
              <Button variant="ghost" className="px-2 py-1.5 text-xs" onClick={() => quickWater(-250)} disabled={waterBusy || waterMl <= 0} aria-label="Undo 250 ml">
                −250
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Add / edit form */}
      {formOpen && (
        <GlassCard className="rise-in space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{editingId ? 'Edit entry' : 'Add food'}</h2>
            <div className="flex gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="Entry mode">
              <button
                role="tab"
                aria-selected={!customMode}
                onClick={() => setCustomMode(false)}
                className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', !customMode ? 'bg-electric-600 text-white' : 'text-slate-400')}
              >
                Database
              </button>
              <button
                role="tab"
                aria-selected={customMode}
                onClick={() => setCustomMode(true)}
                className={clsx('rounded-lg px-3 py-1.5 text-xs font-semibold transition', customMode ? 'bg-electric-600 text-white' : 'text-slate-400')}
              >
                Custom
              </button>
            </div>
          </div>

          {!customMode ? (
            <>
              <div>
                <label htmlFor="food-search" className="sr-only">Search foods</label>
                <input
                  id="food-search"
                  className="input"
                  placeholder="Search: roti, dal, dosa, chai…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1" role="listbox" aria-label="Food results">
                {FOOD_CATEGORIES.map((cat) => {
                  const items = filteredFoods.filter((f) => f.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="px-1 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{cat}</p>
                      {items.map((f) => (
                        <button
                          key={f.id}
                          role="option"
                          aria-selected={selectedFood?.id === f.id}
                          onClick={() => setSelectedFood(f)}
                          className={clsx(
                            'flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                            selectedFood?.id === f.id
                              ? 'border-electric-400/70 bg-electric-500/15'
                              : 'border-white/5 bg-white/[0.02] hover:border-white/15',
                          )}
                        >
                          <span>
                            <span className="font-medium">{f.name}</span>
                            <span className="block text-xs text-slate-500">{f.portionLabel}</span>
                          </span>
                          <span className="flex items-center gap-2 text-xs text-slate-400">
                            {f.calories} kcal
                            {f.source === 'reference' ? <Badge tone="green"><IconShield width={10} /> food DB</Badge> : <Badge tone="amber"><IconInfo width={10} /> est.</Badge>}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Field label="Food name" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="e.g. Grandma’s upma" /></div>
              <Field label="Calories (kcal)" inputMode="decimal" value={cCals} onChange={(e) => setCCals(e.target.value)} placeholder="250" />
              <Field label="Protein (g)" inputMode="decimal" value={cProtein} onChange={(e) => setCProtein(e.target.value)} placeholder="8" />
              <Field label="Carbs (g)" inputMode="decimal" value={cCarbs} onChange={(e) => setCCarbs(e.target.value)} placeholder="35" />
              <Field label="Fat (g)" inputMode="decimal" value={cFat} onChange={(e) => setCFat(e.target.value)} placeholder="9" />
              <p className="col-span-2 text-xs text-slate-500">Custom entries are always saved as <b>estimates</b>.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="meal-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Meal</label>
              <select id="meal-select" className="input" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
                {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <Field label="Servings" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} hint={selectedFood && !customMode ? `1 serving = ${selectedFood.portionLabel}` : undefined} />
          </div>

          {formError && <p role="alert" className="text-sm text-coral">{formError}</p>}
          <Button glow onClick={saveEntry} loading={saving} className="w-full">
            <IconCheck width={15} /> {editingId ? 'Save changes' : 'Log this food'}
          </Button>
        </GlassCard>
      )}

      {/* Entries by meal */}
      {entries === null ? (
        <div className="skeleton h-40" />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<IconBowl width={30} />}
          title="Nothing logged today"
          body="Tap “Add food” and pick from the Indian database — idli to biryani — or add a custom dish."
          action={<Button variant="outline" onClick={() => openForm()}><IconPlus width={14} /> Add your first food</Button>}
        />
      ) : (
        <div className="space-y-4">
          {MEALS.map(({ id, label }) => {
            const list = entries.filter((e) => e.meal === id);
            if (list.length === 0) return null;
            const kcal = list.reduce((s, e) => s + e.calories * e.servings, 0);
            return (
              <GlassCard key={id}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold">{label}</h3>
                  <span className="text-xs text-slate-400">{Math.round(kcal)} kcal</span>
                </div>
                <ul className="divide-y divide-white/5">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium">
                          {e.name}
                          {e.servings !== 1 && <span className="text-slate-400"> × {e.servings}</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {e.portionLabel} · {Math.round(e.calories * e.servings)} kcal · P {Math.round(e.protein * e.servings)}g · C {Math.round(e.carbs * e.servings)}g · F {Math.round(e.fat * e.servings)}g
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {e.source === 'reference' ? <Badge tone="green">food DB</Badge> : e.source === 'custom' ? <Badge tone="slate">custom</Badge> : <Badge tone="amber">estimate</Badge>}
                        <button onClick={() => openForm(e)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-electric-300" aria-label={`Edit ${e.name}`}>
                          <IconEdit width={15} />
                        </button>
                        <button onClick={() => removeEntry(e.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-coral" aria-label={`Delete ${e.name}`}>
                          <IconTrash width={15} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            );
          })}
        </div>
      )}

     {/* Preferences */}
      {prefForm && (
        <GlassCard>
          <SectionTitle title="Daily targets & preferences" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Calories (kcal)" inputMode="numeric" value={prefForm.cal} onChange={(e) => setPrefForm({ ...prefForm, cal: e.target.value })} />
            <Field label="Protein (g)" inputMode="numeric" value={prefForm.protein} onChange={(e) => setPrefForm({ ...prefForm, protein: e.target.value })} />
            <Field label="Water (ml)" inputMode="numeric" value={prefForm.water} onChange={(e) => setPrefForm({ ...prefForm, water: e.target.value })} />
            <div className="space-y-1.5">
              <label htmlFor="diet-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Diet</label>
              <select id="diet-select" className="input" value={prefForm.diet} onChange={(e) => setPrefForm({ ...prefForm, diet: e.target.value as DietaryPreference })}>
                <option value="veg">Vegetarian</option>
                <option value="non-veg">Non-vegetarian</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="vegan">Vegan</option>
              </select>
            </div>
          </div>
          {prefDraft && <p role="alert" className="mt-3 text-sm text-coral">{prefDraft}</p>}
          <div className="mt-4 flex items-center gap-3">
            <Button variant="outline" onClick={savePrefs}><IconCheck width={14} /> Save targets</Button>
            {prefSaved && <span role="status" className="text-sm font-semibold text-mint">Saved ✓</span>}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={<div className="skeleton h-40" />}>
      <NutritionInner />
    </Suspense>
  );
}