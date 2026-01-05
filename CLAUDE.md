# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL REMINDERS

1. **READ THIS FILE** at the start of every session
2. **UPDATE THIS FILE** at the end of every session with changes made
3. **Check Session Notes** section for recent context

---

## Current Sprint: Pre-Deployment Polish (COMPLETED)

**Goal**: Fix bugs, add sound effects, and prepare for Vercel deployment.

**All Tasks Completed**:
- [x] Fix screen shake reset bug (< to <=)
- [x] Display past round winners in Sauna
- [x] Remove dead code from sauna.lua
- [x] Add oracle key validation to smart contract
- [x] Add 5-min grace period enforcement in contract
- [x] Create sounds.lua module with 9 sound effects
- [x] Integrate sounds into game (shoot, bounce, hit, death, countdown, pickup, click, door, chat)
- [x] Enhanced Sauna door visuals (glow, shadows, wood grain)
- [x] Enhanced leaderboard sign (medals, wood texture)
- [x] Improved game HUD (score panel, larger hearts, timer)
- [x] Create frontend/.env template
- [x] Create frontend/vercel.json
- [x] Add index.html meta tags (Open Graph, Apple mobile)
- [x] Fix TypeScript build errors
- [x] Create favicon (moisture.svg)

**Deployment Requirements**:
1. Create Firebase project and add credentials to `.env`
2. Deploy smart contract and add addresses to `.env`
3. Add sound files to `game/assets/sounds/` (or sounds will gracefully fail)
4. Run `npm run build` in frontend/ to verify
5. Deploy to Vercel

---

## Complete User Flow

```
+-------------------------------------------------------------+
|                        MENU STATE                            |
|  - Background: Sauna with NPCs walking                      |
|  - "MOISTURE" title                                          |
|  - [CONNECT WALLET] and [PLAY AS GUEST] buttons             |
+---------------------------+---------------------------------+
                           |
                           v
+-------------------------------------------------------------+
|                   INTERACTIVE SAUNA LOUNGE                   |
|  +-----------------------------------------------------+    |
|  |  [Leaderboard Sign]              [Door: GAME]       |    |
|  |       (wooden wall sign)         (walk to enter)    |    |
|  |                                                      |    |
|  |     NPC    Player(you)    NPC    OnlinePlayer       |    |
|  |              (joystick to move)                     |    |
|  |                                                      |    |
|  |  [Pool: 5.2 SUI]  [Round: 45:23]  [5 online]       |    |
|  |  +---------------------------------------------+   |    |
|  |  | Chat Log                                     |   |    |
|  |  +---------------------------------------------+   |    |
|  |  [___Type message here___] [SEND]                  |    |
|  |  [JOYSTICK]                                        |    |
|  +-----------------------------------------------------+    |
|                                                              |
|  Walk to door -> Prompt: [PLAY] [PRACTICE] -> [ENTER]       |
+---------------------------+---------------------------------+
                           |
                           v
+-------------------------------------------------------------+
|                     COUNTDOWN STATE                          |
|                    3... 2... 1... GO!                        |
|                    (with sound effects)                      |
+---------------------------+---------------------------------+
                           |
                           v
+-------------------------------------------------------------+
|                       GAME STATE                             |
|  - Survival gameplay                                         |
|  - Card selection every 10s (CARD_SELECT state)             |
|  - Humidity (difficulty) increases over time                |
+---------------------------+---------------------------------+
                           | (player dies)
                           v
+-------------------------------------------------------------+
|                       DEATH STATE                            |
|  - Show "EVAPORATED" or "PRACTICE" label                    |
|  - Display survival time and score                          |
|  - Submit score (if not practice)                           |
|  - Tap to return to LOUNGE                                  |
+-------------------------------------------------------------+
```

---

## Game States (Lua)

```lua
STATE = {
    MENU = "menu",           -- Title screen with Sauna background
    LOUNGE = "lounge",       -- Sauna social area
    COUNTDOWN = "countdown", -- 3...2...1...GO! before game
    GAME = "game",           -- Active gameplay
    CARD_SELECT = "card_select", -- Upgrade selection (pauses game)
    DEATH = "death"          -- Death screen with stats
}
```

**Key Flags**:
- `isGuest` - Player entered without wallet (can only practice)
- `isPracticeGame` - Current game is untracked (no score submission)

---

## Sound Effects System

**Location**: `game/src/sounds.lua`

