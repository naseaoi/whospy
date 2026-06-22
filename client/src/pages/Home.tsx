import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { generateRandomAvatar, generateRandomName } from '../utils/random';
import { Modal } from '../components/Modal';
import { Dices } from 'lucide-react';

export const Home: React.FC = () => {
  const { createRoom, joinRoom, error, isConnected } = useSocket();
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [avatar, setAvatar] = useState('😎');
  const [showEditName, setShowEditName] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  
  // Available avatars for selection
  const AVATAR_OPTIONS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷', '🐢', '🐍', '🐙', '🦑', '🐠', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🐘', '🦛', '🦏', '🦒', '🦘', '🐎', '🐖', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🦜', '🦢', '🕊', '🐇', '🦝', '🐿', '🦔', '🐉', '🐲', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘', '🍀', '🍃', '🍂', '🍁', '🍄', '💐', '🌷', '🌹', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌚', '🌕', '🌙', '⭐', '🌟', '✨', '⚡', '🔥', '🌈', '☀️', '☁', '❄', '⛄', '🌊', '😎', '🤠', '🤡', '👻', '👽', '🤖', '💩', '💀', '👹', '👺'];

  useEffect(() => {
    // Auto generate name/avatar if not set
    setName(generateRandomName());
    setAvatar(generateRandomAvatar());
  }, []);

  const handleCreate = () => {
    if (!isConnected) return alert("正如您所见，服务器连接中...");
    if (!name) return alert("请输入昵称");
    createRoom(name, avatar);
  };

  const handleJoin = () => {
    if (!isConnected) return alert("正如您所见，服务器连接中...");
    if (!name || !roomId) return alert("请输入昵称和房间号");
    joinRoom(roomId, name, avatar);
  };

  const refreshIdentity = () => {
    setName(generateRandomName()); 
    setAvatar(generateRandomAvatar());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-4 text-blue-500">谁是卧底</h1>
      
      {/* Connection Status Indicator */}
      <div className={`mb-6 text-xs px-2 py-1 rounded-full flex items-center space-x-1 ${isConnected ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'}`}>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
        <span>{isConnected ? '服务器已连接' : '正在连接服务器...'}</span>
      </div>
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md space-y-4 relative overflow-hidden">
        {error && <div className="text-red-500 bg-red-900/20 p-2 rounded text-center">{error}</div>}
        
        {/* Identity Preview Card */}
        <div className="bg-gray-700/50 p-4 rounded-xl flex items-center space-x-4 border border-gray-600 relative group">
            <div 
                className="w-16 h-16 flex items-center justify-center text-4xl bg-gray-800 rounded-full shadow-inner cursor-pointer hover:bg-gray-700 transition relative border border-gray-600 aspect-square"
                onClick={() => setShowAvatarPicker(true)}
            >
                {avatar}
                <div className="absolute -bottom-1 -right-1 bg-gray-600 rounded-full p-1 border border-gray-800 hover:bg-blue-500 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-400 mb-1">你的游戏昵称</div>
                <div 
                    className="font-bold text-lg truncate cursor-pointer hover:text-blue-400 transition flex items-center gap-1.5 group/name"
                    onClick={() => setShowEditName(true)}
                >
                    {name}
                    <div className="p-1 rounded-full bg-gray-700/50 group-hover/name:bg-blue-500/20 transition">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400 group-hover/name:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                             <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                         </svg>
                    </div>
                </div>
            </div>
            <button
                onClick={refreshIdentity}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-600 rounded-full transition"
                title="随机换个身份"
            >
                <Dices size={20} />
            </button>
        </div>

        {/* Edit Name Modal */}
        <Modal
            isOpen={showEditName}
            onClose={() => setShowEditName(false)}
            title="修改昵称"
            confirmText="确定"
            onConfirm={() => {
                if (!name.trim()) setName(generateRandomName());
                setShowEditName(false);
            }}
            type="confirm"
        >
            <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入你的昵称"
                maxLength={10}
                className="w-full p-3 bg-gray-900 rounded-lg border border-gray-700 focus:border-blue-500 outline-none text-white text-center text-lg"
                autoFocus
            />
            <div className="text-center mt-2 text-xs text-gray-500">不输入将使用随机昵称</div>
        </Modal>

        {/* Avatar Picker Modal */}
        <Modal
            isOpen={showAvatarPicker}
            onClose={() => setShowAvatarPicker(false)}
            title="选择头像"
            type="alert"
        >
            <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1 custom-scrollbar">
                {AVATAR_OPTIONS.map((av) => (
                    <button
                        key={av}
                        onClick={() => {
                            setAvatar(av);
                            setShowAvatarPicker(false);
                        }}
                        className={`text-2xl p-2 rounded hover:bg-gray-700 transition ${avatar === av ? 'bg-blue-600/30 ring-2 ring-blue-500' : ''}`}
                    >
                        {av}
                    </button>
                ))}
            </div>
        </Modal>

        {/* Hidden inputs but kept state logic */}
        <div className="hidden">
             <input type="text" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="flex flex-col space-y-3 pt-4 border-t border-gray-700">
          <button 
            onClick={handleCreate}
            disabled={!isConnected}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg transition transform hover:scale-[1.02]"
          >
            {isConnected ? '创建新房间' : '连接中...'}
          </button>
          
          <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-800 px-2 text-gray-500">或者加入</span>
              </div>
          </div>
          
          <div className="flex space-x-2">
            <input 
              type="text" 
              placeholder="输入房间号" 
              className="flex-1 p-3 bg-gray-700/50 rounded-xl border border-gray-600 outline-none focus:border-blue-500 focus:bg-gray-700 transition"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    handleJoin();
                }
              }}
            />
            <button 
              onClick={handleJoin}
              disabled={!isConnected}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02]"
            >
              加入
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-gray-600 text-xs font-mono opacity-50">
         v1.1.0
      </div>
    </div>
  );
};
