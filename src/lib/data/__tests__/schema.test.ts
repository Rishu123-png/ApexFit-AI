import { describe, expect, it } from 'vitest';
import { CURRENT_DATA_SCHEMA_VERSION, migrateNutritionEntry, migratePreferences, migrateWorkoutSession, withDataVersion } from '@/lib/data/schema';

describe('persisted-data migrations', () => {
  it('normalizes a legacy verified nutrition row without losing its values', () => {
    const entry = migrateNutritionEntry('meal-1', {
      name: 'Dal', meal: 'lunch', servings: 1, calories: 210, protein: 12, carbs: 30, fat: 4,
      source: 'verified', loggedAt: 1,
    });
    expect(entry.source).toBe('reference');
    expect(entry.schemaVersion).toBe(0);
  });

  it('supplies safe preference defaults for records from before schema versioning', () => {
    expect(migratePreferences({ proteinTarget: 110 })).toMatchObject({ calorieTarget: 2200, proteinTarget: 110, waterTargetMl: 2500 });
  });

  it('does not render malformed workout rows as valid history', () => {
    expect(migrateWorkoutSession('broken', { planName: 'Missing plan id' })).toBeNull();
  });

  it('stamps every newly written record with the current schema version', () => {
    expect(withDataVersion({ name: 'A recipe' }).schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
  });
});
