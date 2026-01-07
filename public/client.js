(() => {
  const statusEl = document.getElementById('status');
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${protocol}://${window.location.host}/ws`;
  const socket = new WebSocket(wsUrl);

  const setStatus = (text) => {
    statusEl.textContent = text;
  };

  socket.addEventListener('open', () => {
    setStatus('connected');
    socket.send('ping');
  });

  socket.addEventListener('close', () => {
    setStatus('disconnected');
  });

  socket.addEventListener('error', () => {
    setStatus('error');
  });

  socket.addEventListener('message', (event) => {
    console.log('ws message', event.data);
  });
})();
