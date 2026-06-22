export class TimerService {
  private roomCleanupTimers = new Map<string, NodeJS.Timeout>();
  private hostTransferTimers = new Map<string, NodeJS.Timeout>();
  private offlinePlayerTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly roomReconnectGraceMs: number,
    private readonly hostTransferGraceMs: number,
    private readonly offlinePlayerRemoveMs: number
  ) {}

  scheduleRoomCleanup(roomId: string, callback: () => void): void {
    if (this.roomCleanupTimers.has(roomId)) {
      return;
    }

    const timer = setTimeout(() => {
      callback();
      this.roomCleanupTimers.delete(roomId);
    }, this.roomReconnectGraceMs);

    this.roomCleanupTimers.set(roomId, timer);
  }

  clearRoomCleanup(roomId: string): void {
    const timer = this.roomCleanupTimers.get(roomId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.roomCleanupTimers.delete(roomId);
  }

  scheduleHostTransfer(roomId: string, callback: () => void): void {
    if (this.hostTransferTimers.has(roomId)) {
      return;
    }

    const timer = setTimeout(() => {
      callback();
      this.hostTransferTimers.delete(roomId);
    }, this.hostTransferGraceMs);

    this.hostTransferTimers.set(roomId, timer);
  }

  clearHostTransfer(roomId: string): void {
    const timer = this.hostTransferTimers.get(roomId);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.hostTransferTimers.delete(roomId);
  }

  scheduleOfflinePlayerRemoval(
    roomId: string,
    playerToken: string,
    callback: () => void
  ): void {
    const key = this.getOfflineTimerKey(roomId, playerToken);
    if (this.offlinePlayerTimers.has(key)) {
      return;
    }

    const timer = setTimeout(() => {
      callback();
      this.offlinePlayerTimers.delete(key);
    }, this.offlinePlayerRemoveMs);

    this.offlinePlayerTimers.set(key, timer);
  }

  clearOfflinePlayer(roomId: string, playerToken: string): void {
    const key = this.getOfflineTimerKey(roomId, playerToken);
    const timer = this.offlinePlayerTimers.get(key);
    if (!timer) {
      return;
    }
    clearTimeout(timer);
    this.offlinePlayerTimers.delete(key);
  }

  clearAllOfflinePlayersForRoom(roomId: string): void {
    const prefix = `${roomId}:`;
    for (const [key, timer] of this.offlinePlayerTimers.entries()) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      clearTimeout(timer);
      this.offlinePlayerTimers.delete(key);
    }
  }

  private getOfflineTimerKey(roomId: string, playerToken: string): string {
    return `${roomId}:${playerToken}`;
  }
}