| Sound | Usage | Integration Point |
|-------|-------|-------------------|
| shoot.wav | Enemy fires bullet | Bullet spawn |
| bounce.wav | Bullet bounces | Bullet wall collision |
| hit.wav | Player takes damage | playerHit() |
| death.wav | Player dies | playerDeath() |
| pickup.wav | Card selected | applyCardEffect() |
| countdown.wav | 3, 2, 1 beeps | updateCountdown() |
| go.wav | GO! after countdown | updateCountdown() |
| click.wav | Button pressed | All button handlers |
| door.wav | Enter game door | beginGameCountdown() |
| chat.wav | Chat message sent | addChatMessage() |

**Notes**:
- Sounds fail gracefully if files don't exist
- Volume and pitch can be varied per-play
- Master volume control available

---

## Round System

- Rounds last **1 hour** (configurable)
- **Grace period**: 5 minutes before round end (enforced in smart contract)
  - During grace: Entry blocked, active games continue
  - Practice mode always available
- **Round states**: `active` | `grace` | `ended`
- Top 3 players get 50%/30%/20% of prize pool

---

## Project Overview

**Moisture** is a mobile-first Touhou-style bullet hell dApp where players pay 0.1 SUI to enter, survive by dodging enemy bullets, and compete for a prize pool distributed to the top 3 survivors each round.

## Core Mechanic: Bouncing Bullets

- **All enemies shoot bullets** at the player
- **Bullets bounce off walls** up to 2 times, then disappear
- **Bounced bullets damage enemies** - position yourself so bullets ricochet into enemies!
- Bullet colors indicate danger level:
  - Red = dangerous (0 bounces)
  - Orange = 1 bounce
  - Green = friendly (2+ bounces, will hit enemies)

## Tech Stack

- **Game Engine**: Love2D (Lua) - pixel art, mobile-first portrait orientation
- **Blockchain**: Sui Network (Move smart contracts)
- **Frontend**: React + Vite + TypeScript + Sui dApp Kit
- **Real-time**: Firebase Realtime Database (chat/leaderboard)

## Project Structure

```
bullethell/
├── contracts/moisture/     # Sui Move smart contracts
│   └── sources/game_core.move
├── game/                   # Love2D game (Lua)
│   ├── conf.lua            # Window config (450x800 portrait)
│   ├── main.lua            # Main game loop
│   ├── shaders/crt.glsl    # CRT retro effect
│   ├── assets/sounds/      # Sound effect files (WAV)
│   └── src/
│       ├── pixelcanvas.lua # 180x320 pixel-perfect rendering
│       ├── character.lua   # Humanoid pixel character generator
│       ├── touchcontrols.lua # Mobile joystick movement
│       ├── enemies.lua     # 10 anime-style enemy types
│       ├── cards.lua       # Upgrade card definitions & UI
│       ├── upgrades.lua    # Upgrade effect implementations
│       ├── sauna.lua       # Social lounge system
│       ├── sounds.lua      # Sound effects module
│       └── bridge.lua      # Lua <-> JS communication
└── frontend/               # React wrapper
    ├── .env                # Environment variables
    ├── vercel.json         # Vercel deployment config
    ├── public/             # Static assets
    │   └── moisture.svg    # Favicon
    └── src/
        ├── App.tsx
        ├── bridge/{luaBridge.ts, oracle.ts}
        └── hooks/useFirebase*.ts
```

## Build Commands

```bash
# Smart Contracts
cd contracts/moisture && sui move build
sui client publish --gas-budget 100000000

# Game (Love2D)
love /path/to/bullethell/game
# Or on macOS with downloaded app:
/Applications/love.app/Contents/MacOS/love /path/to/bullethell/game

# Frontend
cd frontend && npm install && npm run dev
npm run build  # Production build
```

## Environment Variables (frontend/.env)

