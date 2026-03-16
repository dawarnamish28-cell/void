# VOID - Space Deception Game

A real-time multiplayer 2D deception game inspired by Among Us, built as a browser-based experience with a VSCode-structured multi-panel layout.

## Project Overview
- **Name**: VOID
- **Genre**: Multiplayer 2D Social Deception
- **Tech Stack**: React + TypeScript (Frontend), Node.js + Express + Socket.IO (Backend), HTML5 Canvas (Game Rendering), Zustand (State), Tailwind CSS (Styling)

## Live URLs
- **Client**: http://localhost:3000 (Vite dev server)
- **Server**: http://localhost:3001 (Socket.IO + Express)

## Implemented Features

### Phase 1 - Foundation
- [x] Login screen with age gate (14+ only)
- [x] Name input (max 16 chars)
- [x] Lobby system (create/join by 6-char code)
- [x] Color selection (16 colors, first-come-first-served)
- [x] Host controls: kick players, set impostor count (1-3), start game
- [x] Lobby chat
- [x] Countdown timer on game start

### Phase 2 - Core Game
- [x] Canvas rendering of "The Vessel" spaceship map
- [x] 14+ interconnected rooms with corridors
- [x] WASD/Arrow key player movement with server sync
- [x] FOV raycasting system (geometric occlusion, not brightness)
- [x] Role assignment (Crewmate/Impostor) with server-side authority
- [x] Role reveal screen (3-second display)
- [x] Task system with 8 task types:
  - Wire Fix (drag-to-match colors)
  - Fuel Up (hold-to-fill with wobble physics)
  - Download Data (progress timer)
  - MedBay Scan (hold button)
  - Calibrate Shields (click sequence)
  - Enter ID Code (number pad)
  - Align Navigation (slider puzzle)
  - Empty Garbage (lever pulling)
- [x] Kill mechanic with range validation
- [x] Dead body system with body reporting
- [x] Ghost mode (full map vision, can't interact)

### Phase 3 - Meetings & Voting
- [x] Emergency Meeting button (Cafeteria)
- [x] Body report triggering meetings
- [x] Discussion phase (30s timer)
- [x] Voting phase (15s timer) with player tiles
- [x] Skip vote option
- [x] Vote resolution (majority/tie/skip)
- [x] Ejection animation with role reveal
- [x] Meeting chat system

### Phase 4 - Impostor Tools
- [x] Kill button (proximity-based, Q key)
- [x] Vent system (7 vents with network connections)
- [x] Sabotage menu with 5 types:
  - Lights (reduces crewmate FOV to 60px)
  - Reactor (45s countdown to impostor win)
  - O2 (30s countdown)
  - Communications (disables cameras/admin map)
  - Doors (locks rooms temporarily)
- [x] Sabotage fix mechanics
- [x] Kill cooldown system

### Phase 5 - UI/HUD
- [x] VSCode-inspired multi-panel layout
- [x] Top bar: room name, sabotage alerts, emergency button
- [x] Left sidebar: Admin mini-map with player dots
- [x] Right sidebar: Task checklist with progress bar
- [x] Bottom bar: Player dots, action buttons (Kill, Vent, Sabotage, Report, Use)
- [x] Game Over screen with role reveal
- [x] Post-game options (Play Again / Leave)

## Win Conditions
- **Crewmates win** if all tasks completed OR all impostors ejected
- **Impostors win** if crewmates <= impostors OR critical sabotage countdown expires

## Controls
| Action | Key |
|--------|-----|
| Move | WASD / Arrow Keys |
| Kill (Impostor) | Q |
| Vent (Impostor) | E |
| Report Body | R |
| Use Task/Panel | F |
| Sabotage Menu | X (Impostor) |
| Close Task | ESC |

## Architecture
```
webapp/
├── server/src/           # Express + Socket.IO server
│   ├── index.ts          # Server entry point
│   ├── lobby/            # Lobby management
│   └── game/             # Game state management
├── src/                  # React client
│   ├── components/       # UI components
│   │   ├── HUD/          # In-game HUD panels
│   │   ├── Meeting/      # Meeting & voting UI
│   │   └── Tasks/        # Mini-task modals
│   ├── game/             # Canvas renderer, FOV, input
│   ├── store/            # Zustand state management
│   └── socket/           # Socket.IO client
├── shared/               # Shared types, constants, map data
└── package.json
```

## Security Features
- Server-authoritative game state
- Kill range validation (server-side)
- FOV culling (server only sends visible players)
- Role information sent only to individual sockets
- Rate limiting on socket events
- Session tokens expire on disconnect

## Map: The Vessel
```
[ CAFETERIA ] ──── [ WEAPONS ] ──── [ NAV ]
      |                                 |
 [ ADMIN ] ──── [ HALLWAY ] ──── [ SHIELDS ]
      |                |
 [ STORAGE ] ──── [ ENGINE ROOM ]
      |
 [ REACTOR ]
      |
 [ SECURITY ] ── [ ELECTRICAL ] ── [ O2 ]
      |
 [ MEDBAY ] ──── [ COMMUNICATIONS ]
```

## Development
```bash
# Install dependencies
npm install

# Start development (both client + server)
npm run dev

# Or start separately:
npm run dev:client  # Vite on port 5173
npm run dev:server  # Server on port 3001
```

## Last Updated
2026-03-16
