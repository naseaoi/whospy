import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { RoomManager } from './game/RoomManager';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
];

const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

const isOriginAllowed = (origin?: string) => {
  if (!origin) {
    return true;
  }
  // 生产部署时（通过反代访问），如果没有手动配置 CORS_ORIGIN，
  // 自动放行所有 origin，因为客户端由同一个 Node 进程托管
  if (configuredOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    return true;
  }
  return allowedOrigins.includes(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin not allowed'));
  }
}));

// Serve static files from client/dist
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Socket origin not allowed'));
    },
    methods: ["GET", "POST"]
  }
});

const roomManager = new RoomManager();
const ROOM_RECONNECT_GRACE_MS = parseInt(process.env.ROOM_RECONNECT_GRACE_MS || '120000', 10);
const HOST_TRANSFER_GRACE_MS = parseInt(process.env.HOST_TRANSFER_GRACE_MS || '30000', 10);
const OFFLINE_PLAYER_REMOVE_MS = parseInt(process.env.OFFLINE_PLAYER_REMOVE_MS || '10000', 10);

// Map socketId to roomId for quick lookup
const socketToRoom = new Map<string, string>();
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();
const hostTransferTimers = new Map<string, NodeJS.Timeout>();
const offlinePlayerTimers = new Map<string, NodeJS.Timeout>();

const normalizePlayerName = (value: unknown): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error('昵称不能为空');
  }
  return trimmed.slice(0, 20);
};

const normalizeAvatar = (value: unknown): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error('头像不能为空');
  }
  return trimmed.slice(0, 16);
};

const normalizeRoomId = (value: unknown): string => {
  const roomId = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{6}$/.test(roomId)) {
    throw new Error('房间号格式错误');
  }
  return roomId;
};

