const request = require('supertest');
const WebSocket = require('ws');
const { startServer, stopServer } = require('../server');

const waitForMessage = (ws, predicate, timeout = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error('Timed out waiting for message'));
    }, timeout);

    const handler = (data) => {
      let payload;
      try {
        payload = JSON.parse(data.toString());
      } catch (error) {
        return;
      }
      if (predicate(payload)) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(payload);
      }
    };

    ws.on('message', handler);
    ws.on('error', (error) => {
      clearTimeout(timer);
      ws.off('message', handler);
      reject(error);
    });
  });

const connectClient = async (url, clients) => {
  const ws = new WebSocket(url);
  await waitForMessage(ws, (payload) => payload.type === 'hello');
  if (clients) {
    clients.push(ws);
  }
  return ws;
};

const closeClient = (ws) =>
  new Promise((resolve) => {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once('close', resolve);
    ws.close();
  });

const createGameWithTwoPlayers = async (wsX, wsO) => {
  wsX.send(JSON.stringify({ type: 'create_game' }));
  const created = await waitForMessage(wsX, (payload) => payload.type === 'game_created');
  wsO.send(JSON.stringify({ type: 'join_game', roomId: created.roomId }));
  const joined = await waitForMessage(wsO, (payload) => payload.type === 'game_joined');
  const state = await waitForMessage(wsX, (payload) => payload.type === 'game_state');
  return { roomId: created.roomId, created, joined, state };
};

