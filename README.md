# Kari Teeri

Kari Teeri is a full-stack multiplayer trick-taking card game built with React, Vite, Tailwind CSS, Framer Motion, Node.js, Express, TypeScript, and Socket.IO. The app includes a premium landing page, shareable real-time rooms, a live lobby, an authoritative in-memory game engine, reconnect support, and a felt-table game UI.

## Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS + Framer Motion
- Backend: Node.js + Express + TypeScript
- Realtime: Socket.IO
- Shared models: `shared/src`
- Persistence: in-memory room/session store

## Project structure

```text
.
├── client
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.cjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src
│       ├── App.tsx
│       ├── index.css
│       ├── main.tsx
│       ├── components
│       ├── hooks
│       ├── lib
│       ├── screens
│       └── utils
├── server
│   ├── package.json
│   ├── tsconfig.json
│   └── src
│       ├── game
│       ├── index.ts
│       ├── roomManager.ts
│       ├── socketHandlers.ts
│       ├── types.ts
│       └── utils.ts
├── shared
│   ├── package.json
│   ├── tsconfig.json
│   └── src
│       ├── constants.ts
│       ├── index.ts
│       ├── socket.ts
│       └── types.ts
├── package.json
├── tsconfig.base.json
└── README.md
```

## Setup

1. Install Node.js 20 or newer.
2. From the repo root, run:

```bash
npm install
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173).

The Socket.IO server runs on `http://localhost:3001` by default.

## Production build

```bash
npm run build
```

## Deploy to a real website

The simplest production setup for this game is a single Node web service that serves both the Socket.IO server and the built React app from the same URL. That keeps rooms, WebSockets, and reconnect behavior on one origin.

### Render deployment

This repo includes [render.yaml](C:/Users/shiva/Documents/kari_teeri/render.yaml), so you can deploy it as one Render web service.

1. Push this repo to GitHub.
2. In Render, choose **New +** then **Blueprint**.
3. Select your repo and let Render read the included `render.yaml`.
4. Deploy the `kari-teeri` web service.
5. Open the generated Render URL and share that single link with friends.

The service will:

- install dependencies from the repo root
- build `shared`, `server`, and `client`
- start the Express + Socket.IO server
- serve the built Vite app from the same public URL

Notes:

- This game uses in-memory room/session storage, so rooms disappear when the server restarts or a new deploy rolls out.
- Keep the service on a single instance unless you later move room state into a shared external store.
- The included Render blueprint uses the free web-service plan by default, which is good for testing but can cold-start after idle periods. If you want a more always-on feel, switch the service to a paid plan in Render.
- For the smoothest tooling support, use Node.js 20+ locally and in production.
- If you want a custom domain, you can add it in Render after the first deploy.

## How to play

1. Enter a player name on the home page.
2. Create a room or join one with a 6-character code.
3. Share the invite link or room code.
4. The host sets the lobby options and starts the game once at least 4 players are seated.
5. Bidding, partner selection, trump selection, trick play, and scoring all run through the server-authoritative engine.

## Solo testing with smart bots

1. Create a room by yourself.
2. In the lobby, use the `Smart Bots` panel on the right.
3. Click `Fill To Start` to add enough smart bots to reach the 4-player minimum.
4. Click `Fill To Max` if you want to simulate a completely full table at the current room size.
5. Click `Start Game` as the host.
6. You can also add or remove individual smart bots before the game starts.

Notes:

- Smart bots take real seats and play automatically on the server.
- If a human tries to join a full lobby that contains bots, a bot will step aside automatically to free a seat.
- Bots do not keep an otherwise-empty room alive; the room still expires once no human players remain connected or reconnectable.

## Gameplay implementation notes

- Player counts from 4 to 8 are supported.
- Deck trimming follows the deterministic two-removal order from the prompt.
- The `3♠` is implemented as Kali Teeri: 30 points, always trump, highest trump.
- If every player passes during bidding, the same dealer redeals.
- Explicit leaves remove a player immediately. Disconnects hold a seat briefly for refresh/reconnect.
- Smart bots can be added in the lobby for solo or short-handed testing.
- Rooms are destroyed when no human players remain connected or reconnectable.
- To support rotating partnerships across multiple hands, each player on a side receives that side's awarded hand score in their personal cumulative total.

## Scripts

At the repo root:

- `npm run dev`: runs shared type build watch, server dev mode, and Vite dev server
- `npm run build`: builds shared, server, and client

Per package:

- `npm run dev --workspace shared`
- `npm run dev --workspace server`
- `npm run dev --workspace client`

## Local constraints in this workspace

This workspace did not have `node`, `npm`, or `tsc` installed in the current environment, so the code could not be executed or typechecked here. The project files are ready for a normal Node.js environment.
