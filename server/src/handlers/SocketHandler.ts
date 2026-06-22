import { Socket, Server } from 'socket.io';
import { RoomManager } from '../game/RoomManager';
import { TimerService } from '../services/TimerService';
import {
  normalizePlayerName,
  normalizeAvatar,
  normalizeRoomId,
  normalizePlayerToken
} from '../utils/validators';

export class SocketHandler {
  private socketToRoom = new Map<string, string>();

  constructor(
    private readonly io: Server,
    private readonly roomManager: RoomManager,
    private readonly timerService: TimerService
  ) {}

  handleConnection(socket: Socket): void {
    socket.on('create_room', (data) => this.handleCreateRoom(socket, data));
    socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
    socket.on('rejoin_room', (data) => this.handleRejoinRoom(socket, data));
    socket.on('start_game', () => this.handleStartGame(socket));
    socket.on('confirm_viewing', () => this.handleConfirmViewing(socket));
    socket.on('finish_turn', () => this.handleFinishTurn(socket));
    socket.on('update_config', (data) => this.handleUpdateConfig(socket, data));
    socket.on('vote', (data) => this.handleVote(socket, data));
    socket.on('confirm_vote_result', () => this.handleConfirmVoteResult(socket));
    socket.on('restart_game', () => this.handleRestartGame(socket));
    socket.on('leave_room', () => this.handleLeaveRoom(socket));
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  private handleCreateRoom(socket: Socket, { playerName, avatar, playerToken }: any): void {
    try {
      this.removeSocketFromCurrentRoom(socket);

      const safePlayerName = normalizePlayerName(playerName);
      const safeAvatar = normalizeAvatar(avatar);
      const safeToken = normalizePlayerToken(playerToken);

      const room = this.roomManager.createRoom(
        socket.id,
        safePlayerName,
        safeAvatar,
        safeToken,
        (roomId) => this.emitRoomUpdate(roomId)
      );

      this.timerService.clearRoomCleanup(room.id);
      this.timerService.clearHostTransfer(room.id);
      this.timerService.clearOfflinePlayer(room.id, safeToken);
      this.socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      socket.emit('room_created', { roomId: room.id });
      this.emitRoomUpdate(room.id);
    } catch (e: any) {
      console.error('Error creating room:', e);
      socket.emit('error', { message: e.message });
    }
  }

  private handleJoinRoom(socket: Socket, { roomId, playerName, avatar, playerToken }: any): void {
    try {
      this.removeSocketFromCurrentRoom(socket);

      const safeRoomId = normalizeRoomId(roomId);
      const safePlayerName = normalizePlayerName(playerName);
      const safeAvatar = normalizeAvatar(avatar);
      const safeToken = normalizePlayerToken(playerToken);
      const roomBeforeJoin = this.roomManager.getRoom(safeRoomId);
      const wasReconnect = !!roomBeforeJoin?.hasPlayerToken(safeToken);

      const room = this.roomManager.joinRoom(
        safeRoomId,
        socket.id,
        safePlayerName,
        safeAvatar,
        safeToken
      );

      this.timerService.clearRoomCleanup(room.id);
      this.timerService.clearHostTransfer(room.id);
      this.timerService.clearOfflinePlayer(room.id, safeToken);
      this.socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const joinedPlayer = room.getPlayer(socket.id);
      if (joinedPlayer) {
        this.emitRoomNotice(
          room.id,
          `${joinedPlayer.name}${wasReconnect ? ' 重新连接' : ' 加入了房间'}。${this.getHostLabel(room.id)}`
        );
      }
      this.emitRoomUpdate(room.id);
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  }

  private handleRejoinRoom(socket: Socket, { roomId, playerToken }: any): void {
    try {
      this.removeSocketFromCurrentRoom(socket);

      const safeRoomId = normalizeRoomId(roomId);
      const safeToken = normalizePlayerToken(playerToken);
      const room = this.roomManager.reconnectRoom(safeRoomId, socket.id, safeToken);

      this.timerService.clearRoomCleanup(room.id);
      this.timerService.clearHostTransfer(room.id);
      this.timerService.clearOfflinePlayer(room.id, safeToken);
      this.socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const rejoinPlayer = room.getPlayer(socket.id);
      if (rejoinPlayer) {
        this.emitRoomNotice(room.id, `${rejoinPlayer.name} 重新连接。${this.getHostLabel(room.id)}`);
      }
      this.emitRoomUpdate(room.id);
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  }

  private handleStartGame(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    try {
      const room = this.roomManager.getRoom(roomId);
      if (room && room.hostId === socket.id) {
        room.startGame();
        this.emitRoomUpdate(roomId);
      }
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  }

  private handleConfirmViewing(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.roomManager.getRoom(roomId);
    if (room) {
      room.confirmViewing(socket.id);
      this.emitRoomUpdate(roomId);
    }
  }

  private handleFinishTurn(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.roomManager.getRoom(roomId);
    if (room) {
      room.finishTurn(socket.id);
    }
  }

  private handleUpdateConfig(socket: Socket, { config }: any): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) {
      return;
    }

    try {
      room.updateConfig(config);
      this.emitRoomUpdate(roomId);
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  }

  private handleVote(socket: Socket, { targetPlayerId }: any): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.roomManager.getRoom(roomId);
    if (room) {
      room.handleVote(socket.id, targetPlayerId);
      this.emitRoomUpdate(roomId);
    }
  }

  private handleConfirmVoteResult(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.roomManager.getRoom(roomId);
    if (room) {
      room.confirmVoteResult(socket.id);
      this.emitRoomUpdate(roomId);
    }
  }

  private handleRestartGame(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = this.roomManager.getRoom(roomId);
    if (room && room.hostId === socket.id) {
      room.restartGame();
      this.emitRoomUpdate(roomId);
    }
  }

  private handleLeaveRoom(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (roomId) {
      const room = this.roomManager.getRoom(roomId);
      const player = room?.getPlayer(socket.id);
      if (player) {
        this.emitRoomNotice(roomId, `${player.name} 退出了房间。${this.getHostLabel(roomId)}`);
      }
    }
    this.removeSocketFromCurrentRoom(socket);
  }

  private handleDisconnect(socket: Socket): void {
    const roomId = this.socketToRoom.get(socket.id);
    if (roomId) {
      const room = this.roomManager.getRoom(roomId);
      if (room) {
        const player = room.getPlayer(socket.id);
        const playerToken = room.getPlayerToken(socket.id);
        room.markPlayerOffline(socket.id);
        if (player) {
          this.emitRoomNotice(roomId, `${player.name} 掉线了。`);
        }
        this.emitRoomUpdate(roomId);
        this.scheduleRoomCleanupIfOffline(roomId);
        this.scheduleHostTransferIfNeeded(roomId);
        if (playerToken) {
          this.scheduleOfflinePlayerRemoval(roomId, playerToken);
        }
      }
      this.socketToRoom.delete(socket.id);
    }
  }

  private removeSocketFromCurrentRoom(socket: Socket): void {
    const currentRoomId = this.socketToRoom.get(socket.id);
    if (!currentRoomId) {
      return;
    }

    socket.leave(currentRoomId);
    this.socketToRoom.delete(socket.id);

    const currentRoom = this.roomManager.getRoom(currentRoomId);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      if (currentRoom.players.length === 0) {
        this.timerService.clearRoomCleanup(currentRoomId);
        this.timerService.clearHostTransfer(currentRoomId);
        this.timerService.clearAllOfflinePlayersForRoom(currentRoomId);
        this.roomManager.deleteRoom(currentRoomId);
      } else {
        this.scheduleHostTransferIfNeeded(currentRoomId);
        this.emitRoomUpdate(currentRoomId);
      }
    }
  }

  private scheduleRoomCleanupIfOffline(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.timerService.clearRoomCleanup(roomId);
      return;
    }

    if (room.getOnlinePlayerCount() > 0) {
      this.timerService.clearRoomCleanup(roomId);
      return;
    }

    this.timerService.scheduleRoomCleanup(roomId, () => {
      const currentRoom = this.roomManager.getRoom(roomId);
      if (!currentRoom) {
        return;
      }

      if (currentRoom.getOnlinePlayerCount() === 0) {
        this.timerService.clearHostTransfer(roomId);
        this.timerService.clearAllOfflinePlayersForRoom(roomId);
        this.roomManager.deleteRoom(roomId);
      }
    });
  }

