/**
 * One-time backfill from the Google Sheets scoreboard — see Section 4 of
 * the implementation plan, and the chat message this script shipped with
 * for the full reasoning behind each decision below.
 *
 * Usage:
 *   1. Drop the .xlsx file into prisma/import/scoresheet.xlsx
 *   2. npm run db:seed
 *
 * What this does, in order:
 *   1. Reads Leaderboard  -> creates players (name + icon)
 *   2. Reads ELO State    -> seeds elo_state directly (skips recalculation
 *      entirely, so the imported ratings match the old sheet exactly)
 *   3. Creates/reuses an active Season 1 to own all this historical data
 *   4. Reads Game Scores  -> creates games + game_scores (nonzero cells only
 *      — see the "discard-win bystander" note in the header of this file's
 *      companion chat message for why 2 of 4 seated players are sometimes
 *      unrecoverable from the source data)
 *   5. Reads ELO History  -> creates elo_history, nearest-timestamp-joined
 *      to the games created in step 4 (exact timestamp equality misses
 *      ~50% of rows due to sub-second logging drift between the two
 *      original sheets)
 *   6. Reconciliation report: recomputes total_score per player from what
 *      was just inserted and diffs it against the Leaderboard sheet's
 *      Total Points column — read this before treating the import as done.
 *
 * NOT imported: the "Old Game Scores" sheet (a different, older manual-entry
 * format) and the "Analytics" sheet (derived, not source data). Extend this
 * script if you want that history too.
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as path from "path";
import { FAN_TO_POINTS } from "../src/lib/scoring";

const prisma = new PrismaClient();

const WORKBOOK_PATH = path.join(__dirname, "import", "scoresheet.xlsx");
const ELO_JOIN_TOLERANCE_MS = 60 * 60 * 1000; // 1 hour — see header note

interface LeaderboardRow {
  name: string;
  icon: string | null;
  totalPoints: number;
}

interface RawGameRow {
  playedAt: Date;
  scores: { player: string; score: number }[]; // nonzero entries only
}

interface EloStateRow {
  player: string;
  rating: number;
  gamesPlayed: number;
  peak: number;
  last5: number[];
}

interface EloHistoryRow {
  playedAt: Date;
  ratings: { player: string; rating: number }[];
}

function requireSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet {
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error(`Missing sheet "${name}" in ${WORKBOOK_PATH}`);
  return sheet;
}

function excelDateToJsDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Excel/Sheets serial date -> JS Date (1900 date system, matches Google Sheets export).
    return new Date(Math.round((value - 25569) * 86400 * 1000));
  }
  return null;
}

function readLeaderboard(wb: XLSX.WorkBook): LeaderboardRow[] {
  const sheet = requireSheet(wb, "Leaderboard");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  return rows
    .filter((r) => r["Player Name"])
    .map((r) => ({
      name: String(r["Player Name"]),
      icon: r["Icon"] ? String(r["Icon"]) : null,
      totalPoints: Number(r["Total Points"] ?? 0),
    }));
}

function readEloState(wb: XLSX.WorkBook): EloStateRow[] {
  const sheet = requireSheet(wb, "ELO State");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });
  return rows
    .filter((r) => r["Player"])
    .map((r) => ({
      player: String(r["Player"]),
      rating: Number(r["Rating"] ?? 1500),
      gamesPlayed: Number(r["GamesPlayed"] ?? 0),
      peak: Number(r["Peak"] ?? 1500),
      last5: [1, 2, 3, 4, 5]
        .map((i) => r[`Last5_${i}`])
        .filter((v) => v !== null && v !== undefined)
        .map(Number),
    }));
}

function readGameScores(wb: XLSX.WorkBook): RawGameRow[] {
  const sheet = requireSheet(wb, "Game Scores");
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const header = grid[0] as (string | null)[];
  const playerCols = header
    .map((name, i) => ({ name, i }))
    .filter((c) => c.i > 0 && c.name);

  const games: RawGameRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const rawDate = row[0];
    if (rawDate == null || rawDate === "Totals") continue; // skip blank rows + the Totals row
    const playedAt = excelDateToJsDate(rawDate);
    if (!playedAt) continue;

    const scores = playerCols
      .map((c) => ({ player: c.name as string, score: Number(row[c.i] ?? 0) }))
      .filter((s) => s.score !== 0);

    if (scores.length > 0) games.push({ playedAt, scores });
  }
  return games;
}

function readEloHistory(wb: XLSX.WorkBook): EloHistoryRow[] {
  const sheet = requireSheet(wb, "ELO History");
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });
  const header = grid[0] as (string | null)[];
  const playerCols = header
    .map((name, i) => ({ name, i }))
    .filter((c) => c.i > 0 && c.name);

  const rows: EloHistoryRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    if (!row) continue;
    const playedAt = excelDateToJsDate(row[0]);
    if (!playedAt) continue;

    const ratings = playerCols
      .map((c) => ({ player: c.name as string, rating: row[c.i] }))
      .filter((s) => s.rating !== null && s.rating !== undefined)
      .map((s) => ({ player: s.player, rating: Number(s.rating) }));

    if (ratings.length > 0) rows.push({ playedAt, ratings });
  }
  return rows;
}

/** Infers fan/winType from a discard (2 nonzero entries) or self-draw (4, one at 3x) row. */
function classifyGame(scores: { player: string; score: number }[]) {
  const positives = scores.filter((s) => s.score > 0);
  const negatives = scores.filter((s) => s.score < 0);

  function fanForBase(base: number): number | null {
    const entry = Object.entries(FAN_TO_POINTS).find(([, pts]) => pts === base);
    return entry ? Number(entry[0]) : null;
  }

  if (scores.length === 2 && positives.length === 1 && negatives.length === 1) {
    const base = positives[0]!.score / 2;
    return {
      winType: "discard" as const,
      winner: positives[0]!.player,
      loser: negatives[0]!.player,
      fan: fanForBase(base),
    };
  }

  if (scores.length === 4 && positives.length === 1 && negatives.length === 3) {
    const base = positives[0]!.score / 3;
    const consistent = negatives.every((n) => Math.abs(n.score + base) < 0.01);
    if (consistent) {
      return {
        winType: "self_draw" as const,
        winner: positives[0]!.player,
        loser: null,
        fan: fanForBase(base),
      };
    }
  }

  // Doesn't fit the fan model (manual/legacy entry) — still record the raw
  // scores, just without a winType/fan attribution.
  return {
    winType: "manual" as const,
    winner: positives[0]?.player ?? null,
    loser: null,
    fan: null,
  };
}

