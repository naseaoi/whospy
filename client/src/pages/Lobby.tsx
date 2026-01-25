import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Pencil } from 'lucide-react';
import type { GameConfig } from '../types';
import { Modal } from '../components/Modal';

export const Lobby: React.FC = () => {
  const { room, socket, startGame, updateConfig } = useSocket();
  const [showSettings, setShowSettings] = useState(false);
  const [showCustomWordsModal, setShowCustomWordsModal] = useState(false);

  // Local state for settings form
  const [configForm, setConfigForm] = useState<Partial<GameConfig>>({
    spyCount: room?.config.spyCount || 1,
    blankCount: room?.config.blankCount || 0,
    useCustomWords: room?.config.useCustomWords || false,
    customWordPair: room?.config.customWordPair || { civilian: '', spy: '' }
  });

  if (!room) return <div>Loading...</div>;

  const isHost = socket?.id === room.hostId;
  const me = room.players.find(p => p.id === socket?.id);

  const handleConfigChange = (key: keyof GameConfig, value: any) => {
    const newConfig = { ...configForm, [key]: value };
    setConfigForm(newConfig);
    if (key !== 'customWordPair') {
        updateConfig({ [key]: value });
    }
  };

  const handleCustomWordChange = (type: 'civilian' | 'spy', value: string) => {
    const newPair = { ...(configForm.customWordPair || { civilian: '', spy: '' }), [type]: value };
    setConfigForm({ ...configForm, customWordPair: newPair });
  };

  const openCustomWords = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          handleConfigChange('useCustomWords', true);
          setShowCustomWordsModal(true);
      } else {
          handleConfigChange('useCustomWords', false);
      }
  };

  const saveCustomWords = () => {
    updateConfig({ 
        useCustomWords: true,
        customWordPair: configForm.customWordPair 
    });
    setShowCustomWordsModal(false);
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-4 font-sans selection:bg-purple-500 selection:text-white">
      <div className="w-full max-w-md">
        <header className="flex justify-between items-center mb-8 px-4 py-3 bg-white/10 backdrop-blur-md rounded-2xl shadow-lg border border-white/10">
          <div>
            <h2 className="text-xl font-bold tracking-tight">房间: <span className="font-mono text-blue-300">{room.id}</span></h2>
            <div className="text-xs text-gray-400 mt-1 flex items-center space-x-2">
                <span>人数: {room.players.length}</span>
                <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                <span>{room.config.useCustomWords ? '自定义词库' : '随机词库'}</span>
            </div>
          </div>
          <span className="bg-blue-600/20 text-blue-200 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/30 animate-pulse">
            等待开始
          </span>
        </header>

        {/* Players Grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {room.players.map((player, index) => {
             const isMe = player.id === me?.id;
             return (
                <div key={player.id} className={`
                    relative flex flex-col items-center p-3 rounded-xl border transition-all duration-300
                    ${isMe ? 'bg-blue-900/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-gray-800 border-gray-700'}
                `}>
                    {/* Seat Number Badge */}
                    <div className="absolute -top-2 -left-2 w-6 h-6 flex items-center justify-center bg-gray-900 rounded-full text-xs font-mono text-gray-500 border border-gray-700 shadow-md">
                        {index + 1}
                    </div>

                    {player.id === room.hostId && (
                        <span className="absolute top-1 right-1 text-[10px] bg-yellow-600/80 text-white px-1.5 py-0.5 rounded shadow">房主</span>
                    )}
                    
                    {isMe && (
                        <span className="absolute -bottom-1 right-0 bg-blue-600 text-[8px] px-1.5 py-0 rounded-full shadow border border-blue-400 z-10 font-bold tracking-tighter">YOU</span>
                    )}

                    <div className="w-16 h-16 flex items-center justify-center text-4xl mb-2 filter drop-shadow-md transform transition hover:scale-110 duration-200 cursor-default bg-gray-900/40 rounded-full border border-gray-600/30 aspect-square">{player.avatar}</div>
                    <div className="text-xs font-bold truncate w-full text-center text-gray-300">{player.name}</div>
                </div>
             );
          })}
          
          {/* Empty Seats Placeholders (optional visual) */}
          {Array.from({ length: Math.max(0, 3 - room.players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex flex-col items-center justify-center p-3 rounded-xl border border-dashed border-gray-700 bg-gray-800/30 opacity-50">
                  <div className="text-2xl text-gray-600 mb-1">+</div>
                  <div className="text-xs text-gray-600">等待加入</div>
              </div>
          ))}
        </div>

        {isHost ? (
            <div className="bg-gray-800/50 backdrop-blur-sm p-5 rounded-2xl mb-8 border border-white/5">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-300 flex items-center gap-2">
                        <span>⚙️</span> 游戏设置
                    </h3>
                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className="text-blue-400 text-xs bg-blue-900/20 px-3 py-1.5 rounded-lg hover:bg-blue-900/40 transition"
                    >
                        {showSettings ? '收起' : '展开'}
                    </button>
                </div>
                
                {showSettings && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Spy Count Control */}
                        <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl">
                            <span className="text-sm text-gray-300">卧底人数</span>
                            <div className="flex items-center space-x-3 bg-gray-900 rounded-lg p-1">
                                <button 
                                    className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded hover:bg-gray-600 text-gray-200 transition" 
                                    onClick={() => handleConfigChange('spyCount', Math.max(1, (configForm.spyCount || 1) - 1))}
                                >-</button>
                                <span className="font-mono w-4 text-center">{configForm.spyCount}</span>
                                <button 
                                    className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded hover:bg-gray-600 text-gray-200 transition" 
                                    onClick={() => handleConfigChange('spyCount', (configForm.spyCount || 1) + 1)}
                                >+</button>
                            </div>
                        </div>

                        {/* Blank Count Control */}
                        <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl">
                            <span className="text-sm text-gray-300">白板人数</span>
                            <div className="flex items-center space-x-3 bg-gray-900 rounded-lg p-1">
                                <button 
                                    className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded hover:bg-gray-600 text-gray-200 transition" 
                                    onClick={() => handleConfigChange('blankCount', Math.max(0, (configForm.blankCount || 0) - 1))}
                                >-</button>
                                <span className="font-mono w-4 text-center">{configForm.blankCount || 0}</span>
                                <button 
                                    className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded hover:bg-gray-600 text-gray-200 transition" 
                                    onClick={() => handleConfigChange('blankCount', (configForm.blankCount || 0) + 1)}
                                >+</button>
                            </div>
                        </div>

                        {/* Custom Words Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition">
                            <span className="text-sm text-gray-300">自定义词语</span>
                            
                            <div className="flex items-center">
                                {configForm.useCustomWords && (
                                     <button 
                                        onClick={() => setShowCustomWordsModal(true)}
                                        className="mr-3 p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 rounded-lg transition"
                                        title={`当前: ${configForm.customWordPair?.civilian || '未设置'} / ${configForm.customWordPair?.spy || '未设置'}`}
                                     >
                                         <Pencil size={16} />
                                     </button>
                                )}
                                <label className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        name="toggle" 
                                        checked={configForm.useCustomWords} 
                                        onChange={openCustomWords}
                                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full checked:border-blue-600"
                                    />
                                    <div className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${configForm.useCustomWords ? 'bg-blue-600' : 'bg-gray-700'}`}></div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}
                 {!showSettings && (
                    <div className="flex justify-between text-xs text-gray-500 bg-black/20 p-3 rounded-xl">
                        <span>模式: {room.config.useCustomWords ? '自定义' : '随机'}</span>
                        <span>卧底: {room.config.spyCount}人</span>
                        {room.config.blankCount > 0 && <span>白板: {room.config.blankCount}人</span>}
                    </div>
                )}
            </div>
        ) : (
             <div className="bg-gray-800/50 p-6 rounded-2xl mb-8 text-center text-gray-500 border border-white/5 flex flex-col items-center gap-2">
                <div className="animate-spin text-2xl">⏳</div>
                等待房主设置游戏...
             </div>
        )}

        {isHost ? (
          <button 
            onClick={startGame}
            disabled={room.players.length < 3}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg transition transform active:scale-95 border-b-4 border-blue-900 active:border-b-0 active:translate-y-1"
          >
            {room.players.length < 3 ? '至少需要3人' : '开始游戏'}
          </button>
        ) : (
          <div className="text-center text-gray-400 animate-pulse text-sm">
            <br/>
          </div>
        )}
      </div>

      {/* Custom Words Modal */}
      <Modal
        isOpen={showCustomWordsModal}
        onClose={() => {setShowCustomWordsModal(false); if(!configForm.customWordPair?.civilian) handleConfigChange('useCustomWords', false);}}
        title="设置自定义词语"
        confirmText="保存设置"
        onConfirm={saveCustomWords}
        type="confirm"
      >
          <div className="space-y-4">
              <div>
                  <label className="text-xs text-gray-400 block mb-1">平民词 (多数派)</label>
                  <input 
                    type="text" 
                    placeholder="例如: 牛奶" 
                    className="w-full p-3 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 outline-none text-white"
                    value={configForm.customWordPair?.civilian}
                    onChange={(e) => handleCustomWordChange('civilian', e.target.value)}
                  />
              </div>
              <div>
                  <label className="text-xs text-gray-400 block mb-1">卧底词 (少数派)</label>
                  <input 
                    type="text" 
                    placeholder="例如: 豆浆" 
                    className="w-full p-3 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 outline-none text-white"
                    value={configForm.customWordPair?.spy}
                    onChange={(e) => handleCustomWordChange('spy', e.target.value)}
                  />
              </div>
          </div>
      </Modal>
    </div>
  );
};
