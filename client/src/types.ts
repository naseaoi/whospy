// Remove the server import entirely as it's not available in browser build process
// import { generateRandomName, generateRandomAvatar } from '../../server/src/utils/random';

// Define these utilities locally in client to avoid cross-project dependency issues
export const AVATARS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', 
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
  '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
  '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍',
  '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠'
];
export const NAMES = [
  "快乐的薯条", "悲伤的汉堡", "暴躁的各种", "冷酷的杀手", "迷茫的咸鱼",
  "进击的巨人", "只会喊666", "专业配角", "摸鱼达人", "熬夜冠军",
  "甚至不想起名", "路人甲", "不明生物", "外星人", "潜水员"
];

export function generateRandomName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

export function generateRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  role?: 'CIVILIAN' | 'SPY' | 'BLANK';
  word?: string;
  isAlive: boolean;
  votedFor?: string;
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
  voteResultConfirmedPlayers?: string[]; // IDs of players who confirmed the result
  pkPlayers?: string[]; // IDs of players in PK
}

export interface RoomData {
  id: string;
  hostId: string;
  players: Player[];
  status: 'WAITING' | 'PLAYING' | 'GAME_OVER';
  config: GameConfig;
  gameState: GameState | null;
}