  private scheduleHostTransferIfNeeded(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.timerService.clearHostTransfer(roomId);
      return;
    }

    const host = room.getPlayer(room.hostId);
    if (!host || host.isOnline) {
      this.timerService.clearHostTransfer(roomId);
      return;
    }

    this.timerService.scheduleHostTransfer(roomId, () => {
      const currentRoom = this.roomManager.getRoom(roomId);
      if (!currentRoom) {
        return;
      }

      const transferred = currentRoom.transferHostToFirstOnline();
      if (transferred) {
        const newHost = currentRoom.getPlayer(currentRoom.hostId);
        this.emitRoomNotice(roomId, `当前房主：${newHost?.name || '未知玩家'}`);
        this.emitRoomUpdate(roomId);
      }
    });
  }

  private scheduleOfflinePlayerRemoval(roomId: string, playerToken: string): void {
    this.timerService.scheduleOfflinePlayerRemoval(roomId, playerToken, () => {
      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        return;
      }

      if (room.isPlayerOnlineByToken(playerToken)) {
        return;
      }

      room.removePlayerByToken(playerToken);

      if (room.players.length === 0) {
        this.timerService.clearRoomCleanup(roomId);
        this.timerService.clearHostTransfer(roomId);
        this.timerService.clearAllOfflinePlayersForRoom(roomId);
        this.roomManager.deleteRoom(roomId);
      } else {
        this.scheduleHostTransferIfNeeded(roomId);
        this.emitRoomNotice(roomId, `有玩家离线超时未重连，已自动退出。`);
        this.emitRoomUpdate(roomId);
      }
    });
  }

  private emitRoomUpdate(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      return;
    }

    const roomSockets = this.io.sockets.adapter.rooms.get(roomId);
    if (!roomSockets) {
      return;
    }

    roomSockets.forEach((roomSocketId) => {
      const socket = this.io.sockets.sockets.get(roomSocketId);
      if (!socket || !socket.connected) {
        return;
      }

      try {
        socket.emit('room_updated', room.toDataForPlayer(roomSocketId));
      } catch (error) {
        console.error(`Failed to emit room_updated to ${roomSocketId}:`, error);
      }
    });
  }

  private emitRoomNotice(roomId: string, message: string): void {
    this.io.to(roomId).emit('room_notice', {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      createdAt: Date.now()
    });
  }

  private getHostLabel(roomId: string): string {
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      return '当前房主未知';
    }
    const host = room.getPlayer(room.hostId);
    return `当前房主：${host?.name || '未知玩家'}`;
  }
}
