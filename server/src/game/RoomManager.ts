import { Room } from './Room';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostId: string, hostName: string, hostAvatar: string, hostToken: string, onUpdate: (id: string) => void): Room {
    const roomId = this.generateRoomId();
    const room = new Room(roomId, hostId, hostName, hostAvatar, hostToken, onUpdate);
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string, playerAvatar: string, playerToken: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("房间不存在");

    if (room.hasPlayerToken(playerToken)) {
      room.reconnectPlayer(playerToken, playerId);
      return room;
    }

    if (room.status !== 'WAITING') throw new Error("游戏已开始");

    room.addPlayer(playerId, playerName, playerAvatar, playerToken);
    return room;
  }

  reconnectRoom(roomId: string, playerId: string, playerToken: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("房间不存在");
    room.reconnectPlayer(playerToken, playerId);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    room?.dispose();
    this.rooms.delete(roomId);
  }

  private generateRoomId(): string {
    const MAX_RETRY = 20;

    for (let i = 0; i < MAX_RETRY; i++) {
      const roomId = Math.floor(100000 + Math.random() * 900000).toString();
      if (!this.rooms.has(roomId)) {
        return roomId;
      }
    }

    throw new Error('房间创建过于频繁，请稍后再试');
  }
}
