const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 4;

const generateRoomId = (rooms) => {
  let roomId = '';
  do {
    roomId = Array.from({ length: ROOM_ID_LENGTH }, () =>
      ROOM_ID_CHARS.charAt(Math.floor(Math.random() * ROOM_ID_CHARS.length)),
    ).join('');
  } while (rooms.has(roomId));
  return roomId;
};

const createServer = () => {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/ws' });
  const rooms = new Map();
  const socketToRoom = new Map();

  const sendMessage = (socket, payload) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const broadcastRoomState = (room) => {
    if (!room) {
      return;
    }
    const payload = {
      type: 'game_state',
      roomId: room.roomId,
      status: room.status,
    };
    sendMessage(room.players.X, payload);
    sendMessage(room.players.O, payload);
  };

  const cleanupRoomIfEmpty = (room) => {
    if (!room) {
      return;
    }
    if (!room.players.X && !room.players.O) {
      rooms.delete(room.roomId);
      console.log(`room ${room.roomId} removed (empty)`);
    }
  };

  wss.on('connection', (ws) => {
    console.log('ws connected');
    ws.send(JSON.stringify({ type: 'hello', message: 'connected' }));

    ws.on('message', (data) => {
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (error) {
        ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
        return;
      }

      if (!message || typeof message.type !== 'string') {
        sendMessage(ws, { type: 'error', message: 'Invalid message format.' });
        return;
      }

      if (message.type === 'create_game') {
        if (socketToRoom.has(ws)) {
          sendMessage(ws, { type: 'error', message: 'Already in a room.' });
          return;
        }

        const roomId = generateRoomId(rooms);
        const room = {
          roomId,
          players: { X: ws, O: null },
          status: 'waiting',
        };
        rooms.set(roomId, room);
        socketToRoom.set(ws, roomId);
        console.log(`room ${roomId} created`);
        sendMessage(ws, { type: 'game_created', roomId, player: 'X' });
        broadcastRoomState(room);
        return;
      }

      if (message.type === 'join_game') {
        if (socketToRoom.has(ws)) {
          sendMessage(ws, { type: 'error', message: 'Already in a room.' });
          return;
        }

        const roomId = message.roomId;
        if (typeof roomId !== 'string' || !rooms.has(roomId)) {
          sendMessage(ws, { type: 'error', message: 'Room not found.' });
          return;
        }

        const room = rooms.get(roomId);
        if (room.players.O) {
          sendMessage(ws, { type: 'error', message: 'Room is full.' });
          return;
        }

        room.players.O = ws;
        room.status = 'ready';
        socketToRoom.set(ws, roomId);
        console.log(`room ${roomId} joined`);
        sendMessage(ws, { type: 'game_joined', roomId, player: 'O' });
        broadcastRoomState(room);
        return;
      }

      ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
    });

    ws.on('close', () => {
      const roomId = socketToRoom.get(ws);
      if (!roomId) {
        return;
      }
      socketToRoom.delete(ws);
      const room = rooms.get(roomId);
      if (!room) {
        return;
      }
      if (room.players.X === ws) {
        room.players.X = null;
      }
      if (room.players.O === ws) {
        room.players.O = null;
      }
      room.status = room.players.X && room.players.O ? 'ready' : 'waiting';
      console.log(`ws disconnected from room ${roomId}`);
      broadcastRoomState(room);
      cleanupRoomIfEmpty(room);
    });
  });

  return { app, server, wss };
};

const startServer = ({ port = 0, host = '0.0.0.0' } = {}) =>
  new Promise((resolve, reject) => {
    const { app, server, wss } = createServer();
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        app,
        server,
        wss,
        host,
        port: typeof address === 'object' && address ? address.port : port,
      });
    });
  });

const stopServer = ({ server, wss } = {}) =>
  new Promise((resolve, reject) => {
    if (wss) {
      wss.close();
    }
    if (!server) {
      resolve();
      return;
    }
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

if (require.main === module) {
  const port = process.env.PORT || 3000;
  startServer({ port, host: '0.0.0.0' }).then(({ port: boundPort }) => {
    console.log(`server listening on ${boundPort}`);
  });
}

module.exports = { createServer, startServer, stopServer };
