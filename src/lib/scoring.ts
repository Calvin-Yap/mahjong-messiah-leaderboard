/**
 * Fan-based scoring — ported verbatim from buildFanGameSidebar() in code.gs.
 * Base points per fan: 3→8 ... 13→384 (doubling roughly every 2 fan).
 */

export const FAN_TO_POINTS: Record<number, number> = {
  3: 8,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
  10: 128,
  11: 192,
  12: 256,
  13: 384,
};

export const MIN_FAN = 3;
export const MAX_FAN = 13;

export interface ScoreGameInput {
  players: [string, string, string, string]; // exactly 4 player ids/names
  winner: string;
  fan: number; // 3-13
  isSelfDraw: boolean;
  loser?: string; // required unless isSelfDraw
}

export class InvalidGameError extends Error {}

/**
 * Computes each player's score for one hand.
 *  - Discard win: winner +base*2, discarder -base*2, other two 0.
 *  - Self-draw:   winner +base*3, everyone else -base each.
 * Result always sums to zero (Mahjong rule), enforced by the shape of the math
 * but re-validated at the end as a safety net for future edits.
 */
export function computeFanScores(input: ScoreGameInput): Record<string, number> {
  const { players, winner, fan, isSelfDraw, loser } = input;

  if (new Set(players).size !== 4) {
    throw new InvalidGameError('Exactly 4 distinct players are required.');
  }
  if (!players.includes(winner)) {
    throw new InvalidGameError('Winner must be one of the 4 selected players.');
  }
  if (fan < MIN_FAN || fan > MAX_FAN) {
    throw new InvalidGameError(`Fan must be between ${MIN_FAN} and ${MAX_FAN}.`);
  }
  if (!isSelfDraw && (!loser || !players.includes(loser))) {
    throw new InvalidGameError('Discarder (loser) is required unless self-draw.');
  }

  const base = fan >= MAX_FAN ? FAN_TO_POINTS[MAX_FAN]! : FAN_TO_POINTS[fan]!;
  const scores: Record<string, number> = {};
  const nonWinners = players.filter((p) => p !== winner);

  if (isSelfDraw) {
    scores[winner] = base * 3;
    nonWinners.forEach((p) => (scores[p] = -base));
  } else {
    scores[winner] = base * 2;
    scores[loser!] = -base * 2;
    nonWinners.filter((p) => p !== loser).forEach((p) => (scores[p] = 0));
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total !== 0) {
    // Should be unreachable given the math above — guards against future edits.
    throw new InvalidGameError(`Scores must sum to zero (got ${total}).`);
  }

  return scores;
}
