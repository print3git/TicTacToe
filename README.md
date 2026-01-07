# Remote Tic-Tac-Toe (Step 1)

A minimal Node.js scaffold that serves a static frontend and exposes a WebSocket endpoint.

Deployed on Render.

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

## Deployment (Render)

- Service type: Render Web Service (free tier).
- Build command: `npm install`
- Start command: `npm start`
- Deployed URL: `https://<app-name>.onrender.com`

## What it does

- Serves static files from `public/` at `/`.
- `GET /health` returns `{ "ok": true }`.
- WebSocket server at `/ws`.
