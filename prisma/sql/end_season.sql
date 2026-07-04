-- Run once after `npm run db:migrate`:
--   psql "$DIRECT_URL" -f prisma/sql/end_season.sql
-- (or paste into the Supabase SQL Editor).
--
-- DESIGN NOTE — why "close" and "purge" are two separate functions:
-- Given the storage math (see chat), there is no urgency to delete
-- per-game data at all. `close_season()` snapshots + starts the next
-- season and leaves all raw game data in place, tagged with season_id —
-- this is fully reversible and costs you nothing. `purge_season_data()`
-- is the literal "delete rows to reclaim space" operation from the
-- original ask, kept as a separate, manual, rarely-invoked function so
-- it can never fire as a side effect of the normal "End Season" button.
-- Only run it once you've actually confirmed a backup export succeeded.

-- ============================================================
-- close_season(): snapshot the active season, start the next one
-- ============================================================
CREATE OR REPLACE FUNCTION close_season(
  p_next_season_name TEXT,
  p_reset_elo BOOLEAN DEFAULT true  -- see ELO reset decision in chat; flip to false to carry ratings forward
)
RETURNS UUID AS $$
DECLARE
  v_active_season_id UUID;
  v_next_season_number INT;
  v_next_season_id UUID;
BEGIN
  SELECT id INTO v_active_season_id FROM seasons WHERE is_active = true LIMIT 1;
  IF v_active_season_id IS NULL THEN
    RAISE EXCEPTION 'No active season to close.';
  END IF;

  -- 1. Snapshot final standings for every player who played this season.
  --    total_score/games_won/etc. are scoped to THIS season's games only
  --    (via season_id), so this works correctly even before any purge.
  WITH season_stats AS (
    SELECT
      gs.player_id,
      SUM(gs.score)                          AS total_score,
      COUNT(*) FILTER (WHERE gs.score > 0)   AS games_won,
      COUNT(*) FILTER (WHERE gs.score < 0)   AS games_lost,
      COUNT(*)                               AS games_played,
      MAX(gs.score)                          AS best_win,
      MIN(gs.score)                          AS worst_loss
    FROM game_scores gs
    JOIN games g ON g.id = gs.game_id
    WHERE g.season_id = v_active_season_id
    GROUP BY gs.player_id
  ),
  ranked AS (
    SELECT
      s.*,
      es.rating       AS final_elo,
      es.peak_rating  AS peak_elo,
      RANK() OVER (ORDER BY s.total_score DESC) AS final_rank,
      RANK() OVER (ORDER BY es.rating DESC)     AS elo_rank
    FROM season_stats s
    LEFT JOIN elo_state es ON es.player_id = s.player_id
  )
  INSERT INTO season_history (
    season_id, player_id, final_rank, total_score, elo_rank, final_elo,
    peak_elo, games_played, games_won, games_lost, best_win, worst_loss, title
  )
  SELECT
    v_active_season_id, player_id, final_rank, total_score, elo_rank, final_elo,
    peak_elo, games_played, games_won, games_lost, best_win, worst_loss,
    -- Inline title-tier logic mirroring src/lib/titles.ts — keep the two in sync.
    CASE
      WHEN final_rank = 1 THEN 'Messiah'
      WHEN final_rank BETWEEN 2 AND 3 THEN 'Master'
      WHEN final_rank BETWEEN 4 AND 6 THEN 'Musketeer'
      WHEN final_rank BETWEEN 7 AND 10 THEN 'Marshal'
      WHEN final_rank = (SELECT COUNT(*) FROM ranked) THEN 'Moron'
      WHEN final_rank >= (SELECT COUNT(*) FROM ranked) - 2 THEN 'Mongrel'
      WHEN final_rank >= (SELECT COUNT(*) FROM ranked) - 5 THEN 'Minion'
      WHEN final_rank >= (SELECT COUNT(*) FROM ranked) - 9 THEN 'Mortal'
      ELSE 'Monk'
    END
  FROM ranked;

  -- 2. Close out the old season.
  UPDATE seasons SET is_active = false, ended_at = now() WHERE id = v_active_season_id;

  -- 3. ELO reset decision (default: full reset to 1500 — see chat for the
  --    partial-carry-forward alternative if you'd rather not fully reset).
  IF p_reset_elo THEN
    UPDATE elo_state SET rating = 1500, games_played = 0, peak_rating = 1500, last5_deltas = '{}';
  END IF;

  -- 4. Start the next season.
  SELECT COALESCE(MAX(season_number), 0) + 1 INTO v_next_season_number FROM seasons;
  INSERT INTO seasons (season_number, name, is_active)
  VALUES (v_next_season_number, p_next_season_name, true)
  RETURNING id INTO v_next_season_id;

  RETURN v_next_season_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- purge_season_data(): MANUAL, IRREVERSIBLE. Deletes raw game data
-- for an already-closed, already-snapshotted season. Only run this
-- after confirming a backup export (see README) succeeded.
-- ============================================================
CREATE OR REPLACE FUNCTION purge_season_data(p_season_id UUID)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM seasons WHERE id = p_season_id AND is_active = true) THEN
    RAISE EXCEPTION 'Refusing to purge the active season. Close it first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM season_history WHERE season_id = p_season_id) THEN
    RAISE EXCEPTION 'No season_history snapshot found for this season — refusing to purge unsnapshotted data.';
  END IF;

  DELETE FROM elo_history WHERE game_id IN (SELECT id FROM games WHERE season_id = p_season_id);
  DELETE FROM game_scores WHERE game_id IN (SELECT id FROM games WHERE season_id = p_season_id);
  DELETE FROM games WHERE season_id = p_season_id;
END;
$$ LANGUAGE plpgsql;
