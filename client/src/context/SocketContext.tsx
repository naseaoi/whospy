import type { RoomData, GameConfig } from '../types';
import { io, Socket } from 'socket.io-client';
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';

const PLAYER_TOKEN_KEY = 'whospy_player_token';
const LAST_ROOM_ID_KEY = 'whospy_last_room_id';
const getSessionValue = (key: string) => sessionStorage.getItem(key);
const setSessionValue = (key: string, value: string) => sessionStorage.setItem(key, value);
const removeSessionValue = (key: string) => sessionStorage.removeItem(key);

const createPlayerToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`;
};

const getPlayerToken = () => {
  const existing = getSessionValue(PLAYER_TOKEN_KEY);
  if (existing) {
    return existing;
  }
  const token = createPlayerToken();
  setSessionValue(PLAYER_TOKEN_KEY, token);
  return token;
};

interface SocketContextType {
  socket: Socket | null;
  room: RoomData | null;
  isConnected: boolean;
  createRoom: (name: string, avatar: string) => void;
  joinRoom: (roomId: string, name: string, avatar: string) => void;
  startGame: () => void;
  updateConfig: (config: Partial<GameConfig>) => void;
  finishTurn: () => void;
  vote: (targetId: string) => void;
  confirmVoteResult: () => void;
  restartGame: () => void;
  leaveRoom: () => void;
  notices: RoomNotice[];
  error: string | null;
}

export interface RoomNotice {
  id: string;
  message: string;
  createdAt: number;
  expiresAt?: number;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<RoomNotice[]>([]);
  const noticeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    noticeTimerRef.current = setInterval(() => {
      setNotices(prev => {
        const now = Date.now();
        const filtered = prev.filter(n => !n.expiresAt || n.expiresAt > now);
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 500);

    return () => {
      if (noticeTimerRef.current) {
        clearInterval(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Determine socket URL based on environment
    // In production (merged build), use relative path or same origin
    const socketUrl = import.meta.env.PROD ? '/' : 'http://localhost:3001';
    
    const newSocket = io(socketUrl);
    
    const playerToken = getPlayerToken();

    newSocket.on('connect', () => {
      setIsConnected(true);

      const savedRoomId = getSessionValue(LAST_ROOM_ID_KEY);
      if (savedRoomId) {
        newSocket.emit('rejoin_room', { roomId: savedRoomId, playerToken });
      }
    });

    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('room_created', ({ roomId }) => {
      console.log('Room created:', roomId);
      setSessionValue(LAST_ROOM_ID_KEY, roomId);
    });

    newSocket.on('room_updated', (data: RoomData) => {
      setRoom(data);
      setError(null);
      setSessionValue(LAST_ROOM_ID_KEY, data.id);
    });

    newSocket.on('room_notice', (notice: RoomNotice) => {
      const noticeWithExpiry = { ...notice, expiresAt: Date.now() + 2000 };
      setNotices(prev => {
        if (prev.some(item => item.id === notice.id)) {
          return prev;
        }
        const next = [...prev, noticeWithExpiry];
        return next.slice(-20);
      });
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
      if (typeof message === 'string' && message.includes('房间不存在')) {
        removeSessionValue(LAST_ROOM_ID_KEY);
        setRoom(null);
        setNotices([]);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = (name: string, avatar: string) => {
    const playerToken = getPlayerToken();
    setNotices([]);
    console.log('Emitting create_room:', { playerName: name, avatar });
    socket?.emit('create_room', { playerName: name, avatar, playerToken });
  };

  const joinRoom = (roomId: string, name: string, avatar: string) => {
    const playerToken = getPlayerToken();
    setNotices([]);
    socket?.emit('join_room', { roomId, playerName: name, avatar, playerToken });
  };

  const startGame = () => {
    socket?.emit('start_game');
  };

  const updateConfig = (config: Partial<GameConfig>) => {
    socket?.emit('update_config', { config });
  };

  const finishTurn = () => {
    socket?.emit('finish_turn');
  };

  const vote = (targetPlayerId: string) => {
    socket?.emit('vote', { targetPlayerId });
  };

  const confirmVoteResult = () => {
    socket?.emit('confirm_vote_result');
  };

  const restartGame = () => {
    socket?.emit('restart_game');
  };

  const leaveRoom = () => {
    socket?.emit('leave_room');
    removeSessionValue(LAST_ROOM_ID_KEY);
    setRoom(null);
    setError(null);
    setNotices([]);
  };

  return (
    <SocketContext.Provider value={{ socket, room, isConnected, createRoom, joinRoom, startGame, updateConfig, finishTurn, vote, confirmVoteResult, restartGame, leaveRoom, notices, error }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
};
