import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { RoomManager } from './game/RoomManager';
import { TimerService } from './services/TimerService';
import { SocketHandler } from './handlers/SocketHandler';

const app = express();
app.use(compression());
const PORT = parseInt(process.env.PORT || '3001', 10);

const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`
];

const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

const isOriginAllowed = (origin?: string) => {
  if (!origin) {
    return true;
  }
  if (configuredOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    return true;
  }
  return allowedOrigins.includes(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin not allowed'));
  }
}));

const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1y' : 0,
  etag: true,
  lastModified: true,
}));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Socket origin not allowed'));
    },
    methods: ["GET", "POST"]
  }
});

const ROOM_RECONNECT_GRACE_MS = parseInt(process.env.ROOM_RECONNECT_GRACE_MS || '120000', 10);
const HOST_TRANSFER_GRACE_MS = parseInt(process.env.HOST_TRANSFER_GRACE_MS || '30000', 10);
const OFFLINE_PLAYER_REMOVE_MS = parseInt(process.env.OFFLINE_PLAYER_REMOVE_MS || '10000', 10);

const roomManager = new RoomManager();
const timerService = new TimerService(
  ROOM_RECONNECT_GRACE_MS,
  HOST_TRANSFER_GRACE_MS,
  OFFLINE_PLAYER_REMOVE_MS
);
const socketHandler = new SocketHandler(io, roomManager, timerService);

io.on('connection', (socket) => {
  socketHandler.handleConnection(socket);
});

app.use((req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS Origins: ${allowedOrigins.join(', ')}`);
});
