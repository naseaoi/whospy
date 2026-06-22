import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { Modal } from '../components/Modal';

export const GameRoom: React.FC = () => {
  const { room, socket, confirmViewing, finishTurn, vote, confirmVoteResult, restartGame, leaveRoom } = useSocket();
  const [showWord, setShowWord] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  // Modal States
  const [showVoteConfirm, setShowVoteConfirm] = useState<string | null>(null);
  const [showWordModal, setShowWordModal] = useState(false);

  // Sync timer
  useEffect(() => {
    if (!room?.gameState?.phaseEndTime) {
        setTimeLeft(0);
        return;
    }
    const interval = setInterval(() => {
        const now = Date.now();
        const end = room.gameState!.phaseEndTime!;
        // Use more precise calculation for progress bar
        const diffInSeconds = (end - now) / 1000;
        setTimeLeft(diffInSeconds > 0 ? diffInSeconds : 0);
    }, 100); // Update more frequently for smoother animation
    return () => clearInterval(interval);
  }, [room?.gameState?.phaseEndTime]);

  if (!room || !room.gameState) return <div>Loading...</div>;

  const me = room.players.find(p => p.id === socket?.id);
  const word = me?.word;
  const phase = room.gameState.phase;
  const isMyTurn = room.gameState.currentTurnPlayerId === me?.id;
  const currentTurnPlayer = room.players.find(p => p.id === room.gameState!.currentTurnPlayerId);
  const alivePlayers = room.players.filter(p => p.isAlive);
  const votedCount = alivePlayers.filter(p => p.votedFor).length;
  const remainingVotes = alivePlayers.length - votedCount;
  const isHost = socket?.id === room.hostId;
  const viewingConfirmedCount = room.gameState.viewingConfirmedPlayers?.length || 0;
  const hasConfirmedViewing = room.gameState.viewingConfirmedPlayers?.includes(me?.id || '') || false;

  const handleVoteClick = (targetId: string) => {
      setShowVoteConfirm(targetId);
  };

  const confirmVote = () => {
      if (showVoteConfirm) {
          vote(showVoteConfirm);
          setShowVoteConfirm(null);
      }
  };

  const targetPlayerName = room.players.find(p => p.id === showVoteConfirm)?.name;

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4 font-sans selection:bg-purple-500 selection:text-white">
      {/* 顶部状态栏 - Glassmorphism */}
      <div className="w-full max-w-md flex flex-col mb-4">
        {/* Round Badge */}
        <div className="flex justify-center mb-2">
            <div className="bg-black/40 backdrop-blur-md px-4 py-1 rounded-full border border-white/10 shadow-lg flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Round</span>
                <span className="text-white text-lg font-sans font-bold leading-none">{room.gameState.round}</span>
            </div>
        </div>

        {/* Phase Status Bar */}
        <div className="flex items-center justify-between bg-gray-800/80 backdrop-blur-md rounded-2xl p-2 border border-white/5 shadow-xl">
             {/* Left Status */}
             <div className="flex-1 flex justify-center border-r border-white/5">
                {phase === 'VIEWING' ? (
                     <div className="flex items-center gap-2 text-yellow-400">
                        <span className="text-xl">👀</span>
                        <span className="font-bold text-sm tracking-wide">记忆词语</span>
                     </div>
                ) : phase === 'DESCRIBING' ? (
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🎤</span>
                         <span className="font-bold text-sm tracking-wide text-blue-400">
                            轮流发言
                         </span>
                    </div>
                ) : phase === 'PK_DESCRIBING' ? (
                    <div className="flex items-center gap-2 text-orange-400">
                        <span className="text-xl">⚔️</span>
                         <span className="font-bold text-sm tracking-wide text-orange-400">
                            平票PK
                         </span>
                    </div>
                ) : (phase === 'VOTING' || phase === 'PK_VOTING') ? (
                    <div className="flex items-center gap-2 text-red-400">
                        <span className="text-xl animate-bounce">🗳️</span>
                        <span className="font-bold text-sm tracking-wide">{phase === 'PK_VOTING' ? 'PK 投票' : '投票处决'}</span>
                    </div>
                ) : (
                    <span className="text-gray-400 text-sm">等待中...</span>
                )}
             </div>

             {/* Right Status (Votes or other info) */}
             <div className="flex-1 flex justify-center">
                 {phase === 'VOTING' ? (
                      <div className="text-xs text-gray-400 font-medium">
                          还差 <span className="text-white font-bold text-base mx-1">{remainingVotes}</span> 人
                      </div>
                 ) : (
                     <div className="text-xs text-gray-500 font-medium">
                         {alivePlayers.length} 人存活
                     </div>
                 )}
             </div>
         </div>
      </div>

       {/* Timer Progress Bar */}
       {(phase === 'PK_ANNOUNCEMENT') && (
         <div className="w-full max-w-md mb-6 h-3 bg-gray-800 rounded-full overflow-hidden shadow-lg border border-gray-700">
             <div
                 className={`h-full transition-all duration-100 ease-linear rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)] bg-blue-500`}
                 style={{ width: `${(timeLeft / 5) * 100}%` }}
             ></div>
         </div>
       )}

      {/* 核心交互区 */}
      <div className="w-full max-w-md mb-8 px-2">
        {phase === 'VIEWING' || phase === 'DISTRIBUTING' ? (
             <div className="perspective-1000 group">
                <div
                onClick={() => setShowWord(!showWord)}
                className={`relative w-full h-56 rounded-2xl shadow-2xl cursor-pointer transition-all duration-700 transform-style-3d ${showWord ? 'rotate-x-180' : 'hover:scale-105'}`}
                >
                  {/* Front */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex flex-col items-center justify-center backface-hidden border border-white/20">
                      <div className="text-6xl mb-4 drop-shadow-lg">🕵️</div>
                      <div className="font-bold text-xl tracking-wider">点击查看词语</div>
                      <div className="text-xs mt-3 text-purple-200 bg-black/20 px-3 py-1 rounded-full">查看后点击下方按钮</div>
                  </div>

                  {/* Back */}
                  <div className="absolute inset-0 bg-white text-gray-900 rounded-2xl flex flex-col items-center justify-center transform rotate-x-180 backface-hidden border-4 border-purple-500"
                  >
                      <div className="text-sm text-gray-500 font-bold uppercase tracking-widest mb-2">Your Word</div>
                      <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
                        {word || "你是白板"}
                      </div>
                      <div className="text-xs mt-6 text-gray-400 font-medium">(点击隐藏)</div>
                  </div>
                </div>

                {/* 确认按钮 */}
                <div className="mt-6">
                  <button
                    onClick={confirmViewing}
                    disabled={hasConfirmedViewing}
                    className={`w-full font-bold py-3 px-8 rounded-xl shadow-lg transform transition border-b-4 ${
                      hasConfirmedViewing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed border-gray-800'
                        : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white active:scale-95 border-green-800 active:border-b-0 active:translate-y-1'
                    }`}
                  >
                    {hasConfirmedViewing ? '已确认，等待其他玩家...' : '开始游戏'}
                  </button>
                  <div className="text-center text-xs text-gray-400 mt-2">
                    已确认: {viewingConfirmedCount} / {alivePlayers.length}
                  </div>
                </div>
            </div>
        ) : phase === 'DESCRIBING' ? (
            <div className={`
              relative p-6 rounded-2xl text-center transition-all duration-500
              ${isMyTurn 
                ? 'bg-gradient-to-b from-green-900/80 to-gray-900 border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' 
                : 'bg-gray-800/50 border border-white/10 backdrop-blur-sm'}
            `}>
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 px-4 py-1 rounded-full text-xs text-gray-400 border border-gray-700">
                  {isMyTurn ? "🟢 你的回合" : "🔊 发言中"}
                </div>

                <div className="mt-4 mb-2">
                   <div className="text-6xl mb-2 animate-bounce-slight inline-block filter drop-shadow-md">
                     {currentTurnPlayer?.avatar}
                   </div>
                   <div className="text-xl font-bold tracking-wide">{currentTurnPlayer?.name}</div>
                </div>
                
                {isMyTurn ? (
                    <div className="animate-fade-in-up">
                        <div 
                          className="my-4 p-3 bg-black rounded-lg cursor-pointer active:bg-gray-900 transition group relative overflow-hidden border border-gray-700 select-none"
                          onClick={() => setShowWordModal(!showWordModal)}
                        >
                             <div className="text-xs text-gray-400 mb-1">点击查看底牌</div>
                             <div className="text-xl font-bold text-gray-600">
                                 {showWordModal ? <span className="text-white">{word || "你是白板"}</span> : '████'}
                             </div>
                        </div>

                        <button 
                            onClick={finishTurn}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transform transition active:scale-95 border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
                        >
                            结束发言
                        </button>
                    </div>
                ) : (
                    <div className="text-gray-400 text-sm mt-4 animate-pulse">
                        请认真倾听描述...
                    </div>
                )}
            </div>
        ) : phase === 'PK_DESCRIBING' ? (
             <div className="relative p-6 rounded-2xl text-center transition-all duration-500 bg-gray-800/50 border-2 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                 <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 px-4 py-1 rounded-full text-xs text-orange-400 border border-orange-500">
                   ⚔️ PK 发言中
                 </div>

                 <div className="mt-4 mb-2 flex flex-col items-center">
                    {/* 座位号 */}
                    <div className="mb-3 text-sm font-mono text-orange-300 border border-orange-500/30 inline-block px-3 py-1 rounded-full bg-orange-900/20 shadow-sm">
                        Seat {room.players.findIndex(p => p.id === currentTurnPlayer?.id) + 1}
                    </div>
                    
                    {/* 头像 */}
                    <div className="text-7xl mb-3 animate-pulse inline-block filter drop-shadow-[0_0_10px_rgba(249,115,22,0.5)] transform hover:scale-110 transition-transform duration-300">
                      {currentTurnPlayer?.avatar}
                    </div>
                    
                    {/* 昵称 */}
                    <div className="text-2xl font-black tracking-wide text-orange-50">{currentTurnPlayer?.name}</div>
                 </div>

                 {isMyTurn ? (
                     <div className="animate-fade-in-up">
                         <button 
                             onClick={finishTurn}
                             className="w-full mt-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg transform transition active:scale-95 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
                         >
                             结束发言
                         </button>
                     </div>
                 ) : (
                     <div className="text-orange-400/80 text-sm mt-6 font-medium animate-pulse">
                         请认真倾听 PK 陈述...
                     </div>
                 )}
             </div>
        ) : phase === 'VOTING' ? (
             <div className="bg-gradient-to-br from-red-900/80 to-gray-900 p-6 rounded-2xl text-center border-2 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <h3 className="text-2xl font-black text-red-400 mb-2 tracking-tight">🚨 投票处决 🚨</h3>
                <p className="text-sm text-red-200/70 mb-4">点击嫌疑人头像进行投票</p>
                {me?.votedFor && (
                   <div className="bg-red-500/20 text-red-300 py-2 rounded-lg text-sm border border-red-500/30">
                     已投票给: {room.players.find(p => p.id === me.votedFor)?.name}
                   </div>
                )}
             </div>
        ) : null}
      </div>

      {/* 玩家列表 Grid */}
      <div className="w-full max-w-md grid grid-cols-2 gap-3 pb-8">
        {room.players.map((p, index) => {
          const isCurrent = p.id === room.gameState?.currentTurnPlayerId;
          const isMe = p.id === me?.id;
          const isVotable = ((phase === 'VOTING' || (phase === 'PK_VOTING' && room.gameState?.pkPlayers?.includes(p.id))) && p.isAlive && !isMe && !me?.votedFor && me?.isAlive) || false;

          return (
            <div 
                key={p.id} 
                className={`
                    relative p-3 rounded-xl flex items-center space-x-3 transition-all duration-300 border overflow-visible
                    ${!p.isAlive 
                        ? 'bg-gray-800/30 border-gray-800 opacity-60 grayscale' 
                        : isCurrent 
                            ? 'bg-gray-700/80 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.2)] scale-102' 
                            : 'bg-gray-800 border-gray-700/50 hover:bg-gray-750'}
                    ${isVotable ? 'cursor-pointer ring-2 ring-red-500/50 hover:bg-red-900/20 hover:scale-105' : ''}
                    ${isMe ? 'ring-1 ring-blue-500/30 bg-blue-900/10' : ''}
                    ${(phase === 'PK_DESCRIBING' || phase === 'PK_VOTING') && room.gameState?.pkPlayers?.includes(p.id) ? 'border-orange-500/50 shadow-[0_0_10px_rgba(249,115,22,0.3)]' : ((phase === 'PK_DESCRIBING' || phase === 'PK_VOTING') ? 'opacity-60' : '')}
                `}
                onClick={() => isVotable && handleVoteClick(p.id)}
            >
                {/* Seat Number Badge */}
                <div className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center bg-gray-900 rounded-full text-[10px] font-mono text-gray-500 border border-gray-700 shadow-md z-30">
                    {index + 1}
                </div>

                {/* Status Badges */}
                {isMe && <div className="absolute -bottom-1.5 -right-1 bg-blue-600 text-[8px] px-1.5 py-0 rounded-full shadow border border-blue-400 z-30 font-bold tracking-tighter">YOU</div>}
                
                {/* PK Badge */}
                {room.gameState?.pkPlayers?.includes(p.id) && (phase === 'PK_DESCRIBING' || phase === 'PK_VOTING' || phase === 'VOTE_RESULT') && (
                    <div className="absolute -top-2 -right-1 bg-orange-600 text-[9px] px-1.5 py-0.5 rounded shadow z-30 font-bold animate-pulse">PK</div>
                )}
                <div className="relative">
                    <div className="text-3xl filter drop-shadow-sm">{p.avatar}</div>
                    {!p.isAlive && (
                        <div className="absolute inset-[-8px] flex items-center justify-center z-20 pointer-events-none">
                             <span className="text-red-500 font-bold text-lg transform -rotate-12 border-4 border-red-500 px-1 rounded bg-black/60 shadow-lg backdrop-blur-sm">OUT</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate text-gray-200">{p.name}</div>
                    <div className="flex items-center space-x-1 mt-1">
                        {p.isOnline ? (
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.8)]"></div> 
                        ) : (
                            <div className="w-1.5 h-1.5 bg-gray-500 rounded-full"></div>
                        )}
                        {isCurrent && <span className="text-[10px] text-yellow-400 animate-pulse">发言中</span>}
                        {p.votedFor && phase === 'VOTING' && <span className="text-[10px] text-green-400">已投</span>}
                    </div>
                </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      <Modal 
        isOpen={!!showVoteConfirm} 
        onClose={() => setShowVoteConfirm(null)}
        onConfirm={confirmVote}
        title="确认投票"
        type="confirm"
      >
        <div className="text-center">
            你确定要投给 <span className="text-red-400 font-bold">{targetPlayerName}</span> 吗？
            <div className="text-xs text-gray-500 mt-2">一旦投票无法更改</div>
        </div>
      </Modal>

      {/* PK Announcement Modal */}
      <Modal
        isOpen={phase === 'PK_ANNOUNCEMENT' && me?.isAlive === true}
        onClose={() => {}}
        title="平票PK"
        confirmText={`即将开始 (${Math.floor(timeLeft)}s)`}
        onConfirm={() => {}}
      >
          <div className="text-center py-4">
              <div className="text-5xl mb-4 animate-bounce">⚔️</div>
              <h2 className="text-2xl font-bold text-orange-400 mb-2">出现平票！</h2>
              <p className="text-gray-300 mb-4">
                  即将进入PK环节，由平票玩家再次发言。
              </p>
              
              <div className="flex justify-center space-x-4">
                  {room.gameState.pkPlayers?.map(id => {
                      const p = room.players.find(player => player.id === id);
                      return (
                          <div key={id} className="flex flex-col items-center">
                              <div className="text-3xl mb-1">{p?.avatar}</div>
                              <div className="text-xs text-gray-400">{p?.name}</div>
                          </div>
                      )
                  })}
              </div>
          </div>
      </Modal>

      {/* Vote Result Modal (For all alive players to confirm) */}
      <Modal
        isOpen={phase === 'VOTE_RESULT' && me?.isAlive === true}
        onClose={() => {}} 
        title="本轮结束"
        confirmText={room.gameState.voteResultConfirmedPlayers?.includes(me!.id) ? "等待其他人..." : "继续游戏"}
        onConfirm={() => {
            if (room.gameState && !room.gameState.voteResultConfirmedPlayers?.includes(me!.id)) {
                confirmVoteResult();
            }
        }}
      >
          <div className="text-center py-2">
              <p className="text-lg font-bold text-gray-300 mb-2">投票结束，游戏继续！</p>
              <div className="text-xs text-gray-500">
                  已确认: {room.gameState.voteResultConfirmedPlayers?.length || 0} / {alivePlayers.length}
              </div>
          </div>
      </Modal>

      {/* Game Over Modal */}
      <Modal
        isOpen={phase === 'GAME_OVER'}
        title="游戏结束"
        type="confirm"
        confirmText={isHost ? "再来一局" : "等待房主"}
        cancelText="返回大厅"
        onConfirm={() => isHost && restartGame()}
        onClose={leaveRoom}
      >
          <div className="text-center py-4">
              <div className="text-6xl mb-4">
                  {room.gameState.winner === 'CIVILIAN' ? '👮' : room.gameState.winner === 'SPY' ? '🕵️‍♂️' : '🤝'}
              </div>
              <h2 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                  {room.gameState.winner === 'CIVILIAN' ? '平民胜利' : room.gameState.winner === 'SPY' ? '卧底胜利' : room.gameState.winner === 'BLANK' ? '白板胜利' : '平局'}
              </h2>
              <div className="mt-4 p-3 bg-gray-800 rounded-lg text-left text-sm space-y-1">
                  <div className="flex justify-between border-b border-gray-700 pb-1 mb-1">
                      <span>平民词</span>
                      <span className="font-bold text-blue-400">{room.gameState.words.civilian}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                      <span>卧底词</span>
                      <span className="font-bold text-red-400">{room.gameState.words.spy}</span>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                      <div className="grid grid-cols-2 gap-2 p-2 custom-scrollbar overflow-y-auto" style={{ maxHeight: '15rem' }}>
                          {room.players.map(p => (
                              <div key={p.id} className={`flex items-center justify-between bg-gray-700/50 p-2 rounded ${p.id === me?.id ? 'border-2 border-blue-500 bg-blue-900/20' : ''}`}>
                                  <div className="flex items-center space-x-2 truncate">
                                      <span className="text-lg">{p.avatar}</span>
                                      <span className="text-xs text-gray-300 truncate max-w-[60px]">{p.name}</span>
                                  </div>
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded whitespace-nowrap
                                      ${p.role === 'SPY' ? 'bg-red-500/20 text-red-400' : 
                                        p.role === 'BLANK' ? 'bg-gray-500/20 text-gray-400' : 
                                        'bg-blue-500/20 text-blue-400'}`}>
                                      {p.role === 'SPY' ? '卧底' : p.role === 'BLANK' ? '白板' : '平民'}
                                  </span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      </Modal>
    </div>
  );
};
