import type { ArenaVisibility } from './types';

/**
 * Consent → public projection plan. Pure + unit-tested (A2 fix).
 *
 * Invariants:
 *  - NO profile  → nothing public exists.
 *  - global off  → the lifetime (global ladder) projection is deleted.
 *  - both off    → every public projection is deleted and no new ones are written.
 *  - friends-only participants write period scores (friends boards need them)
 *    but never the global lifetime ladder.
 *  - leaderboard reads STILL re-check visibility per row (defense in depth).
 */
export interface ProjectionPlan {
  /** write the current global lifetime projection */
  writeLifetime: boolean;
  /** delete any stored lifetime projection */
  deleteLifetime: boolean;
  /** period scores (weekly/seasonal) may be written going forward */
  writePeriods: boolean;
  /** wipe all stored period projections */
  deletePeriods: boolean;
}

export function projectionPlan(
  hasProfile: boolean,
  visibility?: ArenaVisibility,
): ProjectionPlan {
  if (!hasProfile || !visibility) {
    return { writeLifetime: false, deleteLifetime: true, writePeriods: false, deletePeriods: true };
  }
  const { global, friends } = visibility;
  return {
    writeLifetime: global,
    deleteLifetime: !global,
    writePeriods: global || friends,
    deletePeriods: !global && !friends,
  };
}
