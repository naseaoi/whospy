import { Room } from './Room';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostId: string, hostName: string, hostAvatar: string, onUpdate: (id: string) => void): Room {
    const roomId = this.generateRoomId();
    const room = new Room(roomId, hostId, hostName, hostAvatar, onUpdate);
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string, playerAvatar: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error("房间不存在");
    if (room.status !== 'WAITING') throw new Error("游戏已开始");
    
    // Reconnection logic could go here, but for MVP we assume new join
    const existing = room.getPlayer(playerId);
    if (!existing) {
      room.addPlayer(playerId, playerName, playerAvatar);
    }
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  private generateRoomId(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
}
