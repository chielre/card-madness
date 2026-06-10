# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before making changes.

## What this is

**Card Madness** — a browser-based multiplayer card game in the style of *Cards Against Humanity*.
A host opens a lobby (5-digit code), players join, and rounds cycle through a card-czar picking a winning answer.

The repo contains **two deployable parts**:

- **Client** — Vue 3 SPA (this repo root, `src/`), built with Vite, deployed to GitHub Pages.
- **Server** — Node.js + TypeScript WebSocket server (`server/`), holds all game state in memory and drives the game flow over Socket.IO.

The **card content (packs) lives in a separate repository** ([`chielre/card-madness-packs`](https://github.com/chielre/card-madness-packs)) for licensing reasons:
- This code is **MIT** (see [LICENSE](LICENSE)).
- The community packs are **CC BY-NC-SA 4.0 — non-commercial** (see [packs/LICENSE](packs/LICENSE) after install).

Because of that split, the `packs/` directory is **git-ignored** and populated at build time by a download script. Do not commit pack content into this repo, and keep code MIT-clean (no copied card text).

## Layout

```
.
├── src/                     # Vue 3 client
│   ├── pages/               # routed views (Main, CreateLobby, Lobby, Join, Dev, ConnectionError)
│   ├── components/          # game/, modals/, screens/, ui/ (BaseButton/Modal/Select, ToggleSwitch)
│   ├── store/               # Pinia stores: LobbyStore, ConnectionStore, AudioStore, UiStore
│   ├── ws/socket.ts         # singleton socket.io-client connection
│   ├── utils/cards.ts       # resolve black/white card text + :name / :answer templating
│   ├── types/lobbySettings.ts
│   ├── router/index.ts
│   ├── i18n.ts, locales/    # vue-i18n (en, nl)
│   └── assets/              # audio, images, packs (card art)
├── server/                  # WebSocket game server (TypeScript, ESM, compiled to dist/)
│   ├── server.ts            # entry: creates io server, monitoring, console
│   ├── io/*.handlers.ts     # socket event handlers by domain, wired in registerHandlers.ts
│   ├── services/            # gameService (core rules), phaseFlowService, phaseService, PackService, botService, socketRoomService
│   ├── state/store.ts       # in-memory Maps: games, socketRooms, timers
│   ├── config/              # lobbySettings, phaseDurations, points, player defaults
│   ├── types/               # Room, Player, Cards, Pack, Timers
│   ├── utils/               # cards, packs, timers, selectionLockTimers, monitoring
│   └── console.ts           # live terminal dashboard (chalk + log-update)
├── scripts/                 # install-packs.mjs, install-packs-on-build.mjs, packs-lib.mjs
├── packs/                   # DOWNLOADED card content — git-ignored, do not commit
├── docker/                  # docker-compose: server + prometheus + grafana
└── .env / .env.example      # SHARED config for client and server (lives in repo root)
```

## Build & run

All commands run with **Node 20** and **npm**. Tested in **Git Bash** on Windows (other shells may work).

**Client** (from repo root):
```bash
npm install
npm run dev        # vite dev server (predev auto-runs install-packs-on-build)
npm run build      # vite build → dist/ (prebuild auto-runs install-packs-on-build)
npm run install-packs   # manually (re)download community packs
```

**Server** (from `server/`):
```bash
cd server
npm install
npm run start      # prestart runs `npm install && tsc`, then `node dist/server.js`
```
> The server compiles TS to `server/dist/` via `tsc -p tsconfig.json`. There is **no test suite** and **no linter** configured — verify changes by running the app.

**Docker** (full stack incl. monitoring): `docker compose -f docker/docker-compose.yml up`.

## Configuration

A **single `.env` in the repo root** is shared by both sides (see [.env.example](.env.example)):
- The client reads it via Vite `loadEnv` (only the keys explicitly listed in `vite.config.ts` `define`, plus `VITE_*`).
- The server reads it via `dotenv.config({ path: "../.env" })` — i.e. relative to `server/`, pointing back at the root file.

Key vars: `SERVER_WS_PORT`/`SERVER_WS_HOST`/`WS_ORIGINS` (CORS), `VITE_WS_SERVER_URL`, `PACKS_DIR`, the `COMMUNITY_PACKS_*` flags, and `DEV_SKIP_*` debug shortcuts. `STAGE=development` unlocks dev behavior.

## Architecture: the big picture

**The server is the single source of truth; the client is a mirror + a renderer.** All game state lives in `server/state/store.ts` as in-memory `Map`s keyed by the 5-digit lobby code (no database — restarting the server drops every lobby). Clients never decide game outcomes; they send intents and render whatever the server broadcasts back. When in doubt about where logic belongs: **rules and scoring go on the server, animation and presentation go on the client.**

### Server architecture (layers, inside `server/`)

The server is layered by responsibility — respect the layering when adding code:

- **`io/*.handlers.ts` — socket entry points.** One file per domain (`room`, `player`, `packs`, `round`, `dev`), all wired in `registerHandlers.ts` (called once per connection). A handler's job is thin: validate the payload, call a service, then `emit` results and/or reply through the ack callback `cb`. Don't put game rules here.
- **`services/` — the brains.**
  - `gameService.ts` — (mostly) pure state mutations on a lobby: create/join/leave, deal cards, select/unselect/lock cards, `selectCzarCard`, `swapPlayerCard`, the czar-rating tally, and `setPhase` (the **phase transition validator** — the legal-transition map lives here). Functions return `{ error }` or `{ game, ... }`; they mutate the `Map` and don't emit.
  - `phaseService.ts` — `transitionPhase()` is the **single gate** that changes phase: it calls `setPhase`, emits `room:phase-changed`, and runs phase side effects (start the round timer on `board`, reset the lobby on `lobby`). Always change phase through this, never by mutating `game.phase` directly.
  - `phaseFlowService.ts` — the **round orchestrator**: it sequences phases and schedules the per-phase timers (`handleStartIntroFlow`, `handleGameFlow`, `startNextTurn`, `startRoundFlow`, `startCzarPhase`, `startResultsPhase`). This is where "what happens next, and when" lives. `startNextTurn` is the single entry for advancing the engine — it calls `planNextTurn` (in `gameService`) to pick the next czar or end the game, then runs the turn.
  - `czarRatingService.ts`, `socketRoomService.ts`, `PackService.ts`, `botService.ts` — feature/utility services.
- **`utils/timers.ts` — server-authoritative timers.** `phaseTimer()` and `roundTimer()` are keyed by lobby; `schedule()` returns `{ durationMs, expiresAt }` and fires `room:phase-timeout` / `board:round-timeout` plus an `onTimeout` callback. The server owns time; the client only *displays* countdowns synced to `expiresAt`. `selectionLockTimers.ts` handles the per-player board-selection lock.
- **`config/`** — tunables: `points.ts` (all point values), `lobbySettings.ts` (defaults + limits + `normalizeLobbySettings` clamp), `phaseDurations.ts` (default phase lengths). **Settings and point values are never hardcoded in logic — they come from here.**

### Game phases (the lifecycle)

`lobby → starting → intro → board → czar → czar-result → (board | results) → lobby`

| Phase | What happens | Driven by |
|-------|--------------|-----------|
| `lobby` | Players join, host edits settings/packs, everyone readies up. | `room`/`player` handlers |
| `starting` | All ready + ≥2 players → game prepares (`prepareGame` deals hands). | `handleStartIntroFlow` |
| `intro` | Intro animation plays (skippable via `DEV_SKIP_INTRO`). | phase timer → `handleGameFlow` |
| `board` | Players drag a white card into the play slot; a 10s **selection lock** locks each pick. Round timer counts down. | `startRoundFlow`, selection-lock timers |
| `czar` | Card selector (czar) reviews shuffled answers and picks the winner. | `startCzarPhase` |
| `czar-result` | Reveal animation → (optional) audience rating → scoreboard → czar clicks "next round". | `round.handlers` (`czar:card-selected`, `round:next`) + `czarRatingService` |
| `results` | Final standings; host returns everyone to `lobby`. | `startResultsPhase` |

The czar advances rounds manually from `czar-result` (`round:next`), which either starts the next `board` round or ends the game at `results`. Timeouts auto-advance (e.g. czar runs out of time → a card is auto-picked).

**Turns vs. game rounds.** Each `board → czar → czar-result` cycle is one **turn** (a single czar). `settings.roundCount` counts **game rounds**, where one game round = every player has been czar exactly once. The engine (`gameService.planNextTurn`) snapshots a `czarQueue` of player ids at the start of each game round and shifts one off per turn; when the queue empties it increments `game.gameRound` and rebuilds the queue (or ends the game once `gameRound` reaches `roundCount`). So total turns = `roundCount × players`. `game.currentRound` is the running **turn index** (key into `game.rounds`, created lazily per turn); `game.gameRound` is the displayed round (`Ronde X / roundCount`, emitted as `gameRound` on `board:round-*` + the join/state snapshots). Players who join mid-game are excluded from the current game round's `czarQueue` (they only become czar from the next game round) but still play cards from the next turn via `eligibleFromRound`.

### Client architecture (inside `src/`)

- **`pages/Lobby.vue` is the socket hub.** It owns the connection and is the **only place that registers `socket.on(...)` listeners** (set up in `onMounted`, torn down in `onBeforeUnmount`). Each listener does one thing: translate a server event into a `LobbyStore` mutation. Child components never attach their own socket listeners.
- **`store/LobbyStore.ts` is the mirror.** It holds the client's copy of the game (players, phase, current round, timers, rating state, …) plus actions. Components read from it reactively and call its actions; they don't talk to the socket directly (with the small exception of fire-and-forget emits the store itself sends).
- **`store/ConnectionStore.ts`** wraps the socket singleton (`ws/socket.ts`): `ensureSocket()`, `getSocketSafe()`, `emitWithAck()`, and the `socketId`.
- **Screens** live in `components/screens/game/` (`Lobby`, `Intro`, `Board`, `Results`, `FinalResults`), switched by phase in `screens/Game.vue`. `Board.vue` (drag/drop card play) and `Results.vue` (czar-result reveal + scoreboard + rating) are the two heavy, animation-dense components.

### Client ↔ server communication patterns

These four patterns recur everywhere — learn them before adding features:

1. **Request/response (acks):** for actions that need a direct answer (`room:create`, `room:join`, `room:state`, `round:next`, settings updates), the client uses `ConnectionStore.emitWithAck(event, payload)` and the handler replies via `cb({ ok } | { error })`.
2. **Broadcast → store → render (inbound):** the server `io.to(lobbyId).emit('domain:thing', payload)`; the listener in `pages/Lobby.vue` calls a `LobbyStore` action; components react to the store. To surface new server state on the client, you add all three links.
3. **Pending-tick (outbound from deep components):** UI components don't emit directly. Instead a store action sets a `pendingXxx` value and bumps a `pendingXxxTick` counter; a `watch(() => lobby.pendingXxxTick)` in `pages/Lobby.vue` performs the actual `socket.emit` and clears it (see `queueSelectedCard`, `queueSwapCard`). This keeps the socket centralized.
4. **Animation-tick:** to trigger an imperative (gsap) animation in response to a server event, the store bumps a tick (`selectedCardAnimTick`, `czarRatingVotedTick`, …) and the component `watch`es it. State that *describes* the world is reactive; one-shot *events* are modelled as ticks.

**Important consequence — points during a round are computed client-side.** The server intentionally does **not** broadcast `room:players-changed` during `czar-result`; instead `Results.vue` animates the scoreboard from a local snapshot + client-computed deltas (base czar/winner points + any rating bonus). Authoritative totals re-sync on the next `board:round-started`. If you add a new way to score, update **both** the server award **and** the client delta in `Results.vue`, or the animated scoreboard will disagree with the real totals.

**Timing is coupled between server timers and client animations** (e.g. `phaseDurations.ts`, and `REVEAL_LEADIN_MS` in `czarRatingService.ts` matching the reveal timeline in `Results.vue`). When you change an animation's length, check whether a server-side duration needs to move with it.

### Cards, packs, and settings

- **Card templating**: `:answer` = the played white card; `:name` = a name from a pool (player names, falling back to a default list when no player names are available). Resolution logic is **mirrored** in `server/utils/cards.ts` and `src/utils/cards.ts` — keep them in sync.
- **Packs**: `pack.json` = metadata (`id`, `name`, `nsfw`, `language.supported_languages`, …); `cards/<lang>.json` = `{ black: [...], white: [...] }` indexed by `card_id`. Loaded/cached from `PACKS_DIR` in `server/utils/packs.ts`.
- **Lobby settings are mirrored too**: shape + clamps live in both `server/config/lobbySettings.ts` and `src/types/lobbySettings.ts` (and the `LobbySettings` interface in `server/types/Room.ts`). Settings are edited in the **Game tab of `screens/game/Lobby.vue`**, sent via `LobbyStore.updateLobbySettings`, and persisted on `Room.settings`. Adding a setting means touching all of these.
- **Client path aliases** (`vite.config.ts`): `@`, `@components`, `@game`, `@store`, `@ws`, `@assets`. Vite `base` is `/card-madness/` (GitHub Pages).

## Adding a feature — the path through the layers

A new gameplay mechanic almost always touches this same chain, in order. Use it as a checklist:

1. **Config** — add point values to `config/points.ts` and/or settings (with limits + normalize) to `config/lobbySettings.ts`, mirrored in `src/types/lobbySettings.ts` and `server/types/Room.ts`.
2. **Server rule** — implement the state change in `gameService.ts` (pure mutation returning `{ error } | { ... }`). Add new round/lobby state to the types in `server/types/`.
3. **Orchestration** — if it involves timing or phase flow, wire it in `phaseFlowService.ts` (or a dedicated service) using `phaseTimer`/`roundTimer`; change phases only via `phaseService.transitionPhase`.
4. **Socket entry** — add a handler in the matching `io/*.handlers.ts`, following the `domain:action` naming. Decide ack vs. broadcast.
5. **Client store** — add mirrored state + an action in `LobbyStore.ts`; use the pending-tick pattern for outbound intents and animation-ticks for one-shot effects; reset the state on round start / lobby reset.
6. **Client wiring** — register the inbound listener(s) in `pages/Lobby.vue` (and the matching `off` in `onBeforeUnmount`).
7. **UI** — render/animate in the relevant screen/component; settings UI goes in the Game tab of `screens/game/Lobby.vue`.
8. **Verify** — server `tsc -p server/tsconfig.json --noEmit` and a client `vite build` (the build is esbuild-based and won't catch `.vue` type errors, so reason about types yourself). There are no tests.

## Conventions

- **Language**: code, identifiers, and new comments in **English**. Existing comments/strings are a mix of English and Dutch — user-facing copy goes through `vue-i18n` (`src/locales/en.json`, `nl.json`), so add both `en` and `nl` keys for new UI text.
- **ESM everywhere.** Server imports use `.js` extensions (TS-compiled ESM) even though sources are `.ts` — e.g. `import { games } from '../state/store.js'`. Keep this pattern.
- **Indentation**: 4 spaces in TS/Vue (matches existing files).
- Match the surrounding style; prefer small domain-scoped changes over cross-cutting refactors.

## Gotchas

- **Don't commit `packs/`** — it's git-ignored and license-separated. Don't paste card text into source either.
- **`.env` is git-ignored** but its values shape both builds. Use `.env.example` as the contract; update it when you add a config key. The example file and the code must use identical key names — mismatches silently disable features.
- Lobby codes are 5-digit strings; treat lobby ids as strings throughout.
- No tests/CI gates for logic — manually exercise create-lobby → join → ready → play a round when touching game flow.
