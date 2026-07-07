export interface PlayerDTO {
  id: string;
  name: string;
  icon: string | null;
}

export interface LeaderboardRowDTO {
  id: string;
  name: string;
  icon: string | null;
  title: string; // Messiah / Master / Musketeer / Marshal / Monk / Mongrel / Minion / Mortal / Moron
  totalScore: number;
  totalScoreRank: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winLossRatio: number;
  winLossRank: number;
  bestWin: number;
  worstLoss: number;
  eloRating: number;
  eloRank: number;
  eloPeak: number;
  eloLast5: number;
}

export interface SessionTableDTO {
  tableNumber: number;
  players: PlayerDTO[]; // 0-4 seated players
}

export interface SessionStateDTO {
  id: string;
  active: boolean;
  tableCount: number;
  tables: SessionTableDTO[];
  sideline: PlayerDTO[];
}

export interface CumulativeScorePoint {
  time: string;
  cumulative: number[]; // aligned to `players` order
  ranks: number[];
}

export interface DashboardScoresDTO {
  players: string[];
  data: CumulativeScorePoint[];
}

export interface EloHistoryPoint {
  time: string;
  ratings: (number | null)[]; // null = player didn't play that game
}

export interface EloHistoryDTO {
  players: string[];
  data: EloHistoryPoint[];
}

export interface NetworkGameRow {
  playedAt: string;
  scoresByPlayer: Record<string, number | null>; // null = didn't play
}

export interface NetworkDataDTO {
  players: string[];
  rows: NetworkGameRow[];
}

export interface GameScoreEntryDTO {
  playerId: string;
  playerName: string;
  icon: string | null;
  score: number;
}

export interface GameRowDTO {
  id: string;
  playedAt: string;
  tableNumber: number | null;
  fan: number | null;
  winType: "discard" | "self_draw" | "draw" | "manual" | null;
  winnerId: string | null;
  winnerName: string | null;
  loserId: string | null;
  loserName: string | null;
  scores: GameScoreEntryDTO[];
}

export interface GamesListDTO {
  games: GameRowDTO[];
  total: number;
  page: number;
  pageSize: number;
}