```bash
# Sui Contract (from deployment)
VITE_PACKAGE_ID=0x...
VITE_GAME_POOL_ID=0x...
VITE_ORACLE_CAP_ID=0x...
VITE_ORACLE_URL=http://localhost:3001

# Firebase (from Firebase Console)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Game Mechanics

- **Dodge bullets** - enemies constantly shoot at you
- **Every 10 seconds**, choose 1 of 3 random upgrade cards
- **Player has 3 HP** (can be increased with Heart upgrades)
- **Position strategically** to make bullets bounce into enemies
- **Score increases** when you kill enemies with bounced bullets

## Upgrade Cards (13 total)

### Defense
| Card | Effect | Max Level |
|------|--------|-----------|
| HEART | +1 max HP | 5 |
| TINY | Smaller hitbox (-15% per level) | 5 |
| GHOST | Longer invincibility after damage | 3 |
| SHIELD | Auto-absorb 1 bullet (cooldown) | 3 |

### Movement
| Card | Effect | Max Level |
|------|--------|-----------|
| SWIFT | +15% move speed | 5 |
| BLINK | Short teleport (SPACE key) | 3 |
| FOCUS | Smaller hitbox when moving slow | 3 |

### Bullet Manipulation
| Card | Effect | Max Level |
|------|--------|-----------|
| REFLECT | Bounced bullets deal +50% damage | 5 |
| REPEL | Bullets curve away from you | 5 |
| FREEZE | Bullets slow down near you | 5 |
| SHRINK | Bullets get smaller near you | 3 |

### Utility
| Card | Effect | Max Level |
|------|--------|-----------|
| CALM | Enemies shoot 15% slower | 5 |
| CHAOS | Enemy aim becomes inaccurate | 5 |

## Game Controls

**Mobile (Primary)**:
- Touch anywhere: Virtual joystick appears at touch location (drag to move)
- Tap cards: Select upgrade during card selection

**Desktop**:
- WASD/Arrows: Move
- Space/Shift: Blink teleport (if unlocked)
- 1/2/3 or Arrow+Enter: Select card
- R: Reroll character (in sauna lounge)

## Smart Contract (game_core.move)

**Constants**:
- `GRACE_PERIOD`: 300,000ms (5 minutes)
- `ORACLE_KEY_LENGTH`: 32 bytes

**Error Codes**:
- 0: EInvalidTicketOwner
- 1: EInsufficientPayment
- 2: ERoundEnded
- 3: EInvalidScore
- 4: EInvalidSignature
- 5: ERoundInGrace (entry blocked during grace period)
- 6: EInvalidOracleKey (oracle key must be 32 bytes)

**Functions**:
1. `create_pool`: Admin seeds pool with 1 SUI + oracle pubkey (validated 32 bytes)
2. `enter_game`: Player pays 0.1 SUI, blocked during grace period
3. `submit_score`: Oracle-signed score burns ticket
4. `distribute_rewards`: Top 3 get 50%/30%/20% split

## Key Architecture

- **Pixel Canvas**: 180x320 base resolution, scaled up with nearest-neighbor
- **Portrait-first**: Designed for mobile phones
- **Card System**: Every 10s, game pauses for upgrade selection
- **Bullet Physics**: Wall bouncing (max 2), player repel/freeze/shrink effects
- **Visual Polish**: Bullet trails, glow effects, screen shake, spawn animations

---

## Feature Status

### Completed
- [x] Core game loop (movement, bullets, bouncing, damage)
- [x] Procedural character generation from seed
- [x] Procedural enemy generation with type-based styling
- [x] 10 enemy types with unique bullet patterns
- [x] 13 upgrade cards with effects
- [x] Card selection UI
- [x] CRT shader effect
- [x] Touch controls for mobile
- [x] Pixel-perfect rendering system
- [x] Blockchain integration (Sui smart contracts)
- [x] Oracle server for score verification
- [x] Firebase chat and leaderboard
- [x] Deployment documentation
- [x] Mobile browser optimization
- [x] Menu screen with guest/wallet choice
- [x] Guest mode (full Sauna access, practice only)
- [x] Practice mode (free untracked games)
- [x] Entry countdown (3...2...1...GO!)
- [x] Round management with 5-min grace period
- [x] Personal stats panel
- [x] Past round winners display
- [x] Online presence (Firebase)
- [x] Interactive Sauna with joystick
- [x] Door system (walk to door, toggle modes, enter)
- [x] Chat input always visible
- [x] In-world leaderboard sign
- [x] **Sound effects system** (10 sounds)
- [x] **Enhanced Sauna visuals** (door glow, medals, wood textures)
- [x] **Improved game HUD** (score panel, hearts, timer)
- [x] **Smart contract validations** (oracle key, grace period)
- [x] **Frontend deployment config** (vercel.json, meta tags)
- [x] **Sound WAV files** (10 generated retro-style sounds)
- [x] **Touch controls polish** (joystick appears on touch, works anywhere)
- [x] **Menu button in sauna** (return to main menu)
- [x] **Wallet connect fix** (real React ConnectButton on menu)
- [x] **Difficulty reduction** (spawn rate halved, slower scaling)

### Known Issues
- None currently - difficulty reduced, wallet connect fixed

### Future Work
- [ ] Background music
- [ ] Game balance tuning
- [ ] Boss enemies
- [ ] Spectate mode
- [ ] Daily challenges
- [ ] Achievements

---

## Deployment Checklist

### Before Deploy
1. [ ] Create Firebase project at console.firebase.google.com
2. [ ] Enable Realtime Database (not Firestore)
3. [ ] Set database rules (see plan file)
4. [ ] Get Firebase config values
5. [ ] Fill in frontend/.env with Firebase values
6. [ ] Deploy smart contract to Sui testnet
7. [ ] Fill in frontend/.env with contract addresses
8. [ ] Add sound files to game/assets/sounds/ (optional, graceful fallback)
9. [ ] Run `npm run build` in frontend/ to verify

### Deploy to Vercel (Auto-deploy via Git)

The project is connected to Vercel for automatic deployments. Push to `main` branch to trigger a production deploy:

```bash
# Rebuild Love.js game first
npx love.js -c game frontend/public/game --title "Moisture"