async function main() {
  console.log(`Reading ${WORKBOOK_PATH}...`);
  const wb = XLSX.readFile(WORKBOOK_PATH, { cellDates: true });

  const existingPlayerCount = await prisma.player.count();
  if (existingPlayerCount > 0) {
    throw new Error(
      `players table already has ${existingPlayerCount} rows — refusing to double-import. ` +
        `Run "npx prisma migrate reset" first if you want a clean re-import.`,
    );
  }

  const leaderboard = readLeaderboard(wb);
  const eloState = readEloState(wb);
  const rawGames = readGameScores(wb);
  const eloHistory = readEloHistory(wb);
  console.log(
    `Parsed ${leaderboard.length} players, ${rawGames.length} games, ${eloHistory.length} ELO snapshots.`,
  );

  // --- 1 & 2. Players + ELO state -----------------------------------
  const eloByPlayer = new Map(eloState.map((e) => [e.player, e]));
  const playerIdByName = new Map<string, string>();

  for (const p of leaderboard) {
    const created = await prisma.player.create({
      data: { name: p.name, icon: p.icon },
    });
    playerIdByName.set(p.name, created.id);

    const e = eloByPlayer.get(p.name);
    await prisma.eloState.create({
      data: {
        playerId: created.id,
        rating: e?.rating ?? 1500,
        gamesPlayed: e?.gamesPlayed ?? 0,
        peakRating: e?.peak ?? 1500,
        last5Deltas: e?.last5 ?? [],
      },
    });
  }
  console.log(`Inserted ${playerIdByName.size} players + elo_state rows.`);

  // --- 3. Active season to own this data ------------------------------
  let season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) {
    season = await prisma.season.create({
      data: { seasonNumber: 1, name: "Season 1", isActive: true },
    });
  }

  // --- 4. Games + game_scores ------------------------------------------
  const gameIdByTimestamp = new Map<number, string>(); // epoch ms -> game id, for the ELO join below
  let skippedUnknownPlayers = 0;

  for (const raw of rawGames) {
    const scores = raw.scores.filter((s) => playerIdByName.has(s.player));
    if (scores.length !== raw.scores.length) skippedUnknownPlayers++;
    if (scores.length === 0) continue;

    const classified = classifyGame(scores);
    const game = await prisma.game.create({
      data: {
        playedAt: raw.playedAt,
        seasonId: season.id,
        winType: classified.winType,
        fan: classified.fan ?? undefined,
        winnerId: classified.winner
          ? playerIdByName.get(classified.winner)
          : undefined,
        loserId: classified.loser
          ? playerIdByName.get(classified.loser)
          : undefined,
        scores: {
          create: scores.map((s) => ({
            playerId: playerIdByName.get(s.player)!,
            score: s.score,
          })),
        },
      },
    });
    gameIdByTimestamp.set(raw.playedAt.getTime(), game.id);
  }
  console.log(`Inserted ${gameIdByTimestamp.size} games + game_scores.`);
  if (skippedUnknownPlayers > 0) {
    console.warn(
      `${skippedUnknownPlayers} game rows referenced a player column not found in Leaderboard — those entries were dropped, not the whole game.`,
    );
  }

  // --- 5. ELO history, nearest-timestamp-joined to games --------------
  const sortedGameTimestamps = Array.from(gameIdByTimestamp.keys()).sort(
    (a, b) => a - b,
  );
  function nearestGameId(t: number): { id: string; gapMs: number } | null {
    // binary search for the closest timestamp
    let lo = 0,
      hi = sortedGameTimestamps.length - 1,
      best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (sortedGameTimestamps[mid]! < t) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const candidates = [best, best + 1].filter(
      (i) => i >= 0 && i < sortedGameTimestamps.length,
    );
    if (candidates.length === 0) return null;
    const closest = candidates.reduce((a, b) =>
      Math.abs(sortedGameTimestamps[a]! - t) <
      Math.abs(sortedGameTimestamps[b]! - t)
        ? a
        : b,
    );
    const ts = sortedGameTimestamps[closest]!;
    return { id: gameIdByTimestamp.get(ts)!, gapMs: Math.abs(ts - t) };
  }

  const lastKnownRating = new Map<string, number>(); // player -> rating, for delta calc
  let insertedEloHistory = 0;
  let skippedOrphanedEloRows = 0;

  for (const snapshot of eloHistory) {
    const match = nearestGameId(snapshot.playedAt.getTime());
    if (!match || match.gapMs > ELO_JOIN_TOLERANCE_MS) {
      skippedOrphanedEloRows++;
      continue;
    }
    for (const r of snapshot.ratings) {
      const playerId = playerIdByName.get(r.player);
      if (!playerId) continue;
      const prev = lastKnownRating.get(r.player) ?? 1500;
      await prisma.eloHistory.create({
        data: {
          gameId: match.id,
          playerId,
          ratingAfter: r.rating,
          delta: r.rating - prev,
          playedAt: snapshot.playedAt,
        },
      });
      lastKnownRating.set(r.player, r.rating);
      insertedEloHistory++;
    }
  }
  console.log(`Inserted ${insertedEloHistory} elo_history rows.`);
  if (skippedOrphanedEloRows > 0) {
    console.warn(
      `${skippedOrphanedEloRows} ELO History snapshots had no game within ${ELO_JOIN_TOLERANCE_MS / 1000}s — skipped rather than guessed at. The ELO progression chart will have small gaps at those points.`,
    );
  }

  // --- 6. Reconciliation report ----------------------------------------
  console.log(
    "\n--- Reconciliation: computed total_score vs Leaderboard sheet ---",
  );
  let mismatches = 0;
  for (const p of leaderboard) {
    const playerId = playerIdByName.get(p.name)!;
    const agg = await prisma.gameScore.aggregate({
      where: { playerId },
      _sum: { score: true },
    });
    const computed = Number(agg._sum.score ?? 0);
    if (Math.abs(computed - p.totalPoints) > 0.01) {
      mismatches++;
      console.warn(
        `  ⚠️  ${p.name}: sheet=${p.totalPoints}, computed=${computed} (diff ${(computed - p.totalPoints).toFixed(2)})`,
      );
    }
  }
  console.log(
    mismatches === 0
      ? `✅ All ${leaderboard.length} players match the Leaderboard sheet exactly.`
      : `⚠️  ${mismatches} of ${leaderboard.length} players don't match — review before treating this import as authoritative.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
