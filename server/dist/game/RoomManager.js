"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const Room_1 = require("./Room");
class RoomManager {
    constructor() {
        this.rooms = new Map();
    }
    createRoom(hostId, hostName, hostAvatar, onUpdate) {
        const roomId = this.generateRoomId();
        const room = new Room_1.Room(roomId, hostId, hostName, hostAvatar, onUpdate);
        this.rooms.set(roomId, room);
        return room;
    }
    joinRoom(roomId, playerId, playerName, playerAvatar) {
        const room = this.rooms.get(roomId);
        if (!room)
            throw new Error("房间不存在");
        if (room.status !== 'WAITING')
            throw new Error("游戏已开始");
        // Reconnection logic could go here, but for MVP we assume new join
        const existing = room.getPlayer(playerId);
        if (!existing) {
            room.addPlayer(playerId, playerName, playerAvatar);
        }
        return room;
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    deleteRoom(roomId) {
        this.rooms.delete(roomId);
    }
    generateRoomId() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
}
exports.RoomManager = RoomManager;