# Commit and push
git add .
git commit -m "Your commit message"
git push origin main
# Vercel auto-deploys from main branch
```

**Manual deploy** (if needed):
```bash
cd frontend
npm install
npm run build  # Verify build works
vercel --prod  # Deploy to production
```

### Post-Deploy Testing
- [ ] Game loads without errors
- [ ] Wallet connects
- [ ] Guest mode works
- [ ] Practice game starts
- [ ] Chat works
- [ ] Leaderboard displays
- [ ] Sound effects play (if files present)

---

## Session Notes

_Add notes here during development sessions to preserve context across auto-compacts._

**Latest Session (ConnectButton Fix, Sound Fix)**:
- Fixed ConnectButton not responding to taps:
  - Root cause: `preventPullToRefresh` was blocking ALL single-finger touches
  - Solution: Only call `preventDefault()` when target is CANVAS element
- Fixed ConnectButton staying visible in LOUNGE/DEATH states:
  - Added game state bridge from Lua to React
  - `Bridge.setGameState()` now called on every state transition
  - React listens for 'gameStateChanged' events
  - ConnectButton only shows when `gameState === 'menu'`
- Fixed sound loading in Love.js:
  - Removed `love.filesystem.getInfo()` check (doesn't work in Love.js virtual FS)
  - Now tries direct load with pcall for error handling

**Files Modified**:
- `frontend/src/App.tsx` - Fixed touch handlers, added gameState tracking
- `game/src/bridge.lua` - Added setGameState function
- `game/main.lua` - Added Bridge.setGameState() calls on all state changes
- `game/src/sounds.lua` - Removed getInfo check for Love.js compatibility
- `CLAUDE.md` - Updated session notes

---

**Previous Session (Bug Fixes: Sound, Wallet, Difficulty)**:
- Fixed wallet connect: Now shows real React ConnectButton in center of menu
- Removed Lua-drawn CONNECT WALLET button (was causing race condition)
- Reduced gameplay difficulty:
  - Spawn rate halved: `0.002 + humidity * 0.001`
  - Humidity growth slowed: every 15s instead of 10s
  - Ring bullet count capped at 10
- Rebuilt Love.js with sound files
- Added CRITICAL REMINDERS at top of CLAUDE.md

---

**Previous Session (Post-Launch Polish)**:
- Fixed wallet connect button (changed selector to find button inside .wallet-overlay div)
- Removed CRT filter (disabled, shader code removed)
- Removed haptic feedback calls (not supported in Love.js/web)
- Fixed touch controls: joystick now appears only when touching, works anywhere on screen
- Added MENU button in sauna top-left to return to main menu
- Generated 10 WAV sound effect files using Python
- Deployed via git push (auto-deploys to Vercel)

---

**Previous Session (Pre-Deployment Polish)**:
- Fixed screen shake reset bug (main.lua:111 < to <=)
- Added past winners display call in sauna:draw()
- Removed dead code functions from sauna.lua
- Added oracle key validation (32 bytes) to smart contract
- Added grace period enforcement (5 min before round end) to smart contract
- Created sounds.lua module with graceful fallbacks
- Integrated 10 sound effects (shoot, bounce, hit, death, countdown, go, pickup, click, door, chat)
- Enhanced door visuals with glow, shadows, wood grain
- Enhanced leaderboard sign with medal icons and wood texture
- Improved game HUD with score panel and better styling
- Created frontend/.env template
- Created frontend/vercel.json deployment config
- Updated index.html with Open Graph and Apple meta tags
- Fixed TypeScript build errors
- Created public/moisture.svg favicon
