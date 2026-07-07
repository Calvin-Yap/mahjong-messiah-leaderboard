import type { Prisma, PrismaClient } from "@prisma/client";
import {
  ELO_CUTOFF_DATE,
  computeGameDeltas,
  applyDeltas,
  newPlayerState,
  type EloPlayerState,
} from "./elo";

// Either the top-level client or a `$transaction` callback client — both
// expose the same `game` / `eloState` / `eloHistory` delegates we need.
type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Full ELO recalculation — implements the "full recalculation path" TODO
 * in elo.ts. Wipes elo_state/elo_history and rebuilds them from every
 * remaining Game + GameScore, ordered by playedAt ascending, using the
 * exact same incremental math as the normal POST /api/games path (so a
 * from-scratch recalc always agrees with the incremental one).
 *
 * Editing or deleting a game changes history that every later game's ELO
 * was incrementally computed on top of, so — unlike a normal new game —
 * both operations must run this afterward instead of touching elo_state
 * incrementally. Callers should run this inside the same `$transaction`
 * as the game edit/delete so the DB is never left with stale ELO if the
 * recalc fails partway through.
 */
export async function recalculateElo(db: Db): Promise<void> {
  // Wipe first: elo_history.game_id has ON DELETE RESTRICT, so any game
  // delete in the same transaction must clear elo_history before it (and
  // elo_state references players, not games, but we rebuild it wholesale
  // too since ratings are cumulative and can't be patched incrementally).
  await db.eloHistory.deleteMany({});
  await db.eloState.deleteMany({});

  const games = await db.game.findMany({
    orderBy: { playedAt: "asc" },
    include: { scores: true },
  });

  const stateByPlayer: Record<string, EloPlayerState> = {};
  const historyRows: {
    gameId: string;
    playerId: string;
    ratingAfter: number;
    delta: number;
    playedAt: Date;
  }[] = [];

  for (const game of games) {
    const participants = game.scores.map((s) => ({
      name: s.playerId,
      score: Number(s.score),
    }));
    participants.forEach((p) => {
      if (!stateByPlayer[p.name]) stateByPlayer[p.name] = newPlayerState();
    });

    const isPreCutoff = game.playedAt < ELO_CUTOFF_DATE;

    if (isPreCutoff) {
      // Pre-cutoff games count toward games-played (K-factor tier) only —
      // no ELO delta — per the historical-data note in elo.ts.
      participants.forEach((p) => {
        const state = stateByPlayer[p.name]!;
        state.gamesPlayed += 1;
        historyRows.push({
          gameId: game.id,
          playerId: p.name,
          ratingAfter: state.rating,
          delta: 0,
          playedAt: game.playedAt,
        });
      });
    } else {
      const deltas = computeGameDeltas(participants, stateByPlayer);
      applyDeltas(participants, stateByPlayer, deltas);
      participants.forEach((p) => {
        const state = stateByPlayer[p.name]!;
        historyRows.push({
          gameId: game.id,
          playerId: p.name,
          ratingAfter: state.rating,
          delta: deltas[p.name]!,
          playedAt: game.playedAt,
        });
      });
    }
  }

  const playerIds = Object.keys(stateByPlayer);
  if (playerIds.length > 0) {
    await db.eloState.createMany({
      data: playerIds.map((playerId) => ({
        playerId,
        rating: stateByPlayer[playerId]!.rating,
        gamesPlayed: stateByPlayer[playerId]!.gamesPlayed,
        peakRating: stateByPlayer[playerId]!.peak,
        last5Deltas: stateByPlayer[playerId]!.last5,
      })),
    });
  }
  if (historyRows.length > 0) {
    await db.eloHistory.createMany({ data: historyRows });
  }
}