describe('tic-tac-toe gameplay', () => {
  let app;
  let server;
  let wss;
  let baseUrl;
  let port;
  let clients;

  beforeAll(async () => {
    ({ app, server, wss, port } = await startServer({ port: 0 }));
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(() => {
    clients = [];
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => closeClient(client)));
  });

  afterAll(async () => {
    await stopServer({ server, wss });
  });

  test('game flow: create/join assigns players and initial state', async () => {
    const wsX = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);
    const wsO = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);

    const { created, joined, state } = await createGameWithTwoPlayers(wsX, wsO);

    expect(created.player).toBe('X');
    expect(joined.player).toBe('O');
    expect(state.board).toEqual(Array(9).fill(''));
    expect(state.turn).toBe('X');
    expect(state.status).toBe('playing');

  });

  test('moves: valid moves update board and alternate turns, invalid moves rejected', async () => {
    const wsX = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);
    const wsO = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);

    const { roomId } = await createGameWithTwoPlayers(wsX, wsO);

    wsX.send(JSON.stringify({ type: 'make_move', roomId, index: 0 }));
    const stateAfterX = await waitForMessage(
      wsX,
      (payload) => payload.type === 'game_state' && payload.board[0] === 'X',
    );
    expect(stateAfterX.board[0]).toBe('X');
    expect(stateAfterX.turn).toBe('O');

    wsO.send(JSON.stringify({ type: 'make_move', roomId, index: 1 }));
    const stateAfterO = await waitForMessage(
      wsO,
      (payload) => payload.type === 'game_state' && payload.board[1] === 'O',
    );
    expect(stateAfterO.board[1]).toBe('O');
    expect(stateAfterO.turn).toBe('X');

    wsO.send(JSON.stringify({ type: 'make_move', roomId, index: 2 }));
    const wrongTurnError = await waitForMessage(
      wsO,
      (payload) => payload.type === 'error' && payload.message === 'Not your turn.',
    );
    expect(wrongTurnError.message).toBe('Not your turn.');

    wsX.send(JSON.stringify({ type: 'make_move', roomId, index: 1 }));
    const occupiedError = await waitForMessage(
      wsX,
      (payload) => payload.type === 'error' && payload.message === 'Square already occupied.',
    );
    expect(occupiedError.message).toBe('Square already occupied.');

  });

  test('game end: detects win and status/winner updates', async () => {
    const wsX = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);
    const wsO = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);

    const { roomId } = await createGameWithTwoPlayers(wsX, wsO);

    const moves = [
      { player: wsX, index: 0 },
      { player: wsO, index: 3 },
      { player: wsX, index: 1 },
      { player: wsO, index: 4 },
      { player: wsX, index: 2 },
    ];

    let lastState;
    for (const move of moves) {
      move.player.send(JSON.stringify({ type: 'make_move', roomId, index: move.index }));
      lastState = await waitForMessage(
        move.player,
        (payload) => payload.type === 'game_state' && payload.board[move.index] !== '',
      );
    }

    expect(lastState.status).toBe('ended');
    expect(lastState.winner).toBe('X');
  });

  test('game end: detects draw and updates status', async () => {
    const wsX = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);
    const wsO = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);

    const { roomId } = await createGameWithTwoPlayers(wsX, wsO);

    const moves = [
      { player: wsX, index: 0 },
      { player: wsO, index: 1 },
      { player: wsX, index: 2 },
      { player: wsO, index: 4 },
      { player: wsX, index: 3 },
      { player: wsO, index: 5 },
      { player: wsX, index: 7 },
      { player: wsO, index: 6 },
      { player: wsX, index: 8 },
    ];

    let lastState;
    for (const move of moves) {
      move.player.send(JSON.stringify({ type: 'make_move', roomId, index: move.index }));
      lastState = await waitForMessage(
        move.player,
        (payload) => payload.type === 'game_state' && payload.board[move.index] !== '',
      );
    }

    expect(lastState.status).toBe('ended');
    expect(lastState.winner).toBe('draw');
  });

  test('play again resets board and status', async () => {
    const wsX = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);
    const wsO = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);

    const { roomId } = await createGameWithTwoPlayers(wsX, wsO);

    const moves = [
      { player: wsX, index: 0 },
      { player: wsO, index: 3 },
      { player: wsX, index: 1 },
      { player: wsO, index: 4 },
      { player: wsX, index: 2 },
    ];

    let lastState;
    for (const move of moves) {
      move.player.send(JSON.stringify({ type: 'make_move', roomId, index: move.index }));
      lastState = await waitForMessage(
        move.player,
        (payload) => payload.type === 'game_state' && payload.board[move.index] !== '',
      );
    }

    expect(lastState.status).toBe('ended');

    wsX.send(JSON.stringify({ type: 'play_again', roomId }));
    const resetState = await waitForMessage(wsX, (payload) => payload.type === 'game_state');
    expect(resetState.status).toBe('playing');
    expect(resetState.turn).toBe('X');
    expect(resetState.board).toEqual(Array(9).fill(''));

  });

  test('robustness: invalid room id and full room errors', async () => {
    const wsX = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);
    const wsO = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);
    const wsExtra = await connectClient(`${baseUrl.replace('http', 'ws')}/ws`, clients);

    wsX.send(JSON.stringify({ type: 'create_game' }));
    const created = await waitForMessage(wsX, (payload) => payload.type === 'game_created');

    wsO.send(JSON.stringify({ type: 'join_game', roomId: created.roomId }));
    await waitForMessage(wsO, (payload) => payload.type === 'game_joined');
    await waitForMessage(wsX, (payload) => payload.type === 'game_state');

    wsExtra.send(JSON.stringify({ type: 'join_game', roomId: created.roomId }));
    const fullRoomError = await waitForMessage(
      wsExtra,
      (payload) => payload.type === 'error' && payload.message === 'Room is full.',
    );
    expect(fullRoomError.message).toBe('Room is full.');

    wsExtra.send(JSON.stringify({ type: 'join_game', roomId: 'ZZZZ' }));
    const invalidRoomError = await waitForMessage(
      wsExtra,
      (payload) => payload.type === 'error' && payload.message === 'Room not found.',
    );
    expect(invalidRoomError.message).toBe('Room not found.');

  });

  test('health check uses HTTP helper', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
