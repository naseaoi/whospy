"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const words_1 = require("./words");
class Room {
    constructor(id, hostId, hostName, hostAvatar, onUpdate) {
        this.players = [];
        this.status = 'WAITING';
        this.config = {
            spyCount: 1,
            blankCount: 0,
            category: '全部',
            useCustomWords: false
        };
        this.gameState = null;
        this.words = null;
        this.timer = null;
        this.turnOrder = []; // Array of player IDs
        this.currentTurnIndex = 0;
        // Constants for durations (in ms)
        this.DURATION_VIEWING = 15000;
        this.DURATION_DESCRIBING = 10000;
        this.id = id;
        this.hostId = hostId;
        this.onUpdate = onUpdate;
        this.addPlayer(hostId, hostName, hostAvatar);
    }
    addPlayer(id, name, avatar) {
        const player = {
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
    removePlayer(id) {
        this.players = this.players.filter(p => p.id !== id);
        if (this.status === 'WAITING' && this.players.length > 0 && id === this.hostId) {
            this.hostId = this.players[0].id; // Transfer host
        }
        // Handle disconnect during game? For MVP, we ignore complex reconnections logic updates
    }
    getPlayer(id) {
        return this.players.find(p => p.id === id);
    }
    updateConfig(config) {
        this.config = Object.assign(Object.assign({}, this.config), config);
    }
    startGame() {
        if (this.players.length < 3)
            throw new Error("人数不足");
        this.status = 'PLAYING';
        // Words Setup
        if (this.config.useCustomWords && this.config.customWordPair) {
            this.words = Object.assign(Object.assign({}, this.config.customWordPair), { category: '自定义' });
        }
        else {
            this.words = (0, words_1.getRandomWord)();
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
                p.word = this.words.spy;
            }
            else if (blankIds.has(p.id)) {
                p.role = 'BLANK';
                p.word = "";
            }
            else {
                p.role = 'CIVILIAN';
                p.word = this.words.civilian;
            }
        });
        // Use natural joining order (0, 1, 2...) for turn order instead of random shuffle
        // This maps to "Seat 1", "Seat 2" visually in the UI list
        this.turnOrder = this.players.map(p => p.id);
        // Initial Game State
        this.gameState = {
            phase: 'DISTRIBUTING', // Technically instant, but we use VIEWING
            round: 1,
            words: this.words,
            voteResult: {}
        };
        this.startViewingPhase();
    }
    startViewingPhase() {
        if (!this.gameState)
            return;
        this.gameState.phase = 'VIEWING';
        const endTime = Date.now() + this.DURATION_VIEWING;
        this.gameState.phaseEndTime = endTime;
        this.onUpdate(this.id);
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.startDescribingPhase();
        }, this.DURATION_VIEWING);
    }
    startDescribingPhase() {
        if (!this.gameState)
            return;
        this.gameState.phase = 'DESCRIBING';
        this.currentTurnIndex = 0;
        this.startTurn();
    }
    startTurn() {
        if (!this.gameState)
            return;
        // Find next alive player
        while (this.currentTurnIndex < this.turnOrder.length) {
            const playerId = this.turnOrder[this.currentTurnIndex];
            const player = this.getPlayer(playerId);
            if (player && player.isAlive) {
                break;
            }
            this.currentTurnIndex++;
        }
        // Check if round finished
        if (this.currentTurnIndex >= this.turnOrder.length) {
            this.startVotingPhase();
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
    // Called by client or timer
    finishTurn(playerId) {
        if (!this.gameState || this.gameState.phase !== 'DESCRIBING')
            return;
        if (this.gameState.currentTurnPlayerId !== playerId)
            return;
        this.clearTimer();
        this.nextTurn();
    }
    nextTurn() {
        this.currentTurnIndex++;
        this.startTurn();
    }
    startVotingPhase() {
        if (!this.gameState)
            return;
        this.gameState.phase = 'VOTING';
        this.gameState.currentTurnPlayerId = undefined;
        this.gameState.phaseEndTime = undefined;
        this.gameState.voteResult = {};
        // Clear previous votes
        this.players.forEach(p => p.votedFor = undefined);
        this.onUpdate(this.id);
        this.clearTimer();
    }
    handleVote(voterId, targetId) {
        if (!this.gameState || this.gameState.phase !== 'VOTING')
            return;
        const voter = this.getPlayer(voterId);
        const target = this.getPlayer(targetId);
        if (!voter || !voter.isAlive)
            return; // Dead players can't vote
        if (!target || !target.isAlive)
            return;
        if (voterId === targetId)
            return; // Can't vote self
        // Record vote
        voter.votedFor = targetId;
        // Check if all alive players voted
        const alivePlayers = this.players.filter(p => p.isAlive);
        const voteCount = alivePlayers.filter(p => p.votedFor).length;
        if (voteCount >= alivePlayers.length) {
            this.resolveVotes();
        }
        else {
            this.onUpdate(this.id);
        }
    }
    resolveVotes() {
        if (!this.gameState)
            return;
        // Tally votes
        const votes = {};
        this.players.forEach(p => {
            if (p.votedFor) {
                votes[p.votedFor] = (votes[p.votedFor] || 0) + 1;
            }
        });
        this.gameState.voteResult = votes;
        // Find max votes
        let maxVotes = 0;
        let targetIds = [];
        Object.entries(votes).forEach(([id, count]) => {
            if (count > maxVotes) {
                maxVotes = count;
                targetIds = [id];
            }
            else if (count === maxVotes) {
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
        }
        if (isGameOver) {
            this.status = 'GAME_OVER';
            this.gameState.phase = 'GAME_OVER';
        }
        else {
            this.gameState.phase = 'VOTE_RESULT';
            this.gameState.voteResultConfirmedPlayers = [];
        }
        this.onUpdate(this.id);
    }
    confirmVoteResult(playerId) {
        if (!this.gameState || this.gameState.phase !== 'VOTE_RESULT')
            return;
        if (!this.gameState.voteResultConfirmedPlayers)
            this.gameState.voteResultConfirmedPlayers = [];
        if (!this.gameState.voteResultConfirmedPlayers.includes(playerId)) {
            this.gameState.voteResultConfirmedPlayers.push(playerId);
        }
        // Check if all ALIVE players confirmed
        const alivePlayers = this.players.filter(p => p.isAlive);
        const confirmedCount = this.gameState.voteResultConfirmedPlayers.filter(id => {
            const p = this.getPlayer(id);
            return p && p.isAlive;
        }).length;
        if (confirmedCount >= alivePlayers.length) {
            this.gameState.round++;
            this.startDescribingPhase();
        }
        else {
            this.onUpdate(this.id);
        }
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
    checkWinCondition() {
        const spies = this.players.filter(p => p.isAlive && p.role === 'SPY');
        const civilians = this.players.filter(p => p.isAlive && (p.role === 'CIVILIAN' || p.role === 'BLANK'));
        if (spies.length === 0) {
            if (this.gameState)
                this.gameState.winner = 'CIVILIAN';
            return true;
        }
        else if (spies.length >= civilians.length) {
            if (this.gameState)
                this.gameState.winner = 'SPY';
            return true;
        }
        return false;
    }
    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    toData() {
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
exports.Room = Room;
