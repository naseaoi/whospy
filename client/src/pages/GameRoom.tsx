import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { Modal } from '../components/Modal';
import { PlayerCard } from '../components/PlayerCard';
import { Eye, Search, Siren, Mic, Volume2 } from 'lucide-react';

export const GameRoom: React.FC = () => {
  const { room, socket, confirmViewing, finishTurn, vote, confirmVoteResult, restartGame, leaveRoom } = useSocket();
  const [showWord, setShowWord] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const playerCardsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [voteArrows, setVoteArrows] = useState<Array<{
    voterId: string;
    startX: number;
    startY: number;
    angle: number;
    length: number;
  }>>([]);

  // Modal States
  const [showVoteConfirm, setShowVoteConfirm] = useState<string | null | undefined>(undefined);
  const [showWordModal, setShowWordModal] = useState(false);
  const [hasClickedRestart, setHasClickedRestart] = useState(false);

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

  // Reset restart click state when game restarts
  useEffect(() => {
    if (room?.status === 'WAITING') {
      setHasClickedRestart(false);
    }
  }, [room?.status]);

  // Calculate vote arrows
  const voteArrowsData = useMemo(() => {
    if (room?.gameState?.phase !== 'VOTING' && room?.gameState?.phase !== 'PK_VOTING') {
      return [];
    }

    const arrows: typeof voteArrows = [];
    const mutualVotes = new Set<string>();

    room.players.forEach((voter) => {
      if (!voter.votedFor || voter.votedFor === null) return;
      const target = room.players.find(p => p.id === voter.votedFor);
      if (target?.votedFor === voter.id) {
        const key = [voter.id, voter.votedFor].sort().join('-');
        mutualVotes.add(key);
      }
    });

    room.players.forEach((voter) => {
      if (!voter.votedFor || voter.votedFor === null) return;

      const voterEl = playerCardsRef.current.get(voter.id);
      const targetEl = playerCardsRef.current.get(voter.votedFor);

      if (!voterEl || !targetEl) return;

      const voterRect = voterEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = voterEl.parentElement?.getBoundingClientRect();

      if (!containerRect) return;

      const mutualKey = [voter.id, voter.votedFor].sort().join('-');
      const isMutual = mutualVotes.has(mutualKey);

      let startX = voterRect.left + voterRect.width / 2 - containerRect.left;
      let startY = voterRect.top + voterRect.height / 2 - containerRect.top;
      let endX = targetRect.left + targetRect.width / 2 - containerRect.left;
      let endY = targetRect.top + targetRect.height / 2 - containerRect.top;

      if (isMutual) {
        const offsetDistance = voter.id < voter.votedFor ? -20 : 20;
        const [refId1, refId2] = [voter.id, voter.votedFor].sort();
        const refVoterEl = playerCardsRef.current.get(refId1);
        const refTargetEl = playerCardsRef.current.get(refId2);

        if (refVoterEl && refTargetEl) {
          const refVoterRect = refVoterEl.getBoundingClientRect();
          const refTargetRect = refTargetEl.getBoundingClientRect();
          const refStartX = refVoterRect.left + refVoterRect.width / 2 - containerRect.left;
          const refStartY = refVoterRect.top + refVoterRect.height / 2 - containerRect.top;
          const refEndX = refTargetRect.left + refTargetRect.width / 2 - containerRect.left;
          const refEndY = refTargetRect.top + refTargetRect.height / 2 - containerRect.top;

          const refAngleRad = Math.atan2(refEndY - refStartY, refEndX - refStartX);
          const perpAngle = refAngleRad + Math.PI / 2;
          const offsetX = Math.cos(perpAngle) * offsetDistance;
          const offsetY = Math.sin(perpAngle) * offsetDistance;

          startX += offsetX;
          startY += offsetY;
        }
      }

      const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;
      const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

      arrows.push({ voterId: voter.id, startX, startY, angle, length });
    });

    return arrows;
  }, [room?.gameState?.phase, room?.players]);

  useEffect(() => {
    setVoteArrows(voteArrowsData);
    const interval = setInterval(() => {
      setVoteArrows(voteArrowsData);
    }, 100);
    return () => clearInterval(interval);
  }, [voteArrowsData]);

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
  const hasConfirmedViewing = room.gameState.viewingConfirmedPlayers?.includes(me?.id || '') || false;

  const handleVoteClick = useCallback((targetId: string | null) => {
    setShowVoteConfirm(targetId);
  }, []);

  const confirmVote = useCallback(() => {
    if (showVoteConfirm !== undefined) {
      vote(showVoteConfirm);
      setShowVoteConfirm(undefined);
    }
  }, [showVoteConfirm, vote]);

  const handlePlayerRefSet = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      playerCardsRef.current.set(id, el);
    } else {
      playerCardsRef.current.delete(id);
    }
  }, []);

  const targetPlayerName = showVoteConfirm ? room.players.find(p => p.id === showVoteConfirm)?.name : null;

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
                        <Eye className="w-5 h-5" />
                        <span className="font-bold text-sm tracking-wide">记忆词语</span>
                     </div>
                ) : phase === 'DESCRIBING' ? (
                    <div className="flex items-center gap-2">
                        <Mic className="w-5 h-5 text-blue-400" />
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
                        <Siren className="w-5 h-5 animate-bounce" />
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
                className={`relative w-full h-56 rounded-2xl shadow-2xl cursor-pointer transition-all duration-700 transform-style-3d ${showWord ? 'rotate-x-180' : ''}`}
                >
                  {/* Front */}
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex flex-col items-center justify-center backface-hidden border border-white/20">
                      <Search className="w-16 h-16 mb-4 drop-shadow-lg" />
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
                    {hasConfirmedViewing ? '等待其他玩家...' : '确认开始'}
                  </button>
                </div>
            </div>
        ) : phase === 'DESCRIBING' ? (
            <div className={`
              relative p-6 rounded-2xl text-center transition-all duration-500
              ${isMyTurn 
                ? 'bg-gradient-to-b from-green-900/80 to-gray-900 border-2 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' 
                : 'bg-gray-800/50 border border-white/10 backdrop-blur-sm'}
            `}>
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gray-900 px-4 py-1 rounded-full text-xs text-gray-400 border border-gray-700 flex items-center gap-1">
                  {isMyTurn ? "🟢 你的回合" : <><Volume2 className="w-3 h-3" /> 发言中</>}
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
                <h3 className="text-2xl font-black text-red-400 mb-2 tracking-tight flex items-center justify-center gap-2"><Siren className="w-6 h-6" /> 投票处决 <Siren className="w-6 h-6" /></h3>
                {!me?.isAlive ? (
                   <div className="bg-gray-700/30 text-gray-400 py-2 rounded-lg text-sm border border-gray-600/30">
                     你已出局，请等待投票结果...
                   </div>
                ) : (
                  <>
                    <p className="text-sm text-red-200/70 mb-4">点击嫌疑人头像进行投票</p>
                    {me?.votedFor !== undefined ? (
                       <div className="bg-red-500/20 text-red-300 py-2 rounded-lg text-sm border border-red-500/30">
                         {me.votedFor === null ? '已弃票' : `已投票给: ${room.players.find(p => p.id === me.votedFor)?.name}`}
                       </div>
                    ) : (
                       <button
                         onClick={() => handleVoteClick(null)}
                         className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded-lg transition border border-gray-600"
                       >
                         弃票
                       </button>
                    )}
                  </>
                )}
             </div>
        ) : null}
      </div>

      {/* 玩家列表 Grid */}
      <div className="w-full max-w-md relative pb-8">
        <div className="grid grid-cols-2 gap-3">
        {room.players.map((p, index) => {
          const isCurrent = p.id === room.gameState?.currentTurnPlayerId;
          const isMe = p.id === me?.id;
          const hasNotVoted = me?.votedFor === undefined;
          const isVotable = Boolean(
            ((phase === 'VOTING' && p.isAlive) ||
             (phase === 'PK_VOTING' && room.gameState?.pkPlayers?.includes(p.id) && p.isAlive)) &&
            hasNotVoted &&
            me?.isAlive &&
            p.id !== me?.id
          );
          const hasConfirmed = (phase === 'VIEWING' || phase === 'DISTRIBUTING') && (room.gameState?.viewingConfirmedPlayers?.includes(p.id) ?? false);
          const hasVoted = phase === 'VOTING' && p.votedFor !== undefined && p.votedFor !== null;
          const hasAbstained = phase === 'VOTING' && p.votedFor === null;
          const isPkPlayer = (phase === 'PK_DESCRIBING' || phase === 'PK_VOTING') && (room.gameState?.pkPlayers?.includes(p.id) ?? false);
          const isPkPhase = phase === 'PK_DESCRIBING' || phase === 'PK_VOTING';

          return (
            <PlayerCard
              key={p.id}
              player={p}
              index={index}
              isMe={isMe}
              isCurrent={isCurrent}
              isVotable={isVotable}
              hasConfirmed={hasConfirmed}
              hasVoted={hasVoted}
              hasAbstained={hasAbstained}
              isPkPlayer={isPkPlayer}
              isPkPhase={isPkPhase}
              phase={phase}
              onVoteClick={handleVoteClick}
              onRefSet={handlePlayerRefSet}
            />
          );
        })}
        </div>

        {/* Vote Arrows */}
        <svg className="absolute inset-0 pointer-events-none z-40" style={{ width: '100%', height: '100%' }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="2.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,5 L7,2.5 z" fill="#ef4444" />
            </marker>
          </defs>
          {voteArrows.map((arrow) => {
            const endX = arrow.startX + Math.cos(arrow.angle * Math.PI / 180) * arrow.length;
            const endY = arrow.startY + Math.sin(arrow.angle * Math.PI / 180) * arrow.length;
            const gradientId = `arrowGradient-${arrow.voterId}`;

            return (
              <g key={`arrow-${arrow.voterId}`}>
                <linearGradient id={gradientId} x1={arrow.startX} y1={arrow.startY} x2={endX} y2={endY} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" style={{ stopColor: '#ef4444', stopOpacity: 0.2 }} />
                  <stop offset="30%" style={{ stopColor: '#ef4444', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#ef4444', stopOpacity: 1 }} />
                </linearGradient>
                <line
                  x1={arrow.startX}
                  y1={arrow.startY}
                  x2={endX}
                  y2={endY}
                  stroke={`url(#${gradientId})`}
                  strokeWidth="3"
                  markerEnd="url(#arrowhead)"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Modals */}
      <Modal
        isOpen={showVoteConfirm !== undefined}
        onClose={() => setShowVoteConfirm(undefined)}
        onConfirm={confirmVote}
        title={showVoteConfirm === null ? "确认弃票" : "确认投票"}
        type="confirm"
      >
        <div className="text-center">
            {showVoteConfirm === null ? (
              <>
                你确定要<span className="text-gray-400 font-bold">弃票</span>吗？
                <div className="text-xs text-gray-500 mt-2">弃票后无法更改</div>
              </>
            ) : (
              <>
                你确定要投给 <span className="text-red-400 font-bold">{targetPlayerName}</span> 吗？
                <div className="text-xs text-gray-500 mt-2">一旦投票无法更改</div>
              </>
            )}
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
          </div>
      </Modal>

      {/* Game Over Modal */}
      <Modal
        isOpen={phase === 'GAME_OVER'}
        title="游戏结束"
        type="confirm"
        confirmText={isHost ? "再来一局" : (hasClickedRestart ? "等待房主" : "再来一局")}
        cancelText="退出房间"
        disableBackdropClick={true}
        onConfirm={() => {
          if (isHost) {
            restartGame();
          } else {
            setHasClickedRestart(true);
          }
        }}
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
