import React from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Home } from './pages/Home';
import { Lobby } from './pages/Lobby';
import { GameRoom } from './pages/GameRoom';

const NoticeOverlay: React.FC = () => {
  const { notices } = useSocket();

  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
      {notices.slice(-3).map(notice => (
        <div
          key={notice.id}
          className="bg-gray-800/80 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5 text-xs text-blue-100 shadow-[0_4px_20px_rgba(0,0,0,0.4)] animate-fade-in-down w-full text-center"
        >
          {notice.message}
        </div>
      ))}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { room } = useSocket();
  const [currentView, setCurrentView] = React.useState<'home' | 'lobby' | 'game'>('home');

  React.useEffect(() => {
    if (!room) {
      setCurrentView('home');
      return;
    }

    if (room.status === 'WAITING') {
      setCurrentView('lobby');
      return;
    }

    if (room.status === 'PLAYING' || room.status === 'GAME_OVER') {
      setCurrentView('game');
    }
  }, [room?.status, room?.id]);

  if (currentView === 'home') {
    return <Home />;
  }

  if (currentView === 'lobby') {
    return <Lobby />;
  }

  return <GameRoom />;
};

function App() {
  return (
    <SocketProvider>
      <NoticeOverlay />
      <AppContent />
    </SocketProvider>
  );
}

export default App;
