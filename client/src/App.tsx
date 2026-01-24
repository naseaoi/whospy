import React from 'react';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Home } from './pages/Home';
import { Lobby } from './pages/Lobby';
import { GameRoom } from './pages/GameRoom';

const AppContent: React.FC = () => {
  const { room } = useSocket();

  if (!room) {
    return <Home />;
  }

  if (room.status === 'WAITING') {
    return <Lobby />;
  }

  return <GameRoom />;
};

function App() {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
}

export default App;
