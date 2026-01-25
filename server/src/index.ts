import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { RoomManager } from './game/RoomManager';

const app = express();
app.use(cors());

// Serve static files from client/dist
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const roomManager = new RoomManager();

// Map socketId to roomId for quick lookup
const socketToRoom = new Map<string, string>();

io.on('connection', (socket: Socket) => {
  console.log('User connected:', socket.id);

  // Helper to send room update
  const emitRoomUpdate = (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      io.to(roomId).emit('room_updated', room.toData());
    }
  };

  socket.on('create_room', ({ playerName, avatar }) => {
    console.log('Received create_room:', { socketId: socket.id, playerName, avatar });
    try {
      // Pass the emit callback to the room
      const room = roomManager.createRoom(socket.id, playerName, avatar, emitRoomUpdate);
      socketToRoom.set(socket.id, room.id);
      socket.join(room.id);
      socket.emit('room_created', { roomId: room.id });
      emitRoomUpdate(room.id);
    } catch (e: any) {
      console.error('Error creating room:', e);
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('join_room', ({ roomId, playerName, avatar }) => {
    try {
      const room = roomManager.joinRoom(roomId, socket.id, playerName, avatar);
      socketToRoom.set(socket.id, roomId);
      socket.join(roomId);
      emitRoomUpdate(roomId);
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
    if (room && room.hostId === socket.id) {
      room.updateConfig(config);
      emitRoomUpdate(roomId);
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

  socket.on('disconnect', () => {
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      const room = roomManager.getRoom(roomId);
      if (room) {
        room.removePlayer(socket.id);
        if (room.players.length === 0) {
          roomManager.deleteRoom(roomId);
        } else {
          emitRoomUpdate(roomId);
        }
      }
      socketToRoom.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Handle SPA routing - return index.html for any unknown routes
app.get(/^(?!\/socket.io).*$/, (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
