import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, set } from 'firebase/database';

const rules = readFileSync('realtime-database.rules.json', 'utf8');
let testEnv: RulesTestEnvironment;

const validRecipe = {
  schemaVersion: 1,
  name: 'My protein poha',
  portionLabel: '1 bowl',
  defaultMeal: 'breakfast',
  calories: 320,
  protein: 16,
  carbs: 44,
  fat: 9,
  createdAt: 1,
  updatedAt: 1,
};

describe('Realtime Database security rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'apexfit-rules-test',
      database: { rules },
    });
  });

  afterEach(async () => {
    await testEnv.clearDatabase();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('lets a member write a bounded recipe to their own account', async () => {
    const db = testEnv.authenticatedContext('alice').database();
    await assertSucceeds(set(ref(db, 'users/alice/recipes/recipe-1'), validRecipe));
  });

  it('rejects malicious recipe fields and impossible nutrition values', async () => {
    const db = testEnv.authenticatedContext('alice').database();
    await assertFails(set(ref(db, 'users/alice/recipes/recipe-1'), { ...validRecipe, calories: 9000 }));
    await assertFails(set(ref(db, 'users/alice/recipes/recipe-2'), { ...validRecipe, injectedRole: 'admin' }));
  });

  it('blocks cross-account writes and client-created verification fields', async () => {
    const alice = testEnv.authenticatedContext('alice').database();
    await assertFails(set(ref(alice, 'users/bob/recipes/recipe-1'), validRecipe));
    await assertFails(set(ref(alice, 'users/alice/workouts/forged'), {
      schemaVersion: 1,
      planId: 'foundations-full-body', planName: 'Foundations', startedAt: 1, endedAt: 2,
      durationSec: 1, totalSets: 1, status: 'completed', verified: true,
    }));
  });

  it('blocks unknown root branches under a member account', async () => {
    const db = testEnv.authenticatedContext('alice').database();
    await assertFails(set(ref(db, 'users/alice/internalAdminFlags'), { enabled: true }));
  });
});
