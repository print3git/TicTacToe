# Remote Tic-Tac-Toe (Step 1)

A minimal Node.js scaffold that serves a static frontend and exposes a WebSocket endpoint.

## Prerequisites

- Node.js LTS
- npm

## Local run

```sh
npm install
npm start
```

Open the app:

- http://localhost:3000/
- http://localhost:3000/health

WebSocket endpoint:

- ws://localhost:3000/ws

## What it does

- Serves static files from `public/` at `/`.
- `GET /health` returns `{ "ok": true }`.
- WebSocket server at `/ws`.
