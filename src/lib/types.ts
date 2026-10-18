export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner';

export type DietaryPreference = 'veg' | 'non-veg' | 'eggetarian' | 'vegan';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type FitnessGoal = 'general-fitness' | 'strength' | 'fat-loss' | 'muscle-gain' | 'mobility';
export type TrainingFocus = 'full-body' | 'upper-body' | 'lower-body' | 'core' | 'mobility' | 'conditioning';

/** Self-reported private profile data. The app never infers body type, body fat,
 * health status, or a future appearance from a camera. */
export interface UserProfile {
  /** Version of the persisted client data contract. Older records are migrated on read. */
  schemaVersion?: number;
  displayName: string;
  email: string;
  createdAt: number;
  goal?: FitnessGoal;
  experience?: ExperienceLevel;
  dietaryPreference?: DietaryPreference;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  trainingDaysPerWeek?: number;
  focusAreas?: TrainingFocus[];
  equipmentAccess?: 'none' | 'dumbbells' | 'gym';
  onboardingCompleted?: boolean;
  /** User opted into a local camera framing check; no photo/video is stored. */
  localBodyBaselineCheckedAt?: number;
}

export interface BodyMetric {
  weightKg: number;
  heightCm: number;
  recordedAt: number;
}

export interface Preferences {
  schemaVersion?: number;
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
  schemaVersion?: number;
  name: string;
  portionLabel: string;
  meal: MealType;
  servings: number;
  /** per-serving values */
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /**
   * Honest provenance (spec §9):
   *  - 'reference' = values from the in-app curated food database
   *  - 'estimate'  = AI/home-style approximation, user-correctable
   *  - 'custom'    = free text typed by the user
   * Legacy rows may carry 'verified' (≈ reference); nothing new is written with it.
   */
  source: 'reference' | 'estimate' | 'custom';
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
  schemaVersion?: number;
  planId: string;
  planName: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  totalSets: number;
  status: 'completed' | 'partial';
  exercises: SessionExercise[];
  /** True when local camera guidance was enabled at least once; this is a coaching signal, not proof of safe exercise. */
  cameraGuidanceUsed?: boolean;
  /** server-only fields — database rules forbid clients from writing these */
  verified?: boolean;
  sealedAt?: number;
  serverDurationSec?: number;
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

/** A reusable user-created meal/recipe. Nutrition values are always per serving. */
export interface SavedRecipe {
  id: string;
  schemaVersion?: number;
  name: string;
  portionLabel: string;
  defaultMeal: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: number;
  updatedAt: number;
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
  /** reference = curated food-DB values; estimate = home-style/AI approximation */
  source: 'reference' | 'estimate';
}
