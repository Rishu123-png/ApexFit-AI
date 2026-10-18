'use client';

import Link from 'next/link';
import type { DietaryPreference, FoodItem, Preferences } from '@/lib/types';
import { FOODS } from '@/lib/data/foods';
import { GlassCard, Badge, Button } from '@/components/ui';
import { IconCamera, IconCheck, IconPlus } from '@/components/icons';

type MealSlot = {
  id: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  label: string;
  share: number;
  categories: string[];
};

const MEALS: MealSlot[] = [
  { id: 'breakfast', label: 'Breakfast', share: 0.25, categories: ['Breakfast', 'Dairy'] },
  { id: 'lunch', label: 'Lunch', share: 0.35, categories: ['Protein', 'Dals & Legumes', 'Breads & Grains'] },
  { id: 'snacks', label: 'Snack', share: 0.15, categories: ['Fruits & Nuts', 'Snacks & Beverages'] },
  { id: 'dinner', label: 'Dinner', share: 0.25, categories: ['Protein', 'Dals & Legumes', 'Breads & Grains'] },
];

function compatible(food: FoodItem, diet: DietaryPreference) {
  if (diet === 'vegan') return !['Dairy', 'Protein'].includes(food.category) && !/egg|chicken|paneer|milk|curd|dahi/i.test(food.name);
  if (diet === 'veg') return !/egg|chicken/i.test(food.name);
  if (diet === 'eggetarian') return !/chicken/i.test(food.name);
  return true;
}

function suggestions(slot: MealSlot, diet: DietaryPreference) {
  const candidates = FOODS.filter((food) => slot.categories.includes(food.category) && compatible(food, diet));
  const preferred = candidates.filter((food) => slot.id === 'snacks' || food.protein >= 5);
  return (preferred.length >= 2 ? preferred : candidates).slice(0, 2);
}

export function DailyNutritionPlan({ prefs }: { prefs: Preferences }) {
  const diet = prefs.dietaryPreference ?? 'non-veg';
  return (
    <GlassCard className="overflow-hidden border-electric-500/20 bg-[linear-gradient(135deg,rgba(20,49,96,.42),rgba(12,15,30,.72))]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.17em] text-electric-300">Today’s fuel map</p>
          <h2 className="mt-1 text-xl font-black">A simple path to your targets</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-400">Balanced suggestions based on your saved targets. Portions are references, not medical advice—adjust for appetite, culture and guidance from a qualified professional.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/food-scan"><Button variant="outline" className="px-3 py-2 text-xs"><IconCamera width={14} /> Scan food</Button></Link>
          <Link href="/nutrition?add=1"><Button glow className="px-3 py-2 text-xs"><IconPlus width={14} /> Log meal</Button></Link>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {MEALS.map((slot) => {
          const picks = suggestions(slot, diet);
          const calories = Math.round(prefs.calorieTarget * slot.share);
          const protein = Math.round(prefs.proteinTarget * slot.share);
          return (
            <div key={slot.id} className="rounded-2xl border border-white/8 bg-white/[.035] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{slot.label}</p>
                  <p className="text-xs text-slate-500">Aim for ~{calories} kcal · {protein} g protein</p>
                </div>
                <Badge tone="blue">{Math.round(slot.share * 100)}%</Badge>
              </div>
              <ul className="mt-3 space-y-1.5">
                {picks.map((food) => (
                  <li key={food.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 text-slate-300"><IconCheck width={12} className="shrink-0 text-mint" /> <span className="truncate">{food.name}</span></span>
                    <span className="shrink-0 text-slate-500">{food.calories} kcal · {food.protein}g P</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Want a different option? Open the tracker to search the India-first food database or scan a plate and correct the estimate before saving.</p>
    </GlassCard>
  );
}
