(() => {
  const connectionStatusEl = document.getElementById('connection-status');
  const createGameButton = document.getElementById('create-game');
  const joinGameButton = document.getElementById('join-game');
  const roomInput = document.getElementById('room-input');
  const roomIdEl = document.getElementById('room-id');
  const playerSymbolEl = document.getElementById('player-symbol');
  const gameMessageEl = document.getElementById('game-message');
  const errorMessageEl = document.getElementById('error-message');
  const boardEl = document.getElementById('board');
  const boardSquares = Array.from(document.querySelectorAll('.square'));
  const playAgainButton = document.getElementById('play-again');
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws`;
  const socket = new WebSocket(wsUrl);

  let currentRoomId = null;
  let playerSymbol = null;
  let gameState = null;

  const setConnectionStatus = (text) => {
    connectionStatusEl.textContent = text;
  };

  const setGameMessage = (text) => {
    gameMessageEl.textContent = text;
  };

  const setError = (text) => {
    errorMessageEl.textContent = text || '';
  };

  const updateRoomDetails = () => {
    roomIdEl.textContent = currentRoomId || '—';
    playerSymbolEl.textContent = playerSymbol || '—';
  };

  const isPlayersTurn = () =>
    gameState &&
    gameState.status === 'playing' &&
    playerSymbol &&
    gameState.turn === playerSymbol;

  const updateBoard = () => {
    const board = gameState && Array.isArray(gameState.board) ? gameState.board : [];
    boardSquares.forEach((square, index) => {
      const value = board[index] || '';
      square.textContent = value;
      const isDisabled =
        !gameState ||
        gameState.status !== 'playing' ||
        !isPlayersTurn() ||
        Boolean(value);
      square.disabled = isDisabled;
    });
  };

  const updateGameStatus = () => {
    if (!currentRoomId) {
      setGameMessage('Create or join a game to begin.');
      playAgainButton.hidden = true;
      return;
    }

    if (!gameState) {
      setGameMessage('Waiting for another player to join...');
      playAgainButton.hidden = true;
      return;
    }

    if (gameState.status === 'playing') {
      const turnText = gameState.turn ? `${gameState.turn}'s turn` : 'Waiting for turn...';
      setGameMessage(turnText);
      playAgainButton.hidden = true;
      return;
    }

    if (gameState.status === 'ended') {
      if (gameState.winner === 'draw') {
        setGameMessage('Game over: Draw.');
      } else if (gameState.winner) {
        setGameMessage(`Game over: ${gameState.winner} wins.`);
      } else {
        setGameMessage('Game over.');
      }
      playAgainButton.hidden = false;
      return;
    }

    setGameMessage(`Game status: ${gameState.status}`);
    playAgainButton.hidden = true;
  };

  const render = () => {
    updateRoomDetails();
    updateGameStatus();
    updateBoard();
  };

  const sendMessage = (payload) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  socket.addEventListener('open', () => {
    setConnectionStatus('connected');
  });

  socket.addEventListener('close', () => {
    setConnectionStatus('disconnected');
  });

  socket.addEventListener('error', () => {
    setConnectionStatus('error');
  });

  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.warn('Unexpected message', event.data);
      return;
    }

    if (!message || typeof message.type !== 'string') {
      console.warn('Unknown message shape', message);
      return;
    }

    if (message.type === 'hello') {
      return;
    }

    if (message.type === 'error') {
      setError(message.message || 'Something went wrong.');
      return;
    }

    setError('');

    if (message.type === 'game_created') {
      currentRoomId = message.roomId || null;
      playerSymbol = message.player || null;
      gameState = null;
      render();
      return;
    }

    if (message.type === 'game_joined') {
      currentRoomId = message.roomId || currentRoomId;
      playerSymbol = message.player || playerSymbol;
      render();
      return;
    }

    if (message.type === 'game_state') {
      gameState = {
        roomId: message.roomId,
        board: Array.isArray(message.board) ? message.board : [],
        turn: message.turn,
        status: message.status,
        winner: message.winner,
      };
      render();
      return;
    }
  });

  createGameButton.addEventListener('click', () => {
    setError('');
    sendMessage({ type: 'create_game' });
  });

  joinGameButton.addEventListener('click', () => {
    const roomId = roomInput.value.trim().toUpperCase();
    if (!roomId) {
      setError('Enter a room ID to join.');
      return;
    }
    setError('');
    sendMessage({ type: 'join_game', roomId });
  });

  boardEl.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }
    const index = Number(target.dataset.index);
    if (!Number.isInteger(index)) {
      return;
    }
    if (!currentRoomId || !gameState || gameState.status !== 'playing') {
      return;
    }
    if (!isPlayersTurn()) {
      return;
    }
    if (gameState.board && gameState.board[index]) {
      return;
    }
    sendMessage({ type: 'make_move', roomId: currentRoomId, index });
  });

  playAgainButton.addEventListener('click', () => {
    if (!currentRoomId) {
      return;
    }
    sendMessage({ type: 'play_again', roomId: currentRoomId });
  });

  render();
})();
