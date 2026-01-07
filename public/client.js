(() => {
  const connectionStatusEl = document.getElementById('connection-status');
  const connectionPillEl = document.getElementById('connection-pill');
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
  const leaveRoomButton = document.getElementById('leave-room');
  const leaveRoomModal = document.getElementById('leave-room-modal');
  const leaveRoomCancelButton = document.getElementById('cancel-leave-room');
  const leaveRoomConfirmButton = document.getElementById('confirm-leave-room');
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws`;
  const socket = new WebSocket(wsUrl);

  let currentRoomId = null;
  let playerSymbol = null;
  let gameState = null;
  let lobbyMessage = 'Create or join a game to begin.';
  let isLeaveModalOpen = false;
  let lastFocusedElement = null;

  const setConnectionStatus = (text) => {
    connectionStatusEl.textContent = text;
    if (connectionPillEl) {
      connectionPillEl.dataset.status = text;
    }
  };

  const setGameMessage = (text, state = 'idle') => {
    gameMessageEl.textContent = text;
    gameMessageEl.dataset.state = state;
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
      square.dataset.value = value;
      square.classList.toggle('has-mark', Boolean(value));
      const isDisabled =
        !gameState ||
        gameState.status !== 'playing' ||
        !isPlayersTurn() ||
        Boolean(value);
      square.disabled = isDisabled;
    });
    boardEl.classList.toggle('is-hidden', !gameState);
    boardEl.classList.toggle('is-disabled', !gameState || gameState.status !== 'playing');
  };

  const updateGameStatus = () => {
    if (!currentRoomId) {
      setGameMessage(lobbyMessage, 'idle');
      playAgainButton.hidden = true;
      return;
    }

    if (!gameState) {
      setGameMessage('Waiting for opponent...', 'waiting');
      playAgainButton.hidden = true;
      return;
    }

    if (gameState.status === 'playing') {
      if (isPlayersTurn()) {
        setGameMessage('Your turn', 'your-turn');
      } else {
        setGameMessage('Opponent’s turn', 'opponent-turn');
      }
      playAgainButton.hidden = true;
      return;
    }

    if (gameState.status === 'ended') {
      if (gameState.winner === 'draw') {
        setGameMessage('Draw', 'draw');
      } else if (gameState.winner) {
        setGameMessage(gameState.winner === playerSymbol ? 'You won' : 'You lost', gameState.winner === playerSymbol ? 'win' : 'loss');
      } else {
        setGameMessage('Game over', 'ended');
      }
      playAgainButton.hidden = false;
      return;
    }

    setGameMessage(`Game status: ${gameState.status}`, 'ended');
    playAgainButton.hidden = true;
  };

  const render = () => {
    updateRoomDetails();
    updateGameStatus();
    updateBoard();
    leaveRoomButton.hidden = !currentRoomId;
  };

  const sendMessage = (payload) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const resetToLobby = (message) => {
    currentRoomId = null;
    playerSymbol = null;
    gameState = null;
    lobbyMessage = message || 'Create or join a game to begin.';
    render();
  };

  const getLeaveModalFocusable = () => {
    if (!leaveRoomModal) {
      return [];
    }
    return Array.from(
      leaveRoomModal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled'));
  };

  const closeLeaveRoomModal = () => {
    if (!leaveRoomModal || !isLeaveModalOpen) {
      return;
    }
    isLeaveModalOpen = false;
    leaveRoomModal.classList.remove('is-visible');
    leaveRoomModal.hidden = true;
    document.body.classList.remove('is-modal-open');
    document.removeEventListener('keydown', handleLeaveModalKeydown);
    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  };

  const openLeaveRoomModal = () => {
    if (!leaveRoomModal || isLeaveModalOpen) {
      return;
    }
    isLeaveModalOpen = true;
    lastFocusedElement = document.activeElement;
    leaveRoomModal.hidden = false;
    requestAnimationFrame(() => {
      leaveRoomModal.classList.add('is-visible');
    });
    document.body.classList.add('is-modal-open');
    document.addEventListener('keydown', handleLeaveModalKeydown);
    const focusables = getLeaveModalFocusable();
    const fallbackTarget = leaveRoomCancelButton || focusables[0] || leaveRoomModal;
    if (fallbackTarget instanceof HTMLElement) {
      fallbackTarget.focus();
    }
  };

  const confirmLeaveRoom = () => {
    if (!currentRoomId) {
      return;
    }
    setError('');
    sendMessage({ type: 'leave_room', roomId: currentRoomId });
    resetToLobby();
  };

  const handleLeaveModalKeydown = (event) => {
    if (!isLeaveModalOpen) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLeaveRoomModal();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusables = getLeaveModalFocusable();
    if (!focusables.length) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
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
      lobbyMessage = 'Create or join a game to begin.';
      render();
      return;
    }

    if (message.type === 'game_joined') {
      currentRoomId = message.roomId || currentRoomId;
      playerSymbol = message.player || playerSymbol;
      lobbyMessage = 'Create or join a game to begin.';
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

    if (message.type === 'opponent_left') {
      const roomId = currentRoomId;
      setError('');
      resetToLobby('Opponent left the game.');
      if (roomId) {
        sendMessage({ type: 'leave_room', roomId });
      }
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

  leaveRoomButton.addEventListener('click', () => {
    if (!currentRoomId) {
      return;
    }
    openLeaveRoomModal();
  });

  if (leaveRoomModal) {
    leaveRoomModal.addEventListener('click', (event) => {
      if (event.target === leaveRoomModal) {
        closeLeaveRoomModal();
      }
    });
  }

  if (leaveRoomCancelButton) {
    leaveRoomCancelButton.addEventListener('click', () => {
      closeLeaveRoomModal();
    });
  }

  if (leaveRoomConfirmButton) {
    leaveRoomConfirmButton.addEventListener('click', () => {
      closeLeaveRoomModal();
      confirmLeaveRoom();
    });
  }

  render();
})();
