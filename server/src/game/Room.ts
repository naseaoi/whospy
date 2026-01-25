import { RoomData, Player, GameConfig, GameState } from '../types';
import { getRandomWord, WordPair } from './words';

export class Room {
  id: string;
  hostId: string;
  players: Player[] = [];
  status: 'WAITING' | 'PLAYING' | 'GAME_OVER' = 'WAITING';
  config: GameConfig = {
    spyCount: 1,
    blankCount: 0,
    category: '全部',
    useCustomWords: false
  };
  gameState: GameState | null = null;
  
  private words: WordPair | null = null;
  private timer: NodeJS.Timeout | null = null;
  private turnOrder: string[] = []; // Array of player IDs
  private currentTurnIndex: number = 0;

  // Constants for durations (in ms)
  private readonly DURATION_VIEWING = 15000;
  private readonly DURATION_DESCRIBING = 10000;

  // Callback to emit updates to room
  private onUpdate: (roomId: string) => void;

  constructor(id: string, hostId: string, hostName: string, hostAvatar: string, onUpdate: (id: string) => void) {
    this.id = id;
    this.hostId = hostId;
    this.onUpdate = onUpdate;
    this.addPlayer(hostId, hostName, hostAvatar);
  }

  addPlayer(id: string, name: string, avatar: string): Player {
    const player: Player = {
      id,
      name,
      avatar,
      isOnline: true,
      isAlive: true,
      isReady: false
    };
    this.players.push(player);
    return player;
  }

  removePlayer(id: string) {
    this.players = this.players.filter(p => p.id !== id);
    if (this.status === 'WAITING' && this.players.length > 0 && id === this.hostId) {
      this.hostId = this.players[0].id; // Transfer host
    }
    // Handle disconnect during game? For MVP, we ignore complex reconnections logic updates
  }

  getPlayer(id: string) {
    return this.players.find(p => p.id === id);
  }

  updateConfig(config: Partial<GameConfig>) {
    this.config = { ...this.config, ...config };
  }

  startGame() {
    if (this.players.length < 3) throw new Error("人数不足");
    this.status = 'PLAYING';
    
    // Shuffle players for seat randomization
    this.players = this.players.sort(() => Math.random() - 0.5);

    // Words Setup
    if (this.config.useCustomWords && this.config.customWordPair && this.config.customWordPair.civilian && this.config.customWordPair.spy) {
      this.words = { ...this.config.customWordPair, category: '自定义' };
    } else {
      this.words = getRandomWord();
    }
    
    // Role Assignment
    const spies = this.config.spyCount;
    const blanks = this.config.blankCount;
    
    // Shuffle for roles
    const shuffledForRoles = [...this.players].map(p => p.id).sort(() => Math.random() - 0.5);
    const spyIds = new Set(shuffledForRoles.slice(0, spies));
    const blankIds = new Set(shuffledForRoles.slice(spies, spies + blanks));

    this.players.forEach(p => {
      p.isAlive = true;
      p.votedFor = undefined;
      if (spyIds.has(p.id)) {
        p.role = 'SPY';
        p.word = this.words!.spy;
      } else if (blankIds.has(p.id)) {
        p.role = 'BLANK';
        p.word = "";
      } else {
        p.role = 'CIVILIAN';
        p.word = this.words!.civilian;
      }
    });

    // Use natural joining order (0, 1, 2...) for turn order instead of random shuffle
    // This maps to "Seat 1", "Seat 2" visually in the UI list
    this.turnOrder = this.players.map(p => p.id);

    // Initial Game State
    this.gameState = {
      phase: 'DISTRIBUTING', // Technically instant, but we use VIEWING
      round: 1,
      words: this.words!,
      voteResult: {}
    };

    this.startViewingPhase();
  }