const normalizePlayerToken = (value: unknown): string => {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(token)) {
    throw new Error('身份令牌无效，请刷新页面重试');
  }
  return token;
};

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  // Helper to send room update
  const emitRoomUpdate = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (!roomSockets) {
        return;
      }

      roomSockets.forEach(roomSocketId => {
        io.to(roomSocketId).emit('room_updated', room.toDataForPlayer(roomSocketId));
      });
    }
  };

  const emitRoomNotice = (roomId: string, message: string) => {
    io.to(roomId).emit('room_notice', {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message,
      createdAt: Date.now()
    });
  };

  const getHostLabel = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return '当前房主未知';
    }
    const host = room.getPlayer(room.hostId);
    return `当前房主：${host?.name || '未知玩家'}`;
  };

  const clearRoomCleanupTimer = (roomId: string) => {
    const timer = roomCleanupTimers.get(roomId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    roomCleanupTimers.delete(roomId);
  };

  const clearHostTransferTimer = (roomId: string) => {
    const timer = hostTransferTimers.get(roomId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    hostTransferTimers.delete(roomId);
  };

  const getOfflineTimerKey = (roomId: string, playerToken: string) => `${roomId}:${playerToken}`;

  const clearOfflinePlayerTimer = (roomId: string, playerToken: string) => {
    const key = getOfflineTimerKey(roomId, playerToken);
    const timer = offlinePlayerTimers.get(key);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    offlinePlayerTimers.delete(key);
  };

  const clearOfflineTimersForRoom = (roomId: string) => {
    const prefix = `${roomId}:`;
    for (const [key, timer] of offlinePlayerTimers.entries()) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      clearTimeout(timer);
      offlinePlayerTimers.delete(key);
    }
  };

  const scheduleOfflinePlayerRemoval = (roomId: string, playerToken: string) => {
    const key = getOfflineTimerKey(roomId, playerToken);
    if (offlinePlayerTimers.has(key)) {
      return;
    }

    const timer = setTimeout(() => {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        offlinePlayerTimers.delete(key);
        return;
      }

      if (room.isPlayerOnlineByToken(playerToken)) {
        offlinePlayerTimers.delete(key);
        return;
      }

      room.removePlayerByToken(playerToken);

      if (room.players.length === 0) {
        clearRoomCleanupTimer(roomId);
        clearHostTransferTimer(roomId);
        clearOfflineTimersForRoom(roomId);
        roomManager.deleteRoom(roomId);
      } else {
        scheduleHostTransferIfNeeded(roomId);
        emitRoomNotice(roomId, `有玩家离线超时未重连，已自动退出。`);
        emitRoomUpdate(roomId);
      }

      offlinePlayerTimers.delete(key);
    }, OFFLINE_PLAYER_REMOVE_MS);

    offlinePlayerTimers.set(key, timer);
  };

  const scheduleHostTransferIfNeeded = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      clearHostTransferTimer(roomId);
      return;
    }

    const host = room.getPlayer(room.hostId);
    if (!host || host.isOnline) {
      clearHostTransferTimer(roomId);
      return;
    }

    if (hostTransferTimers.has(roomId)) {
      return;
    }

    const timer = setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomId);
      if (!currentRoom) {
        hostTransferTimers.delete(roomId);
        return;
      }

      const transferred = currentRoom.transferHostToFirstOnline();
      if (transferred) {
        const host = currentRoom.getPlayer(currentRoom.hostId);
        emitRoomNotice(roomId, `当前房主：${host?.name || '未知玩家'}`);
        emitRoomUpdate(roomId);
      }

      hostTransferTimers.delete(roomId);
    }, HOST_TRANSFER_GRACE_MS);

    hostTransferTimers.set(roomId, timer);
  };

  const scheduleRoomCleanupIfOffline = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      clearRoomCleanupTimer(roomId);
      return;
    }

    if (room.getOnlinePlayerCount() > 0) {
      clearRoomCleanupTimer(roomId);
      return;
    }

    if (roomCleanupTimers.has(roomId)) {
      return;
    }

    const timer = setTimeout(() => {
      const currentRoom = roomManager.getRoom(roomId);
      if (!currentRoom) {
        roomCleanupTimers.delete(roomId);
        return;
      }

      if (currentRoom.getOnlinePlayerCount() === 0) {
        clearHostTransferTimer(roomId);
        clearOfflineTimersForRoom(roomId);
        roomManager.deleteRoom(roomId);
      }

      roomCleanupTimers.delete(roomId);
    }, ROOM_RECONNECT_GRACE_MS);

    roomCleanupTimers.set(roomId, timer);
  };

  const removeSocketFromCurrentRoom = () => {
    const currentRoomId = socketToRoom.get(socket.id);
    if (!currentRoomId) {
      return;
    }

    socket.leave(currentRoomId);
    socketToRoom.delete(socket.id);

    const currentRoom = roomManager.getRoom(currentRoomId);
    if (currentRoom) {
      currentRoom.removePlayer(socket.id);
      if (currentRoom.players.length === 0) {
        clearRoomCleanupTimer(currentRoomId);
        clearHostTransferTimer(currentRoomId);
        clearOfflineTimersForRoom(currentRoomId);
        roomManager.deleteRoom(currentRoomId);
      } else {
        scheduleHostTransferIfNeeded(currentRoomId);
        emitRoomUpdate(currentRoomId);
      }
    }
  };

  socket.on('create_room', ({ playerName, avatar, playerToken }) => {
    console.log('Received create_room:', { socketId: socket.id, playerName, avatar });
    try {
      removeSocketFromCurrentRoom();

      const safePlayerName = normalizePlayerName(playerName);
      const safeAvatar = normalizeAvatar(avatar);
      const safeToken = normalizePlayerToken(playerToken);

      const room = roomManager.createRoom(socket.id, safePlayerName, safeAvatar, safeToken, emitRoomUpdate);
      clearRoomCleanupTimer(room.id);
      clearHostTransferTimer(room.id);
      clearOfflinePlayerTimer(room.id, safeToken);
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      socket.emit('room_created', { roomId: room.id });
      emitRoomUpdate(room.id);
    } catch (e: any) {
      console.error('Error creating room:', e);
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('join_room', ({ roomId, playerName, avatar, playerToken }) => {
    try {
      removeSocketFromCurrentRoom();

      const safeRoomId = normalizeRoomId(roomId);
      const safePlayerName = normalizePlayerName(playerName);
      const safeAvatar = normalizeAvatar(avatar);
      const safeToken = normalizePlayerToken(playerToken);
      const roomBeforeJoin = roomManager.getRoom(safeRoomId);
      const wasReconnect = !!roomBeforeJoin?.hasPlayerToken(safeToken);

      const room = roomManager.joinRoom(safeRoomId, socket.id, safePlayerName, safeAvatar, safeToken);
      clearRoomCleanupTimer(room.id);
      clearHostTransferTimer(room.id);
      clearOfflinePlayerTimer(room.id, safeToken);
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const joinedPlayer = room.getPlayer(socket.id);
      if (joinedPlayer) {
        emitRoomNotice(room.id, `${joinedPlayer.name}${wasReconnect ? ' 重新连接' : ' 加入了房间'}。${getHostLabel(room.id)}`);
      }
      emitRoomUpdate(room.id);
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('rejoin_room', ({ roomId, playerToken }) => {
    try {
      removeSocketFromCurrentRoom();

      const safeRoomId = normalizeRoomId(roomId);
      const safeToken = normalizePlayerToken(playerToken);
      const room = roomManager.reconnectRoom(safeRoomId, socket.id, safeToken);

      clearRoomCleanupTimer(room.id);
      clearHostTransferTimer(room.id);
      clearOfflinePlayerTimer(room.id, safeToken);
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      const rejoinPlayer = room.getPlayer(socket.id);
      if (rejoinPlayer) {
        emitRoomNotice(room.id, `${rejoinPlayer.name} 重新连接。${getHostLabel(room.id)}`);
      }
      emitRoomUpdate(room.id);
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('start_game', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    
    try {
      const room = roomManager.getRoom(roomId);
      if (room && room.hostId === socket.id) {
        room.startGame();
        emitRoomUpdate(roomId);
      }
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('finish_turn', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.finishTurn(socket.id);
    }
  });

  socket.on('update_config', ({ config }) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) {
      return;
    }

    try {
      room.updateConfig(config);
      emitRoomUpdate(roomId);
    } catch (e: any) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('vote', ({ targetPlayerId }) => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.handleVote(socket.id, targetPlayerId);
      emitRoomUpdate(roomId);
    }
  });

  socket.on('confirm_vote_result', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.confirmVoteResult(socket.id);
      emitRoomUpdate(roomId);
    }
  });

  socket.on('restart_game', () => {
    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;
    const room = roomManager.getRoom(roomId);
    if (room && room.hostId === socket.id) {
      room.restartGame();
      emitRoomUpdate(roomId);
    }
  });

  socket.on('leave_room', () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const room = roomManager.getRoom(roomId);
      const player = room?.getPlayer(socket.id);
      if (player) {
        emitRoomNotice(roomId, `${player.name} 退出了房间。${getHostLabel(roomId)}`);
      }
    }
    removeSocketFromCurrentRoom();
  });

  socket.on('disconnect', () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const room = roomManager.getRoom(roomId);
      if (room) {
        const player = room.getPlayer(socket.id);
        const playerToken = room.getPlayerToken(socket.id);
        room.markPlayerOffline(socket.id);
        if (player) {
          emitRoomNotice(roomId, `${player.name} 掉线了。`);
        }
        emitRoomUpdate(roomId);
        scheduleRoomCleanupIfOffline(roomId);
        scheduleHostTransferIfNeeded(roomId);
        if (playerToken) {
          scheduleOfflinePlayerRemoval(roomId, playerToken);
        }
      }
      socketToRoom.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Handle SPA routing - 非 API / 非静态资源的请求返回 index.html
app.use((req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
