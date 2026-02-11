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
  private initialPlayerCount: number = 0; // 游戏开始时的玩家数，用于胜利阈值计算
  private tokenToPlayerId: Map<string, string> = new Map();
  private playerIdToToken: Map<string, string> = new Map();

  // Constants for durations (in ms)
  private readonly DURATION_VIEWING = 15000;
  private readonly DURATION_DESCRIBING = 10000;

  // Callback to emit updates to room
  private onUpdate: (roomId: string) => void;

  constructor(id: string, hostId: string, hostName: string, hostAvatar: string, hostToken: string, onUpdate: (id: string) => void) {
    this.id = id;
    this.hostId = hostId;
    this.onUpdate = onUpdate;
    this.addPlayer(hostId, hostName, hostAvatar, hostToken);
  }

  addPlayer(id: string, name: string, avatar: string, token: string): Player {
    if (this.tokenToPlayerId.has(token)) {
      throw new Error('该身份已在房间中');
    }

    const player: Player = {
      id,
      name,
      avatar,
      isOnline: true,
      isAlive: true,
      isReady: false
    };
    this.players.push(player);
    this.tokenToPlayerId.set(token, id);
    this.playerIdToToken.set(id, token);
    return player;
  }

  removePlayer(id: string) {
    const token = this.playerIdToToken.get(id);
    if (token) {
      this.playerIdToToken.delete(id);
      this.tokenToPlayerId.delete(token);
    }

    const phase = this.gameState?.phase;
    const wasCurrentTurn = this.gameState?.currentTurnPlayerId === id;
    const isInGame = this.status === 'PLAYING' && !!this.gameState && phase !== 'GAME_OVER';

    // 修正 turnOrder 删人时的 currentTurnIndex 偏移
    const indexInTurnOrder = this.turnOrder.indexOf(id);
    if (indexInTurnOrder !== -1) {
      this.turnOrder.splice(indexInTurnOrder, 1);
      // 如果被移除的玩家在当前发言者之前，索引需要回退以避免跳过下一个玩家
      if (indexInTurnOrder < this.currentTurnIndex) {
        this.currentTurnIndex--;
      }
    }

    this.players = this.players.filter(p => p.id !== id);

    if (this.players.length > 0 && id === this.hostId) {
      const nextHost = this.getNextHostCandidate();
      if (nextHost) {
        this.hostId = nextHost.id;
      }
    }

    if (wasCurrentTurn && this.gameState) {
      this.gameState.currentTurnPlayerId = undefined;
    }

    if (this.gameState?.pkPlayers) {
      this.gameState.pkPlayers = this.gameState.pkPlayers.filter(playerId => playerId !== id);
    }

    if (this.gameState?.voteResult[id] !== undefined) {
      delete this.gameState.voteResult[id];
    }

    if (this.gameState?.voteResultConfirmedPlayers) {
      this.gameState.voteResultConfirmedPlayers = this.gameState.voteResultConfirmedPlayers.filter(
        playerId => playerId !== id
      );
    }

    // 清除投给被移除玩家的票
    this.players.forEach(player => {
      if (player.votedFor === id) {
        player.votedFor = undefined;
      }
    });

    // ---- 游戏进行中的善后处理 ----
    if (!isInGame || this.players.length === 0) {
      return;
    }

    // 先检查胜负条件（玩家被移除可能直接触发胜负）
    if (this.checkWinCondition()) {
      this.clearTimer();
      this.status = 'GAME_OVER';
      this.gameState!.phase = 'GAME_OVER';
      this.onUpdate(this.id);
      return;
    }

    // 存活玩家不足以继续游戏（少于2人）
    const aliveCount = this.players.filter(p => p.isAlive).length;
    if (aliveCount < 2) {
      this.clearTimer();
      this.status = 'GAME_OVER';
      this.gameState!.phase = 'GAME_OVER';
      // 只剩1人且是平民阵营则平民胜
      const lastAlive = this.players.find(p => p.isAlive);
      if (lastAlive) {
        this.gameState!.winner = lastAlive.role === 'SPY' ? 'SPY' : (lastAlive.role === 'BLANK' ? 'BLANK' : 'CIVILIAN');
      }
      this.onUpdate(this.id);
      return;
    }

    // 根据当前阶段做善后推进
    switch (phase) {
      case 'DESCRIBING':
      case 'PK_DESCRIBING':
        // PK 阶段所有 PK 玩家被移除 → 跳过 PK，直接进入下一轮
        if (phase === 'PK_DESCRIBING' && this.gameState!.pkPlayers && this.gameState!.pkPlayers.length <= 1) {
          this.clearTimer();
          this.gameState!.pkPlayers = undefined;
          this.gameState!.phase = 'VOTE_RESULT';
          this.gameState!.voteResultConfirmedPlayers = [];
          this.onUpdate(this.id);
          break;
        }
        // 当前发言者被移除 → 清除定时器，立即推进到下一个回合
        if (wasCurrentTurn) {
          this.clearTimer();
          // 不需要 nextTurn (会 currentTurnIndex++)，因为索引已修正到正确位置
          this.startTurn();
        }
        break;

      case 'VOTING':
      case 'PK_VOTING':
        // PK 投票阶段 PK 玩家全被移除 → 跳过 PK
        if (phase === 'PK_VOTING' && this.gameState!.pkPlayers && this.gameState!.pkPlayers.length <= 1) {
          this.gameState!.pkPlayers = undefined;
          this.gameState!.phase = 'VOTE_RESULT';
          this.gameState!.voteResultConfirmedPlayers = [];
          this.onUpdate(this.id);
          break;
        }
        // 投票阶段有票被清除，重新检查是否所有在线存活玩家都已投票
        this.tryResolveVotingIfReady();
        break;

      case 'VOTE_RESULT':
        // 确认阶段有人被移除，重新检查是否所有在线存活玩家都已确认
        this.tryAdvanceVoteResultIfReady();
        break;

      case 'PK_ANNOUNCEMENT':
        // PK 公告阶段 PK 玩家全被移除 → 跳过 PK
        if (this.gameState!.pkPlayers && this.gameState!.pkPlayers.length <= 1) {
          this.clearTimer();
          this.gameState!.pkPlayers = undefined;
          this.gameState!.phase = 'VOTE_RESULT';
          this.gameState!.voteResultConfirmedPlayers = [];
          this.onUpdate(this.id);
        }
        break;

      case 'VIEWING':
        // 看词阶段不需要特殊处理，定时器会自动推进
        break;
    }
  }

  getPlayer(id: string) {
    return this.players.find(p => p.id === id);
  }

  getPlayerToken(playerId: string) {
    return this.playerIdToToken.get(playerId);
  }

  hasPlayerToken(token: string) {
    return this.tokenToPlayerId.has(token);
  }

  isPlayerOnlineByToken(token: string) {
    const playerId = this.tokenToPlayerId.get(token);
    if (!playerId) {
      return false;
    }

    const player = this.getPlayer(playerId);
    return !!player && player.isOnline;
  }

  removePlayerByToken(token: string) {
    const playerId = this.tokenToPlayerId.get(token);
    if (!playerId) {
      return;
    }
    this.removePlayer(playerId);
  }

  reconnectPlayer(token: string, newPlayerId: string) {
    const oldPlayerId = this.tokenToPlayerId.get(token);
    if (!oldPlayerId) {
      throw new Error('玩家身份不存在');
    }

    const player = this.getPlayer(oldPlayerId);
    if (!player) {
      this.tokenToPlayerId.delete(token);
      this.playerIdToToken.delete(oldPlayerId);
      throw new Error('玩家数据异常，请重新加入房间');
    }

    if (oldPlayerId === newPlayerId) {
      player.isOnline = true;
      return;
    }

    player.id = newPlayerId;
    player.isOnline = true;

    this.playerIdToToken.delete(oldPlayerId);
    this.playerIdToToken.set(newPlayerId, token);
    this.tokenToPlayerId.set(token, newPlayerId);

    if (this.hostId === oldPlayerId) {
      this.hostId = newPlayerId;
    }

    this.turnOrder = this.turnOrder.map(playerId => (playerId === oldPlayerId ? newPlayerId : playerId));

    if (this.gameState?.currentTurnPlayerId === oldPlayerId) {
      this.gameState.currentTurnPlayerId = newPlayerId;
    }

    if (this.gameState?.pkPlayers) {
      this.gameState.pkPlayers = this.gameState.pkPlayers.map(playerId => (playerId === oldPlayerId ? newPlayerId : playerId));
    }

    if (this.gameState?.voteResult[oldPlayerId] !== undefined) {
      this.gameState.voteResult[newPlayerId] = this.gameState.voteResult[oldPlayerId];
      delete this.gameState.voteResult[oldPlayerId];
    }

    this.players.forEach(currentPlayer => {
      if (currentPlayer.votedFor === oldPlayerId) {
        currentPlayer.votedFor = newPlayerId;
      }
    });

    if (this.gameState?.voteResultConfirmedPlayers) {
      this.gameState.voteResultConfirmedPlayers = this.gameState.voteResultConfirmedPlayers.map(
        playerId => (playerId === oldPlayerId ? newPlayerId : playerId)
      );
    }
  }

  markPlayerOffline(playerId: string) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return;
    }
    player.isOnline = false;

    if (this.gameState?.phase === 'VOTING' || this.gameState?.phase === 'PK_VOTING') {
      this.tryResolveVotingIfReady();
      return;
    }

    if (this.gameState?.phase === 'VOTE_RESULT') {
      this.tryAdvanceVoteResultIfReady();
    }
  }

  getOnlinePlayerCount() {
    return this.players.filter(player => player.isOnline).length;
  }

  updateConfig(config: Partial<GameConfig>) {
    const nextConfig = { ...this.config, ...config };
    this.validateConfig(nextConfig);
    this.config = nextConfig;
  }

  startGame() {
    if (this.players.length < 3) throw new Error("人数不足");
    this.validateConfig(this.config);
    this.status = 'PLAYING';
    this.initialPlayerCount = this.players.length;
    
    // Fisher-Yates 洗牌（座位随机化）
    this.shuffleArray(this.players);

    // Words Setup
    if (this.config.useCustomWords && this.config.customWordPair && this.config.customWordPair.civilian && this.config.customWordPair.spy) {
      this.words = { ...this.config.customWordPair, category: '自定义' };
    } else {
      this.words = getRandomWord();
    }
    
    // Role Assignment
    const spies = this.config.spyCount;
    const blanks = this.config.blankCount;
    
    // Fisher-Yates 洗牌（角色分配）
    const shuffledForRoles = this.players.map(p => p.id);
    this.shuffleArray(shuffledForRoles);
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
    this.tryResolveVotingIfReady();
  }

  private resolveVotes() {
    if (!this.gameState) return;
    
    // Tally votes - 只统计存活玩家的投票
    const votes: Record<string, number> = {};
    this.players.forEach(p => {
        if (p.isAlive && p.votedFor) {
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
          
          this.tryAdvanceVoteResultIfReady();
      } 
      // Handle PK Announcement confirmation - Removed manual confirmation logic as it's now auto
  }

  transferHostToFirstOnline(): boolean {
    const currentHost = this.getPlayer(this.hostId);
    if (!currentHost || currentHost.isOnline) {
      return false;
    }

    const nextHost = this.getNextHostCandidate();
    if (!nextHost || nextHost.id === this.hostId) {
      return false;
    }

    this.hostId = nextHost.id;
    return true;
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
    this.clearTimer();
    this.status = 'WAITING';
    this.gameState = null;
    this.initialPlayerCount = 0;
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
      // 使用游戏开始时的玩家数计算阈值，避免中途退出影响判定
      const totalInitialPlayers = this.initialPlayerCount || this.players.length;
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

  private getNextHostCandidate(): Player | undefined {
    return this.players.find(player => player.isOnline) || this.players[0];
  }

  private getVotingParticipants(): Player[] {
    return this.players.filter(player => player.isAlive && player.isOnline);
  }

  private tryResolveVotingIfReady() {
    if (!this.gameState || (this.gameState.phase !== 'VOTING' && this.gameState.phase !== 'PK_VOTING')) {
      return;
    }

    const votingParticipants = this.getVotingParticipants();
    if (votingParticipants.length === 0) {
      this.onUpdate(this.id);
      return;
    }

    const voteCount = votingParticipants.filter(player => player.votedFor).length;
    if (voteCount >= votingParticipants.length) {
      this.resolveVotes();
      return;
    }

    this.onUpdate(this.id);
  }

  private tryAdvanceVoteResultIfReady() {
    if (!this.gameState || this.gameState.phase !== 'VOTE_RESULT') {
      return;
    }

    const votingParticipants = this.getVotingParticipants();
    if (votingParticipants.length === 0) {
      this.onUpdate(this.id);
      return;
    }

    const confirmedCount = (this.gameState.voteResultConfirmedPlayers || []).filter(id => {
      const player = this.getPlayer(id);
      return player && player.isAlive && player.isOnline;
    }).length;

    if (confirmedCount >= votingParticipants.length) {
      this.gameState.round++;
      this.turnOrder = this.players.map(p => p.id);
      this.startDescribingPhase();
      return;
    }

    this.onUpdate(this.id);
  }

  dispose() {
    this.clearTimer();
  }

  /** Fisher-Yates 原地洗牌，保证均匀随机分布 */
  private shuffleArray<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private validateConfig(config: GameConfig) {
    if (!Number.isInteger(config.spyCount) || config.spyCount < 1) {
      throw new Error('卧底人数必须是大于等于 1 的整数');
    }

    if (!Number.isInteger(config.blankCount) || config.blankCount < 0) {
      throw new Error('白板人数必须是大于等于 0 的整数');
    }

    const maxSpecialRoles = this.players.length - 1;
    if (config.spyCount + config.blankCount > maxSpecialRoles) {
      throw new Error('卧底和白板总人数不能超过玩家人数减 1');
    }

    if (config.useCustomWords) {
      const civilian = config.customWordPair?.civilian?.trim();
      const spy = config.customWordPair?.spy?.trim();
      if (!civilian || !spy) {
        throw new Error('开启自定义词语时，平民词和卧底词不能为空');
      }
      if (civilian === spy) {
        throw new Error('平民词和卧底词不能相同');
      }
    }
  }

  private toVisiblePlayer(viewerId: string, revealAll: boolean, player: Player): Player {
    if (revealAll || player.id === viewerId) {
      return { ...player };
    }

    return {
      ...player,
      role: undefined,
      word: undefined
    };
  }

  toDataForPlayer(viewerId: string): RoomData {
    const revealAll = this.status === 'GAME_OVER' || this.gameState?.phase === 'GAME_OVER';
    const safeGameState = this.gameState
      ? {
          ...this.gameState,
          words: revealAll ? this.gameState.words : { civilian: '', spy: '' }
        }
      : null;

    return {
      id: this.id,
      hostId: this.hostId,
      players: this.players.map(player => this.toVisiblePlayer(viewerId, revealAll, player)),
      status: this.status,
      config: this.config,
      gameState: safeGameState
    };
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
