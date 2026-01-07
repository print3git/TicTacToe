const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const createServer = () => {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('ws connected');
    ws.send(JSON.stringify({ type: 'hello', message: 'connected' }));

    ws.on('message', (data) => {
      ws.send(JSON.stringify({ type: 'echo', data: data.toString() }));
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
