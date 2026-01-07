const request = require('supertest');
const WebSocket = require('ws');
const { startServer, stopServer } = require('../server');

describe('Step 1 scaffold', () => {
  let app;
  let server;
  let wss;
  let baseUrl;
  let port;

  beforeAll(async () => {
    ({ app, server, wss, port } = await startServer({ port: 0 }));
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await stopServer({ server, wss });
  });

  test('server starts successfully', () => {
    expect(server.listening).toBe(true);
  });

  test('GET /health returns ok true', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  test('GET / returns basic HTML', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('<html');
  });

  test('websocket handshake and echo', (done) => {
    const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);

    ws.on('message', (data) => {
      const payload = JSON.parse(data.toString());
      if (payload.type === 'hello') {
        expect(payload).toEqual({ type: 'hello', message: 'connected' });
        ws.send('ping');
        return;
      }
      if (payload.type === 'echo') {
        expect(payload).toEqual({ type: 'echo', data: 'ping' });
        ws.close();
      }
    });

    ws.on('close', () => done());
    ws.on('error', (err) => done(err));
  });
});
