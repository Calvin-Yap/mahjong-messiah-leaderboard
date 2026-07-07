-- CreateEnum
CREATE TYPE "WinType" AS ENUM ('discard', 'self_draw', 'manual');

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "table_number" INTEGER,
    "fan" INTEGER,
    "win_type" "WinType",
    "winner_id" TEXT,
    "loser_id" TEXT,
    "session_id" TEXT,
    "season_id" TEXT,
    "created_by" TEXT,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_scores" (
    "game_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "game_scores_pkey" PRIMARY KEY ("game_id","player_id")
);

-- CreateTable
CREATE TABLE "elo_state" (
    "player_id" TEXT NOT NULL,
    "rating" DECIMAL(65,30) NOT NULL DEFAULT 1500,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "peak_rating" DECIMAL(65,30) NOT NULL DEFAULT 1500,
    "last5_deltas" DECIMAL(65,30)[] DEFAULT ARRAY[]::DECIMAL(65,30)[],

    CONSTRAINT "elo_state_pkey" PRIMARY KEY ("player_id")
);

-- CreateTable
CREATE TABLE "elo_history" (
    "id" BIGSERIAL NOT NULL,
    "game_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "rating_after" DECIMAL(65,30) NOT NULL,
    "delta" DECIMAL(65,30) NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elo_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "table_count" INTEGER NOT NULL DEFAULT 2,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_tables" (
    "session_id" TEXT NOT NULL,
    "table_number" INTEGER NOT NULL,
    "seat_position" INTEGER,
    "player_id" TEXT NOT NULL,

    CONSTRAINT "session_tables_pkey" PRIMARY KEY ("session_id","table_number","player_id")
);

-- CreateTable
CREATE TABLE "session_sideline" (
    "session_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,

    CONSTRAINT "session_sideline_pkey" PRIMARY KEY ("session_id","player_id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "season_number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_history" (
    "season_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "final_rank" INTEGER NOT NULL,
    "total_score" DECIMAL(65,30) NOT NULL,
    "elo_rank" INTEGER NOT NULL,
    "final_elo" DECIMAL(65,30) NOT NULL,
    "peak_elo" DECIMAL(65,30) NOT NULL,
    "games_played" INTEGER NOT NULL,
    "games_won" INTEGER NOT NULL,
    "games_lost" INTEGER NOT NULL,
    "best_win" DECIMAL(65,30) NOT NULL,
    "worst_loss" DECIMAL(65,30) NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_history_pkey" PRIMARY KEY ("season_id","player_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_name_key" ON "players"("name");

-- CreateIndex
CREATE INDEX "games_played_at_idx" ON "games"("played_at");

-- CreateIndex
CREATE INDEX "games_season_id_idx" ON "games"("season_id");

-- CreateIndex
CREATE INDEX "elo_history_player_id_played_at_idx" ON "elo_history"("player_id", "played_at");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_season_number_key" ON "seasons"("season_number");

-- CreateIndex
CREATE INDEX "season_history_player_id_idx" ON "season_history"("player_id");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_loser_id_fkey" FOREIGN KEY ("loser_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_state" ADD CONSTRAINT "elo_state_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elo_history" ADD CONSTRAINT "elo_history_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_tables" ADD CONSTRAINT "session_tables_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_tables" ADD CONSTRAINT "session_tables_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_sideline" ADD CONSTRAINT "session_sideline_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_sideline" ADD CONSTRAINT "session_sideline_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_history" ADD CONSTRAINT "season_history_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_history" ADD CONSTRAINT "season_history_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
