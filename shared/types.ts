export interface Player {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  role?: 'CIVILIAN' | 'SPY' | 'BLANK';
  word?: string;
  isAlive: boolean;
  votedFor?: string;
  isReady?: boolean;
}

export interface GameConfig {
  spyCount: number;
  blankCount: number;
  category: string;
  useCustomWords: boolean;
  customWordPair?: { civilian: string; spy: string };
}

export interface GameState {
  phase: 'DISTRIBUTING' | 'VIEWING' | 'DESCRIBING' | 'VOTING' | 'VOTE_RESULT' | 'PK_ANNOUNCEMENT' | 'PK_DESCRIBING' | 'PK_VOTING' | 'GAME_OVER';
  currentTurnPlayerId?: string;
  phaseEndTime?: number;
  round: number;
  words: { civilian: string; spy: string };
  voteResult: Record<string, number>;
  winner?: 'CIVILIAN' | 'SPY' | 'BLANK';
  voteResultConfirmedPlayers?: string[];
  viewingConfirmedPlayers?: string[];
  pkPlayers?: string[];
}

export interface RoomData {
  id: string;
  hostId: string;
  players: Player[];
  status: 'WAITING' | 'PLAYING' | 'GAME_OVER';
  config: GameConfig;
  gameState: GameState | null;
}
