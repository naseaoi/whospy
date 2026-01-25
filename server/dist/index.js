"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const RoomManager_1 = require("./game/RoomManager");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// Serve static files from client/dist
const clientDistPath = path_1.default.join(__dirname, '../../client/dist');
app.use(express_1.default.static(clientDistPath));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = parseInt(process.env.PORT || '3001', 10);
const roomManager = new RoomManager_1.RoomManager();
// Map socketId to roomId for quick lookup
const socketToRoom = new Map();
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    // Helper to send room update
    const emitRoomUpdate = (roomId) => {
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
        }
        catch (e) {
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
        }
        catch (e) {
            socket.emit('error', { message: e.message });
        }
    });
    socket.on('start_game', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        try {
            const room = roomManager.getRoom(roomId);
            if (room && room.hostId === socket.id) {
                room.startGame();
                emitRoomUpdate(roomId);
            }
        }
        catch (e) {
            socket.emit('error', { message: e.message });
        }
    });
    socket.on('finish_turn', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = roomManager.getRoom(roomId);
        if (room) {
            room.finishTurn(socket.id);
        }
    });
    socket.on('update_config', ({ config }) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = roomManager.getRoom(roomId);
        if (room && room.hostId === socket.id) {
            room.updateConfig(config);
            emitRoomUpdate(roomId);
        }
    });
    socket.on('vote', ({ targetPlayerId }) => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = roomManager.getRoom(roomId);
        if (room) {
            room.handleVote(socket.id, targetPlayerId);
            emitRoomUpdate(roomId);
        }
    });
    socket.on('confirm_vote_result', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
        const room = roomManager.getRoom(roomId);
        if (room) {
            room.confirmVoteResult(socket.id);
            emitRoomUpdate(roomId);
        }
    });
    socket.on('restart_game', () => {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId)
            return;
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
                }
                else {
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
    res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
});
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
