import React, { lazy, Suspense } from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';

const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Lobby = lazy(() => import('./pages/Lobby').then(m => ({ default: m.Lobby })));
const GameRoom = lazy(() => import('./pages/GameRoom').then(m => ({ default: m.GameRoom })));

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

const LoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const AppContent: React.FC = () => {
  const { room } = useSocket();

  const currentView = !room ? 'home' :
                      room.status === 'WAITING' ? 'lobby' :
                      'game';

  const viewContent = currentView === 'home' ? <Home /> :
                      currentView === 'lobby' ? <Lobby /> :
                      <GameRoom />;

  return (
    <Suspense fallback={<LoadingFallback />}>
      {viewContent}
    </Suspense>
  );
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
