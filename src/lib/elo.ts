/**
 * ELO rating engine — ported 1:1 from the original elo.gs so ratings
 * produced by the web app match the spreadsheet's historical numbers.
 *
 * Do not tweak constants here without re-running the reconciliation
 * check from the import plan (Section 4) against the old Leaderboard sheet.
 */

export const ELO_STARTING_RATING = 1500;
export const ELO_K_NEW = 40; // < 20 games played
export const ELO_K_MID = 20; // 20–49 games played
export const ELO_K_VET = 16; // 50+ games played

// Before this date, "0" in a score cell meant "didn't play," not "drew,"
// so pre-cutoff games count toward games-played (K-factor tier) only —
// they produce no ELO delta. See elo.gs for the historical reasoning.
export const ELO_CUTOFF_DATE = new Date(
  process.env.NEXT_PUBLIC_ELO_CUTOFF_DATE ?? '2026-04-25T00:00:00Z'
);

export interface EloPlayerState {
  rating: number;
  gamesPlayed: number;
  peak: number;
  last5: number[]; // most recent deltas, capped at 5, oldest first
}

export interface Participant {
  name: string; // or playerId — caller's choice of key
  score: number;
}

/** Actual result S_A for the pairwise comparison: 1 win / 0.5 draw / 0 loss. */
export function getActual(scoreA: number, scoreB: number): number {
  if (scoreA > scoreB) return 1.0;
  if (scoreA < scoreB) return 0.0;
  return 0.5;
}

/** K-factor tier by experience. */
export function getK(gamesPlayed: number): number {
  if (gamesPlayed < 20) return ELO_K_NEW;
  if (gamesPlayed < 50) return ELO_K_MID;
  return ELO_K_VET;
}

/** Margin-of-victory multiplier — bigger score gaps move ratings more, with diminishing returns. */
export function getSpreadMultiplier(scoreA: number, scoreB: number): number {
  const spread = Math.abs(scoreA - scoreB);
  if (spread === 0) return 1.0;
  return 1.0 + Math.log10(1 + spread / 32);
}

/**
 * Computes pairwise ELO deltas for one game's participants (2-4 players).
 * Every pairing is evaluated simultaneously; a player's total delta is the
 * sum of their individual pairwise results against every other player.
 */
export function computeGameDeltas(
  participants: Participant[],
  stateByName: Record<string, EloPlayerState>
): Record<string, number> {
  const deltas: Record<string, number> = {};
  participants.forEach((p) => (deltas[p.name] = 0));

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const pA = participants[i]!;
      const pB = participants[j]!;
      const sA = stateByName[pA.name]!;
      const sB = stateByName[pB.name]!;

      const expA = 1 / (1 + Math.pow(10, (sB.rating - sA.rating) / 400));
      const actA = getActual(pA.score, pB.score);
      const matchK = (getK(sA.gamesPlayed) + getK(sB.gamesPlayed)) / 2;
      const mult = getSpreadMultiplier(pA.score, pB.score);

      deltas[pA.name]! += matchK * mult * (actA - expA);
      deltas[pB.name]! += matchK * mult * (1 - actA - (1 - expA));
    }
  }

  return deltas;
}

/**
 * Applies one game's deltas to player state in place, updating rating,
 * peak, gamesPlayed, and the rolling last-5-deltas window.
 */
export function applyDeltas(
  participants: Participant[],
  stateByName: Record<string, EloPlayerState>,
  deltas: Record<string, number>
): void {
  participants.forEach((p) => {
    const state = stateByName[p.name]!;
    state.rating += deltas[p.name]!;
    state.gamesPlayed += 1;
    if (state.rating > state.peak) state.peak = state.rating;
    state.last5.push(deltas[p.name]!);
    if (state.last5.length > 5) state.last5.shift();
  });
}

export function newPlayerState(): EloPlayerState {
  return { rating: ELO_STARTING_RATING, gamesPlayed: 0, peak: ELO_STARTING_RATING, last5: [] };
}

export function sumLast5(state: EloPlayerState): number {
  return state.last5.reduce((a, b) => a + b, 0);
}

/**
 * TODO(incremental path — used by POST /api/games):
 *   1. Load EloState rows for exactly the game's participants from Postgres.
 *   2. Run computeGameDeltas + applyDeltas (this file).
 *   3. Upsert elo_state for those players, insert one elo_history row each,
 *      all inside a single Prisma transaction alongside the Game/GameScore insert.
 *   This mirrors applyIncrementalElo_() in the original elo.gs — fast path,
 *   no full recalculation on every game.
 */

/**
 * TODO(full recalculation path — admin-only "Recalculate ELO" action):
 *   1. Wipe elo_state / elo_history.
 *   2. Load every Game + GameScore ordered by playedAt ascending.
 *   3. For games before ELO_CUTOFF_DATE: increment gamesPlayed only (no delta)
 *      for participants with a non-zero score (mirrors legacy "0 = absent" data).
 *   4. For games on/after ELO_CUTOFF_DATE: run computeGameDeltas + applyDeltas
 *      for all participants (blank/missing = absent; 0 is a valid score).
 *   5. Write final elo_state per player + one elo_history row per game/player.
 *   This mirrors recalculateElo() + buildEloHistory() in the original elo.gs.
 */
