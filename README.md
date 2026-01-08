# Remote Tic-Tac-Toe

## Project Overview
A lightweight remote multiplayer tic-tac-toe game built with Node.js and WebSockets. It uses **server-authoritative state** so the server validates moves, enforces turns, and decides win/draw outcomes for fairness and consistency.

## Live Demo
**Live Demo:** https://tictactoe-1xz8.onrender.com/

## How to Play
1. Open the live URL.
2. Player A clicks **Create game** to generate a room ID.
3. Player B enters the room ID and clicks **Join game**.
4. Players take turns placing marks on the board.
5. The server announces a win or a draw when the game ends.
6. Use **Play Again** to reset, or **Leave Room** to exit.

## Local Development
**Prerequisites:** Node.js (LTS recommended)

Install dependencies:
```sh
npm install
```

Run locally:
```sh
npm start
```

Open the app at:
- http://localhost:3000/

The WebSocket endpoint runs at:
- ws://localhost:3000/ws

## Testing
Run the automated tests:
```sh
npm test
```

Test coverage is automated and the project runs in CI via GitHub Actions.

## Design Decisions / Trade-offs
- In-memory game state (no database) for simplicity and scope control.
- Server-authoritative logic for fairness and consistent outcomes.
- WebSockets enable real-time multiplayer play.
- Minimal UI focus for clarity over theming.
- Free-tier hosting constraints inform feature scope.

## Scope Statement
This project is intentionally a modest MVP focused on correctness, robustness, and clarity over extra features.
