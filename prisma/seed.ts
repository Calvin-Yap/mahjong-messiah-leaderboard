/**
 * One-time backfill script — see Section 4 of the implementation plan.
 *
 * Usage:
 *   1. Export "Game Scores", "Leaderboard", "ELO State", "ELO History"
 *      sheets to CSV (or fetch via Google Sheets API) into ./prisma/import/
 *   2. npm run db:seed
 *
 * TODO(import):
 *   - [ ] Parse players from Leaderboard.csv (col B name, col L icon)
 *   - [ ] Parse Game Scores.csv rows (skip "Totals"), one Game + N GameScores each
 *   - [ ] Load ELO State.csv directly into elo_state (skip recalculation —
 *         this guarantees the imported leaderboard matches the old one exactly)
 *   - [ ] Load ELO History.csv directly into elo_history for chart continuity
 *   - [ ] Print a reconciliation report comparing computed totals vs.
 *         Leaderboard.csv values for every player before going live
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // TODO: replace with real CSV parsing (e.g. `papaparse` or `csv-parse`)
  console.log('Seed script placeholder — see TODO(import) above.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
