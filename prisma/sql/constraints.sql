-- Run once after `npm run db:migrate` (Prisma's schema DSL doesn't support
-- partial indexes, so this lives outside prisma/schema.prisma).
--
-- Guarantees the app can never end up with two seasons marked active at
-- once (e.g. from a retried "End Season" click).

CREATE UNIQUE INDEX IF NOT EXISTS one_active_season
  ON seasons (is_active)
  WHERE is_active;
