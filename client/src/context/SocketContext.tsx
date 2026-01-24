import type { RoomData, GameConfig } from '../types';
import { io, Socket } from 'socket.io-client';
import React, { createContext, useContext, useEffect, useState } from 'react';

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
  error: string | null;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Determine socket URL based on environment
    // In production (merged build), use relative path or same origin
    const socketUrl = import.meta.env.PROD ? '/' : 'http://localhost:3001';
    
    const newSocket = io(socketUrl);
    
    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('room_created', ({ roomId }) => {
      console.log('Room created:', roomId);
    });

    newSocket.on('room_updated', (data: RoomData) => {
      setRoom(data);
      setError(null);
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const createRoom = (name: string, avatar: string) => {
    console.log('Emitting create_room:', { playerName: name, avatar });
    socket?.emit('create_room', { playerName: name, avatar });
  };

  const joinRoom = (roomId: string, name: string, avatar: string) => {
    socket?.emit('join_room', { roomId, playerName: name, avatar });
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

  return (
    <SocketContext.Provider value={{ socket, room, isConnected, createRoom, joinRoom, startGame, updateConfig, finishTurn, vote, confirmVoteResult, restartGame, error }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
};