  private startViewingPhase() {
    if (!this.gameState) return;
    this.gameState.phase = 'VIEWING';
    const endTime = Date.now() + this.DURATION_VIEWING;
    this.gameState.phaseEndTime = endTime;
    
    this.onUpdate(this.id);

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.startDescribingPhase();
    }, this.DURATION_VIEWING);
  }

  private startDescribingPhase() {
    if (!this.gameState) return;
    this.gameState.phase = 'DESCRIBING';
    this.currentTurnIndex = 0;
    this.startTurn();
  }



  private startVotingPhase() {
    if (!this.gameState) return;
    this.gameState.phase = 'VOTING';
    this.gameState.currentTurnPlayerId = undefined;
    this.gameState.phaseEndTime = undefined;
    this.gameState.voteResult = {};
    
    // Clear previous votes
    this.players.forEach(p => p.votedFor = undefined);

    this.onUpdate(this.id);
    this.clearTimer();
  }

  handleVote(voterId: string, targetId: string) {
    if (!this.gameState || (this.gameState.phase !== 'VOTING' && this.gameState.phase !== 'PK_VOTING')) return;
    
    // In PK Voting, can only vote for PK players
    if (this.gameState.phase === 'PK_VOTING') {
        if (!this.gameState.pkPlayers?.includes(targetId)) return;
    }
    
    const voter = this.getPlayer(voterId);
    const target = this.getPlayer(targetId);

    if (!voter || !voter.isAlive) return; // Dead players can't vote
    if (!target || !target.isAlive) return;
    if (voterId === targetId) return; // Can't vote self

    // Record vote
    voter.votedFor = targetId;
    
    // Check if all alive players voted
    const alivePlayers = this.players.filter(p => p.isAlive);
    const voteCount = alivePlayers.filter(p => p.votedFor).length;

    if (voteCount >= alivePlayers.length) {
      this.resolveVotes();
    } else {
        this.onUpdate(this.id);
    }
  }

  private resolveVotes() {
    if (!this.gameState) return;
    
    // Tally votes
    const votes: Record<string, number> = {};
    this.players.forEach(p => {
        if (p.votedFor) {
            votes[p.votedFor] = (votes[p.votedFor] || 0) + 1;
        }
    });
    this.gameState.voteResult = votes;

    // Find max votes
    let maxVotes = 0;
    let targetIds: string[] = [];
    Object.entries(votes).forEach(([id, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            targetIds = [id];
        } else if (count === maxVotes) {
            targetIds.push(id);
        }
    });

    let isGameOver = false;

    // Eliminate or PK
    if (targetIds.length === 1) {
        const eliminatedId = targetIds[0];
        const eliminatedPlayer = this.getPlayer(eliminatedId);
        if (eliminatedPlayer) {
            eliminatedPlayer.isAlive = false;
        }
        isGameOver = this.checkWinCondition();
        
        if (isGameOver) {
            this.status = 'GAME_OVER';
            this.gameState.phase = 'GAME_OVER';
        } else {
            this.gameState.phase = 'VOTE_RESULT';
            this.gameState.voteResultConfirmedPlayers = [];
        }
    } else {
        // Handle Tie (PK)
        // If we are ALREADY in PK_VOTING and still tie, we probably should just move on or random elim?
        // Standard rule: If PK again, usually keep everyone or eliminate all tied (but that ends game too fast).
        // For this implementation: If Tie in PK_VOTING, we just proceed to next round without elimination to avoid infinite loops.
        
        if (this.gameState.phase === 'PK_VOTING') {
             // Second Tie (during PK) -> No elimination, proceed to next round
             // Need check win condition here? Theoretically possible if someone disconnected/died? 
             // Unlikely but safe to check.
             isGameOver = this.checkWinCondition();
             
             if (isGameOver) {
                this.status = 'GAME_OVER';
                this.gameState.phase = 'GAME_OVER';
             } else {
                this.gameState.phase = 'VOTE_RESULT';
                this.gameState.voteResultConfirmedPlayers = [];
                this.gameState.pkPlayers = undefined; // Clear PK state
             }
        } else {
            // First Tie -> Enter PK Announcement
            this.gameState.pkPlayers = targetIds;
            this.gameState.phase = 'PK_ANNOUNCEMENT';
            this.gameState.voteResultConfirmedPlayers = [];
            const announcementDuration = 5000;
            this.gameState.phaseEndTime = Date.now() + announcementDuration;
            this.onUpdate(this.id);
            
            // Auto transition to PK_DESCRIBING
            this.clearTimer();
            this.timer = setTimeout(() => {
                if (!this.gameState || this.gameState.phase !== 'PK_ANNOUNCEMENT') return;
                
                this.gameState.phase = 'PK_DESCRIBING';
                this.currentTurnIndex = 0;
                // Filter turnOrder to only include PK players
                this.turnOrder = this.players.map(p => p.id).filter(id => this.gameState!.pkPlayers!.includes(id));
                
                this.onUpdate(this.id);
                this.startTurn();
            }, announcementDuration);

            return; 
        }
    }
    
    this.onUpdate(this.id);
  }

  confirmVoteResult(playerId: string) {
      if (!this.gameState) return;
      
      // Handle normal vote result confirmation
      if (this.gameState.phase === 'VOTE_RESULT') {
          if (!this.gameState.voteResultConfirmedPlayers) this.gameState.voteResultConfirmedPlayers = [];
          if (!this.gameState.voteResultConfirmedPlayers.includes(playerId)) {
              this.gameState.voteResultConfirmedPlayers.push(playerId);
          }
          
          const alivePlayers = this.players.filter(p => p.isAlive);
          const confirmedCount = this.gameState.voteResultConfirmedPlayers.filter(id => {
              const p = this.getPlayer(id);
              return p && p.isAlive;
          }).length;

          if (confirmedCount >= alivePlayers.length) {
              this.gameState.round++;
              this.turnOrder = this.players.map(p => p.id);
              this.startDescribingPhase();
          } else {
              this.onUpdate(this.id);
          }
      } 
      // Handle PK Announcement confirmation - Removed manual confirmation logic as it's now auto
  }

  finishTurn(playerId: string) {
    if (!this.gameState || (this.gameState.phase !== 'DESCRIBING' && this.gameState.phase !== 'PK_DESCRIBING')) return;
    if (this.gameState.currentTurnPlayerId !== playerId) return;
    
    this.clearTimer();
    this.nextTurn();
  }

  private nextTurn() {
    this.currentTurnIndex++;
    this.startTurn();
  }

  private startTurn() {
    if (!this.gameState) return;
    
    // For PK_DESCRIBING, we only iterate through the reduced turnOrder (which only contains PK players)
    // For normal DESCRIBING, turnOrder contains all players, but we skip dead ones.

    // Find next valid player
    while (this.currentTurnIndex < this.turnOrder.length) {
      const playerId = this.turnOrder[this.currentTurnIndex];
      const player = this.getPlayer(playerId);
      if (player && player.isAlive) {
        break;
      }
      this.currentTurnIndex++;
    }

    // Check if phase finished
    if (this.currentTurnIndex >= this.turnOrder.length) {
      if (this.gameState.phase === 'PK_DESCRIBING') {
          this.startVotingPhase(); // Go back to voting, but technically this is PK Voting
          // Note: Standard voting logic handles "voting for anyone", but usually PK vote is restricted to PK targets.
          // For simplicity/MVP: Let's assume PK vote allows voting for ANYONE or just PK targets?
          // Rule: "进行PK投票". Usually means voting ONLY for the PK players.
          // We should restrict voting targets in handleVote if phase is PK_VOTING.
          // Let's create a distinct PK_VOTING phase to differentiate.
          this.gameState.phase = 'PK_VOTING'; 
          // Reset votes
          this.players.forEach(p => p.votedFor = undefined);
          this.gameState.voteResult = {};
          this.onUpdate(this.id);
          this.clearTimer();
      } else {
          this.startVotingPhase();
      }
      return;
    }

    const currentPlayerId = this.turnOrder[this.currentTurnIndex];
    this.gameState.currentTurnPlayerId = currentPlayerId;
    const endTime = Date.now() + this.DURATION_DESCRIBING;
    this.gameState.phaseEndTime = endTime;

    this.onUpdate(this.id);

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.nextTurn();
    }, this.DURATION_DESCRIBING);
  }

  restartGame() {
    this.status = 'WAITING';
    this.gameState = null;
    this.players.forEach(p => {
        // p.isReady = false; // Removed readiness check for now
        p.role = undefined;
        p.word = undefined;
        p.votedFor = undefined;
        p.isAlive = true;
    });
    this.onUpdate(this.id);
  }

  private checkWinCondition(): boolean {
      const spies = this.players.filter(p => p.isAlive && p.role === 'SPY');
      const blanks = this.players.filter(p => p.isAlive && p.role === 'BLANK');
      const civilians = this.players.filter(p => p.isAlive && p.role === 'CIVILIAN');
      const totalAlive = spies.length + blanks.length + civilians.length;
      
      // 平民获胜：所有卧底及白板出局
      if (spies.length === 0 && blanks.length === 0) {
          if (this.gameState) this.gameState.winner = 'CIVILIAN';
          return true;
      }

      // 卧底获胜
      // 游戏人数少于7人时，卧底在只剩2人时存活即获胜
      // 游戏人数大于等于7人时，卧底在只剩3人时存活即获胜
      const totalInitialPlayers = this.players.length;
      const threshold = totalInitialPlayers < 7 ? 2 : 3;

      if (spies.length > 0 && totalAlive <= threshold) {
           if (this.gameState) this.gameState.winner = 'SPY';
           return true;
      }
      
      // 白板获胜：所有卧底出局且白板存活，且存活人数达到胜利条件
      if (spies.length === 0 && blanks.length > 0) {
           // 如果还有白板，必须等到人数减少到阈值才算白板获胜
           if (totalAlive <= threshold) {
                if (this.gameState) this.gameState.winner = 'BLANK';
                return true;
           }
           // 否则游戏继续
           return false;
      }

      return false;
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  toData(): RoomData {
    return {
      id: this.id,
      hostId: this.hostId,
      players: this.players,
      status: this.status,
      config: this.config,
      gameState: this.gameState
    };
  }
}
