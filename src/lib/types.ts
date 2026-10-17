export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export type DietaryPreference = 'veg' | 'non-veg' | 'eggetarian' | 'vegan';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface UserProfile {
  displayName: string;
  email: string;
  createdAt: number;
  goal?: string;
  experience?: ExperienceLevel;
  dietaryPreference?: DietaryPreference;
}

export interface Preferences {
  calorieTarget: number;
  proteinTarget: number;
  waterTargetMl: number;
  dietaryPreference?: DietaryPreference;
}

export const DEFAULT_PREFERENCES: Preferences = {
  calorieTarget: 2200,
  proteinTarget: 90,
  waterTargetMl: 2500,
  dietaryPreference: 'non-veg',
};

export interface NutritionEntry {
  id: string;
  name: string;
  portionLabel: string;
  meal: MealType;
  servings: number;
  /** per-serving values */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** verified = reference data (e.g. IFCT); estimate = AI/home-style approximation */
  source: 'verified' | 'estimate';
  loggedAt: number;
}

export interface HydrationLog {
  ml: number;
  ts: number;
}

export interface HydrationDay {
  totalMl: number;
  logs?: Record<string, HydrationLog>;
}

export interface SessionExercise {
  exerciseId: string;
  name: string;
  targetSets: number;
  completedSets: number;
}

export interface WorkoutSession {
  id: string;
  planId: string;
  planName: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  totalSets: number;
  status: 'completed' | 'partial';
  exercises: SessionExercise[];
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  instructions: string[];
  substitution?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  focus: string;
  durationMin: number;
  equipment: string;
  accent: string;
  exercises: Exercise[];
}

export interface FoodItem {
  id: string;
  name: string;
  category: string;
  portionLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: 'verified' | 'estimate';
}
