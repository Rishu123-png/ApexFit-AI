import type { LeaderboardPeriod } from '@/lib/arena/types';

export function glassBoardEmptyCopy(period: LeaderboardPeriod): string {
  switch (period) {
    case 'weekly':
      return 'Be the first to score this week — finish an eligible workout to put your name up.';
    case 'seasonal':
      return 'The season has just begun. Every eligible session this quarter counts.';
    case 'lifetime':
      return 'Lifetime XP accumulates forever. Start your climb with one small session.';
  }
}