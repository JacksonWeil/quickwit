# Quickwit

Quickwit is a live, browser-based party game for 3–8 players. The first game mode, **Quick Wit**, gives every player two playful prompts, puts answers into anonymous head-to-head matchups, and lets the rest of the room vote.

## What works

- Create or join a room with a four-letter code
- Live lobby with automatic host handoff
- Two-round Quick Wit game with prompt assignment and score multipliers
- Anonymous voting and a live leaderboard
- Responsive phone and desktop interface
- Tested server-side game state

Trivia is the next planned game mode. The room and player model is designed to support it without replacing the multiplayer foundation.

## Run locally

Requires Node.js 20.10 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. To simulate a group locally, open the page in several browser profiles or private windows.

## Verify and build

```bash
npm test
npm run typecheck
npm run build
npm start
```

The production server runs on port `3001` by default and serves the built client. Set `PORT` or `CLIENT_URL` using the values shown in `.env.example` when needed.

## Put it on GitHub

After creating an empty repository named `quickwit` on GitHub:

```bash
git remote add origin https://github.com/YOUR_USERNAME/quickwit.git
git push -u origin main
```

## Roadmap

1. Reconnect tokens so a player can refresh mid-game
2. Timers, answer reveals, vote breakdowns, and host display mode
3. Trivia mode with question packs and configurable rounds
4. Persistent accounts, custom content, moderation, and deployment storage

## License

MIT
