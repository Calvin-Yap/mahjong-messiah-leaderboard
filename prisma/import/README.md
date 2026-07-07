Drop your exported workbook here as `scoresheet.xlsx` before running `npm run db:seed`.

Expected sheets (read by prisma/seed.ts): Leaderboard, ELO State, Game Scores, ELO History.
Not imported: Old Game Scores, Analytics (see the header comment in seed.ts for why).

## Known data quirk (found during validation, not a bug to fix)
One game on 2026-03-31 02:38 (Kendall +8 / Michael -8) has a base value of 4,
which doesn't correspond to any fan (3–13) in the scoring table — likely a
manual/legacy entry from before the fan system was standardized. The import
still records it correctly as a discard win with the right winner/loser and
score, just with `fan = null`. No action needed unless you want to hand-fix
its fan value in the DB afterward.
