import React from 'react';
import type { Player } from '../types';

interface PlayerCardProps {
  player: Player;
  index: number;
  isMe: boolean;
  isCurrent: boolean;
  isVotable: boolean;
  hasConfirmed: boolean;
  hasVoted: boolean;
  hasAbstained: boolean;
  isPkPlayer: boolean;
  isPkPhase: boolean;
  phase: string;
  onVoteClick: (playerId: string) => void;
  onRefSet: (id: string, el: HTMLDivElement | null) => void;
}

export const PlayerCard = React.memo<PlayerCardProps>(({
  player,
  index,
  isMe,
  isCurrent,
  isVotable,
  hasConfirmed,
  hasVoted,
  hasAbstained,
  isPkPlayer,
  isPkPhase,
  phase,
  onVoteClick,
  onRefSet,
}) => {
  return (
    <div
      ref={(el) => onRefSet(player.id, el)}
      className={`
        relative p-3 rounded-xl flex items-center space-x-3 transition-all duration-300 border overflow-visible
        ${!player.isAlive
          ? 'bg-gray-800/30 border-gray-800 opacity-60 grayscale'
          : isCurrent
            ? 'bg-gray-700/80 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)] scale-102'
            : hasConfirmed
              ? 'bg-gray-800 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
              : hasVoted
                ? 'bg-gray-800 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]'
                : hasAbstained
                  ? 'bg-gray-800 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)]'
                  : 'bg-gray-800 border-gray-700/50 hover:bg-gray-750'}
        ${isVotable ? 'cursor-pointer hover:bg-red-900/20 hover:scale-105' : ''}
        ${isMe ? 'ring-1 ring-blue-500/30 bg-blue-900/10' : ''}
        ${isPkPlayer ? 'border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.3)]' : (isPkPhase ? 'opacity-60' : '')}
      `}
      onClick={() => isVotable && onVoteClick(player.id)}
    >
      <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center bg-gray-900 rounded-full text-[10px] font-mono text-gray-500 border border-gray-700 shadow-md z-30">
        {index + 1}
      </div>

      {isMe && <div className="absolute -bottom-1.5 -right-1 bg-blue-600 text-[8px] px-1.5 py-0 rounded-full shadow border border-blue-400 z-30 font-bold tracking-tighter">YOU</div>}

      {isPkPlayer && (phase === 'PK_DESCRIBING' || phase === 'PK_VOTING' || phase === 'VOTE_RESULT') && (
        <div className="absolute -top-2 -right-1 bg-orange-600 text-[9px] px-1.5 py-0.5 rounded shadow z-30 font-bold animate-pulse">PK</div>
      )}

      <div className="relative">
        <div className="text-3xl filter drop-shadow-sm">{player.avatar}</div>
        {!player.isAlive && (
          <div className="absolute inset-[-8px] flex items-center justify-center z-20 pointer-events-none">
            <span className="text-red-500 font-bold text-lg transform -rotate-12 border-4 border-red-500 px-1 rounded bg-black/60 shadow-lg backdrop-blur-sm">OUT</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate text-gray-200">{player.name}</div>
        <div className="flex items-center space-x-1 mt-1">
          {player.isOnline ? (
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div>
          ) : (
            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
          )}
          {isCurrent && <span className="text-[10px] text-yellow-400 animate-pulse">发言中</span>}
          {phase === 'VOTING' && player.votedFor === null && <span className="text-[10px] text-gray-400">弃票</span>}
          {phase === 'VOTING' && player.votedFor !== undefined && player.votedFor !== null && <span className="text-[10px] text-green-400">已投</span>}
        </div>
      </div>
    </div>
  );
});

PlayerCard.displayName = 'PlayerCard';
