const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();

app.get('/health', (req, res) => {
  res.status(200).type('application/json').send('{ "ok": true }');
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

const port = process.env.PORT || 3000;
server.listen(port, '0.0.0.0', () => {
  console.log(`server listening on ${port}`);
});
