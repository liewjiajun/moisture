# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL REMINDERS

1. **READ THIS FILE** at the start of every session
2. **UPDATE THIS FILE** at the end of every session with changes made
3. **Check Session Notes** section for recent context

### ⚠️ PHASER 3 ARCHITECTURE RULES ⚠️

**Text Rendering - NEVER use graphics.fillText():**
```typescript
// WRONG - Phaser Graphics has NO fillText method
this.graphics.fillText('Hello', x, y);  // This does NOT exist!

// CORRECT - Use Phaser Text objects
this.titleText = this.add.text(x, y, 'Hello', {
  fontSize: '12px',
  fontFamily: 'monospace',
  color: '#ffffff',
}).setOrigin(0.5).setDepth(10);
```

**Graphics Clear - Scene manages, NOT entities:**
```typescript
// WRONG - in Character.ts or Enemy.ts
draw(graphics) {
  graphics.clear();  // This erases everything!
  // ... draw code
}

// CORRECT - Entity just draws, scene clears once per frame
// In scene's draw() method:
this.graphics.clear();
this.characterGraphics.clear();
// Then draw all entities...
```

**Event Routing - Use registry.events for game-wide events:**
```typescript
// WRONG - Scene-local events don't reach React
this.events.emit('gameStateChanged', 'menu');

// CORRECT - Game-wide events reach React listeners
this.registry.events.emit('gameStateChanged', 'menu');
```

### ⚠️ LOVE.JS FILES (DEPRECATED) ⚠️

The `/game/` directory contains the old Love2D Lua code. It is kept for reference but is no longer used.
The game now runs entirely in Phaser 3 TypeScript code in `/frontend/src/game/`.

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

- **Game Engine**: Phaser 3 (TypeScript) - pixel art, mobile-first portrait orientation
  - Previously: Love2D (Lua) via Love.js - migrated due to iOS compatibility issues
- **Blockchain**: Sui Network (Move smart contracts)
- **Frontend**: React + Vite + TypeScript + Sui dApp Kit
- **Real-time**: Firebase Realtime Database (chat/leaderboard)

## Project Structure

```
bullethell/
├── contracts/moisture/     # Sui Move smart contracts
│   └── sources/game_core.move
├── game/                   # Love2D game (Lua) - DEPRECATED, kept for reference
│   └── ...
└── frontend/               # React + Phaser 3 game
    ├── .env                # Environment variables
    ├── vercel.json         # Vercel deployment config
    ├── public/             # Static assets
    │   └── moisture.svg    # Favicon
    └── src/
        ├── App.tsx
        ├── components/
        │   └── GameCanvas.tsx  # Phaser game container
        ├── game/               # Phaser 3 game (TypeScript)
        │   ├── index.ts        # MoistureGame class, scene registry
        │   ├── entities/
        │   │   ├── Character.ts    # Procedural humanoid generation
        │   │   ├── Enemy.ts        # Enemy types and behavior
        │   │   └── Bullet.ts       # Bullet physics and bouncing
        │   └── scenes/
        │       ├── MenuScene.ts    # Title screen
        │       ├── LoungeScene.ts  # Sauna social area
        │       ├── CountdownScene.ts # 3-2-1-GO countdown
        │       ├── GameScene.ts    # Main gameplay
        │       └── DeathScene.ts   # Game over screen
        ├── bridge/{luaBridge.ts, oracle.ts}
        └── hooks/useFirebase*.ts
```

## Build Commands

```bash
# Smart Contracts
cd contracts/moisture && sui move build
sui client publish --gas-budget 100000000

# Frontend + Phaser Game (combined)
cd frontend && npm install && npm run dev
npm run build  # Production build

# The Phaser game is built together with the React frontend (no separate build step)
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
- [x] **Wallet→Sauna transition fix (v22)** - Read js.global directly, bypass broken FS
- [x] **Phaser 3 Migration** - Complete rewrite from Love.js to Phaser 3 for iOS compatibility

### Known Issues
- [ ] Phaser game needs full gameplay testing (enemies, bullets, cards)
- [x] Sound system integrated with Phaser (AudioSystem.ts + all scenes)
- [x] Card selection input added (keyboard 1/2/3 + touch on cards)
- [ ] Mobile chat keyboard may not appear on all devices - browser focus limitations

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

**Latest Session (Firebase Integration & UX Polish - Complete)**:
Connected Firebase chat/leaderboard to Phaser scenes and added gameplay UX improvements.

**Key Changes Made**:

1. **Chat Integration** - Firebase chat now displays in LoungeScene:
   - Added `setChatMessages()`, `setLeaderboard()`, `setRoundInfo()` to MoistureGame class
   - Updated GameCanvas.tsx to pass Firebase data to Phaser via registry
   - LoungeScene reads from registry and updates dynamic text elements

2. **LoungeScene Polish**:
   - Real-time chat display (last 3 messages, truncated for fit)
   - Dynamic leaderboard with player addresses and times
   - Round timer display (MM:SS format)
   - Prize pool display (converted from MIST to SUI)
   - Online player count

3. **MenuScene Polish**:
   - New tagline: "DODGE. UPGRADE. SURVIVE."
   - Guest mode hint: "PRACTICE ONLY" (pulsing orange)
   - Wallet connect hint: "CONNECT WALLET TO COMPETE" (pulsing gold)
   - Help button "?" in top-right (shows quick tip on click)
   - Footer changed to "WIN SUI PRIZES!"

4. **GameScene Polish**:
   - Tutorial hint "DODGE!" for first 5 seconds (fades out)
   - Red screen flash damage effect when player is hit
   - `damageFlash` state variable for overlay intensity

5. **DeathScene Polish**:
   - Leaderboard rank display (1ST/2ND/3RD with medals, or #N)
   - "NEW BEST!" celebration for personal records (yellow glow effect)
   - `calculateRankInfo()` method compares to Firebase leaderboard

6. **Type Alignment**:
   - Updated `LeaderboardEntry` in types.ts to match Firebase format
   - Fields: `rank`, `address`, `survivalTime`, `score`, `timestamp`, `roundId`

7. **Firebase Hooks Updates**:
   - `useFirebaseRounds.ts`: Added `RoundInfo` interface with `timeRemaining` and `prizePool`
   - `useFirebasePresence.ts`: Added `onlineCount` to return value

**Files Modified**:
- `frontend/src/App.tsx` - Pass Firebase data to GameCanvas
- `frontend/src/components/GameCanvas.tsx` - Accept and forward chat/leaderboard props
- `frontend/src/game/index.ts` - Add setChatMessages, setLeaderboard, setRoundInfo methods
- `frontend/src/game/types.ts` - Updated LeaderboardEntry interface
- `frontend/src/game/scenes/LoungeScene.ts` - Dynamic chat/leaderboard/round display
- `frontend/src/game/scenes/MenuScene.ts` - Tagline, hints, help button
- `frontend/src/game/scenes/GameScene.ts` - Tutorial hint, damage flash
- `frontend/src/game/scenes/DeathScene.ts` - Rank display, NEW BEST celebration
- `frontend/src/hooks/useFirebaseRounds.ts` - Return roundInfo
- `frontend/src/hooks/useFirebasePresence.ts` - Return onlineCount

**Build verified**: `npm run build` passes successfully
**Deployed**: Pushed to Vercel via `git push origin main`

---

**Previous Session (Full UI/UX Redesign - Complete)**:
Comprehensive visual overhaul of all 5 game scenes using synthwave/vaporwave aesthetic.

**Visual Design Patterns Applied**:
1. **Layered Graphics** - All scenes now use 3 graphics layers:
   - `bgGraphics` (depth 0) - backgrounds, gradients, stars
   - `graphics` (depth 5) - main scene elements
   - `fxGraphics` (depth 15) - effects, scanlines, vignette

2. **Chromatic Aberration** - Title text glow with magenta/cyan RGB split:
   ```typescript
   this.titleGlowMagenta = this.add.bitmapText(...).setTint(0xff00ff);
   this.titleGlowCyan = this.add.bitmapText(...).setTint(0x00ffff);
   ```

3. **Particle Systems** - Atmospheric effects in each scene:
   - MenuScene: 25 moisture particles (rising steam)
   - LoungeScene: 15 steam particles
   - DeathScene: 20 floating particles
   - CountdownScene: 30 stars (streaming outward effect)

4. **Scanlines + Vignette** - CRT aesthetic applied to all scenes

**Files Modified**:
- **MenuScene.ts** - Complete rewrite: perspective grid, moisture particles, chromatic title glow, button hover states
- **LoungeScene.ts** - Steam particles, warm wood gradients, enhanced door (glow + arrow), medal indicators on leaderboard
- **GameScene.ts** - Humidity shows value (e.g., "1.5x"), card text repositioned, card icons added
- **DeathScene.ts** - Floating particles, gradient backgrounds (red for death, green for practice), ghost character at 0.5 alpha
- **CountdownScene.ts** - Stars streaming outward, expanding rings on each number, corner accents, flash on "GO!"

**Color Themes**:
- Menu/Countdown: Neon cyan (0x00ffff), magenta accents
- Lounge: Warm orange/amber (sauna warmth), wood browns
- Death: Red (0xff6666) for death, green (0x66cc99) for practice
- GO: Bright green (0x00ff80)

**Build verified**: `npm run build` passes successfully

---

**Previous Session (Rendering Overhaul + MVP Prep - Complete)**:
Fixed grainy/blurry rendering and prepared for MVP launch by removing oracle requirement.

**Rendering Fixes**:
1. **CSS Canvas Optimization** (`frontend/src/index.css`):
   ```css
   .game-canvas canvas {
     image-rendering: crisp-edges;
     image-rendering: pixelated;
     -ms-interpolation-mode: nearest-neighbor;
   }
   ```

2. **Phaser Zoom Config** (`frontend/src/game/index.ts`):
   - Added `zoom: 2` to scale config for explicit 2x integer zoom
   - Prevents browser sub-pixel interpolation artifacts

**Smart Contract Changes** (`contracts/moisture/sources/game_core.move`):
- Disabled oracle signature verification for testnet MVP
- `submit_score` no longer requires signature parameter
- Ticket ownership still validated by Sui's object model
- Ed25519 import commented out, unused constants annotated

**Frontend Changes** (`frontend/src/App.tsx`):
- Commented out oracle verification import
- `handleScoreSubmit` now submits directly to blockchain without oracle call
- Removed signature argument from `submit_score` moveCall

**Testing Verified**:
- ✅ Menu: Crisp "MOISTURE" title, subtitle visible
- ✅ Lounge: "THE SAUNA", leaderboard, chat all crisp
- ✅ Game: Enemies, bullets, HUD all rendering properly
- ✅ Death: Stats display, return to lounge works
- ✅ Contract builds successfully
- ✅ Frontend builds successfully

**Remaining for Launch**:
1. Create Firebase project + add credentials to `.env`
2. Deploy contract: `cd contracts/moisture && sui client publish --gas-budget 100000000`
3. Call `create_pool` to initialize game pool
4. Update `.env` with PACKAGE_ID, GAME_POOL_ID, ORACLE_CAP_ID
5. Deploy to Vercel

---

**Previous Session (Text Rendering Fixes - Complete)**:
Fixed all text being "barely readable" after Phaser 3 migration. Font sizes were wrong throughout.

**Root Cause**: Original Lua used consistent 8px/12px/16px fonts. Phaser migration used random 4px-32px sizes.

**Font Size Standards** (must match original Love2D):
- **16px** = Large titles (MOISTURE, EVAPORATED, countdown numbers, THE SAUNA)
- **12px** = Medium emphasis (death stats, humidity indicator)
- **8px** = All UI text (labels, chat, buttons, HUD, cards)

**Files Modified**:
1. **CountdownScene.ts** - CRITICAL: countdown was 32px (filled screen!), now 16px
   - Added glow text layers with pulsing animation
   - Practice label: 10px → 8px

2. **GameScene.ts** - Card descriptions were 4px (unreadable!), now 8px
   - Card names: 6px → 8px
   - Card levels: 5px → 8px
   - HUD time/score: 6-7px → 8px
   - Humidity "!": 10px → 12px

3. **LoungeScene.ts** - Added "THE SAUNA" title at 16px (was missing)
   - All text was 4-6px, now 8px
   - Leaderboard, chat, buttons all readable

4. **MenuScene.ts** - Title 12px → 16px with glow effect
   - Added subtitle "The Viscous High-Stakes Survivor" at 8px
   - Footer: 6px → 8px

5. **DeathScene.ts** - Title 10px → 16px with glow effect
   - Stats: 7px → 12px (medium size)
   - Prompt: 6px → 8px with pulsing animation

**Glow Effect Pattern** (for future reference):
```typescript
// Create offset text layers behind main text
this.glow1 = this.add.text(x-1, y-1, 'TEXT', {...}).setAlpha(0.3).setDepth(9);
this.glow2 = this.add.text(x+1, y+1, 'TEXT', {...}).setAlpha(0.3).setDepth(9);
this.mainText = this.add.text(x, y, 'TEXT', {...}).setDepth(10);

// In update: pulse the glow
const pulse = 0.7 + Math.sin(this.gameTime * 2) * 0.3;
this.glow1.setAlpha(0.3 * pulse);
```

**Testing Verified**:
- ✅ Menu: "MOISTURE" title large with subtitle visible
- ✅ Lounge: "THE SAUNA" title, leaderboard, chat all readable
- ✅ Game: HUD time/score visible, enemies spawning
- ✅ Death: "PRACTICE" title large, stats readable, prompt pulsing

**Build verified**: `npm run build` passes successfully

---

**Previous Session (Sound System + Card Selection - Complete)**:
Completed the Phaser 3 integration by adding sound system and card selection input.

**Changes Made**:
1. **Card Selection Input** - Added keyboard (1/2/3) and touch/click input for selecting cards
   - `GameScene.ts:setupInput()` - Added keydown listeners for ONE/TWO/THREE
   - `GameScene.ts:pointerdown` - Added card click detection via `getClickedCardIndex()`
   - `GameScene.ts:handleCardSelect()` - Now called from both keyboard and touch input

2. **Sound System** - Created AudioSystem wrapper for Phaser's audio manager
   - `frontend/src/game/systems/AudioSystem.ts` - New file with 10 sound definitions
   - Sounds: shoot, bounce, hit, death, pickup, countdown, go, click, door, chat
   - Graceful fallback if sound files missing

3. **Sound Integration** - Added sound triggers throughout all scenes:
   - `GameScene.ts` - shoot (enemy fire), bounce (wall hit), hit (player damage), death, pickup (card)
   - `CountdownScene.ts` - countdown (3,2,1), go (GO!)
   - `MenuScene.ts` - click (button press)
   - `LoungeScene.ts` - door (enter game), click (practice toggle)
   - `DeathScene.ts` - click (tap to continue)

4. **Sound WAV Files** - Generated 10 retro-style sound files using Python
   - Located in `frontend/public/assets/sounds/`

**Build verified**: `npm run build` passes successfully

---

**Previous Session (Phaser 3 Migration - Complete)**:
Migrated the entire game from Love.js (Lua) to Phaser 3 (TypeScript) due to iOS WebGL compatibility issues.

**Why Migration Was Needed**:
- Love.js had persistent iOS crashes (WebGL context issues)
- Emscripten FS was not exported, breaking React-Lua communication
- Browser audio context issues with SDL2

**Phaser 3 Architecture**:

1. **Text Rendering**: Use `this.add.text()` for all text labels
   - Phaser Graphics objects have NO `fillText()` method
   - All text must be created as Phaser Text game objects
   - Set depth for proper layering: `.setDepth(10)` for UI text

2. **Graphics Drawing**: Scene manages `graphics.clear()`
   - Entity `draw()` methods must NOT call `graphics.clear()`
   - Scene clears graphics ONCE at start of each frame
   - Use separate graphics objects for different layers (background, characters, UI)

3. **Event Routing**: Use `registry.events` for game-wide events
   - `this.events.emit()` = scene-local (won't reach React)
   - `this.registry.events.emit()` = game-wide (reaches React listeners)
   - Events: 'gameStateChanged', 'requestWalletConnect', 'scoreSubmit'

**Files Modified**:
- `frontend/src/game/entities/Character.ts` - Removed graphics.clear()
- `frontend/src/game/entities/Enemy.ts` - Removed graphics.clear()
- `frontend/src/game/scenes/MenuScene.ts` - Added Text objects for title/buttons
- `frontend/src/game/scenes/LoungeScene.ts` - Added Text objects, separate characterGraphics
- `frontend/src/game/scenes/CountdownScene.ts` - Added countdown Text object
- `frontend/src/game/scenes/GameScene.ts` - Added HUD Text objects (time, score, card timer)
- `frontend/src/game/scenes/DeathScene.ts` - Added stats Text objects

**Testing Verified**:
- ✅ MenuScene: "MOISTURE" title, "PLAY AS GUEST" button, footer text visible
- ✅ LoungeScene: Multiple characters visible (player + 4 NPCs), door with "GAME" label
- ✅ Build succeeds with `npm run build`

**Known Remaining Work**:
- Full gameplay testing (enemies, bullets, cards)
- Sound system integration
- Wallet/blockchain integration testing

---

**Previous Session (v22 - Skip FS, Use js.global Directly)**:
v21 still failed because Love.js was compiled WITHOUT `-s EXPORTED_RUNTIME_METHODS=['FS']`.
The Emscripten FS is NEVER available to JavaScript, making the filesystem bridge impossible.

**Root Cause**:
- `window.FS` and `Module.FS` are both undefined - Love.js doesn't export FS
- The FS retry loop ran forever: `[GameCanvas v21] FS not ready, retrying in 100ms...`
- Lua crashed with `attempt to index a nil value` in readInitFile()

**Solution**: Skip the filesystem entirely - read `window.INITIAL_WALLET_STATE` via `js.global`:
1. GameCanvas.tsx: Remove all FS write code - just log that Lua should read js.global
2. bridge.lua: Add `readFromJSGlobal()` to read `js.global.INITIAL_WALLET_STATE` directly
3. bridge.lua: Update `init()` and `pollInitFile()` to try js.global first
4. main.lua: Update version markers to v22

**Key Insight**: Lua CAN access JavaScript globals via `js.global` (used for browser detection).
React sets `window.INITIAL_WALLET_STATE` before game loads - Lua can read it directly!

**Files Modified**:
- `frontend/src/components/GameCanvas.tsx` - Simplified onRuntimeInitialized
- `game/src/bridge.lua` - Added readFromJSGlobal(), updated init/pollInitFile
- `game/main.lua` - Version markers to v22

**Build UUID**: `824271f3-46ce-4bea-a9a3-5ade3d98e5a5`

**Alternative Engines Researched** (if v22 fails):
- Phaser 3: Best for React integration, requires JS rewrite (2-4 weeks)
- Defold: Lua-based with web export, requires learning new engine
- PixiJS: Fast rendering, but not a game framework

---

**Previous Session (v21 - Failed: FS Never Available)**:
v21 tried to access global `window.FS` and `Module.FS`, but both are undefined because Love.js
was compiled without the FS export flag. The retry loop ran forever and Lua crashed.

---

**Previous Session (v20 - Defer Game Load Until Wallet Decision)**:
Fixed wallet connection flow by deferring game loading until user makes wallet/guest choice.

**Root Cause**: Previous attempts (v18-v19) failed because:
- `js.global` doesn't exist in this Love.js build
- `Module.FS` is only available during `onRuntimeInitialized`, not at runtime
- Click simulation approach was wrong (clicked "Play as Guest" instead of respecting wallet state)

**Solution**: Defer game loading until wallet decision
1. React shows landing screen first (Connect Wallet / Play as Guest)
2. User makes choice → store state in `window.INITIAL_WALLET_STATE`
3. Only THEN render GameCanvas and load Love.js
4. `onRuntimeInitialized` writes state to `Module.FS` as `/bridge_init.json`
5. Lua's `Bridge.init()` reads the file and sets `Bridge.walletConnected`
6. `love.load()` starts directly in LOUNGE state with correct `isGuest` flag

**Files Modified**:
- `frontend/src/App.tsx` - Added gameMode state, landing screen, INITIAL_WALLET_STATE
- `frontend/src/components/GameCanvas.tsx` - Write bridge_init.json in onRuntimeInitialized
- `frontend/src/index.css` - Added landing screen styles
- `game/src/bridge.lua` - Added parseInitJSON(), read bridge_init.json in init()
- `game/main.lua` - Start in LOUNGE with correct isGuest based on Bridge.walletConnected

**Key Changes**:
- Users see React landing screen before game loads
- Character seed is deterministic from wallet address: `parseInt(address.slice(2,18), 16) % 999999999`
- Both wallet and guest users go directly to LOUNGE (no Lua MENU needed)
- Build UUID: `ef908681-633b-419f-ad3a-77e5dfb2607a`

---

**Previous Session (Wallet→Sauna Fix v9 - Cache Busting)**:
Fixed wallet not transitioning to sauna after connect.

**Root Cause Chain**:
1. Lua used `:` instead of `.` for JS function call in pollMessages
2. `js.global:getPendingBridgeMessages()` passes js.global as first arg (wrong!)
3. Fixed to `js.global.getPendingBridgeMessages()` (plain function call)
4. But browser HTTP cache served OLD game.js with OLD UUID
5. OLD UUID matched IndexedDB cache → loaded OLD game.data without fix

**Solution**: Added `?v=timestamp` cache-busting to script URLs in GameCanvas.tsx

**Files Modified**:
- `game/src/bridge.lua:130` - Fixed `:` to `.` for getPendingBridgeMessages call
- `frontend/src/components/GameCanvas.tsx` - Added cache-busting query strings

---

**Previous Session (Bug Fix V5 - Duplicate Game Files)**:
After V3/V4 still showed old code, discovered ROOT CAUSE: **duplicate game files**.

**Problem**: There were TWO sets of game files:
- `/frontend/public/game.js` + `game.data` + `love.js` (OLD - being loaded)
- `/frontend/public/game/game.js` + `game.data` + `love.js` (NEW - ignored)

GameCanvas.tsx was loading `/game.js` from root, not `/game/game.js` from subdirectory.

**Fix Applied**:
1. Deleted old files from `frontend/public/` root
2. Updated GameCanvas.tsx to load from `/game/` subdirectory:
   - Line 125: `/game.js` → `/game/game.js`
   - Line 137: `/love.js` → `/game/love.js`

**Files Modified**:
- `frontend/public/game.js` - DELETED
- `frontend/public/game.data` - DELETED
- `frontend/public/love.js` - DELETED
- `frontend/src/components/GameCanvas.tsx` - Updated paths

**Lesson Learned**: Added ⚠️ LOVE.JS BUILD WARNING to CRITICAL REMINDERS section.

---

**Previous Session (Bug Fixes V4 - Cache Headers)**:
Tried changing UUID in game.js and adding Cache-Control headers to vercel.json.
Did not work because we changed the wrong game.js file (in /game/ not root).

---

**Previous Session (Bug Fixes V3.1 - Cache Issue + Verification)**:
After deploying V3, browser console still showed old code (`[Sounds] Missing:` instead of `[Sounds] FAILED:`). This indicated Vercel/browser was serving cached version.

- Force rebuilt Love.js with `rm -rf frontend/public/game/* && npx love.js -c ...`
- Verified game.data contains:
  - Absolute sound paths (`/assets/sounds/shoot.wav` etc.) ✓
  - `Bridge.pollMessages()` function ✓
  - WAV file headers (RIFF/WAVE) - sounds ARE packaged ✓
- User needs to hard refresh (Cmd+Shift+R) to clear browser cache

**Pending verification**: After cache clear, console should show:
- `[Sounds] OK: shoot` (or FAILED with error details)
- `[Bridge] Wallet state updated: true`

---

**Previous Session (Bug Fixes V3 - Sound + Bridge Architecture Fix)**:
V2 fixes still didn't work. Deep investigation revealed fundamental architectural issues:

- Fixed sounds not loading:
  - Root cause: Love.js Emscripten VFS requires ABSOLUTE paths (/assets/sounds/...)
  - Relative paths (assets/sounds/...) don't resolve in the virtual filesystem
  - Solution: Changed all 10 sound paths to start with /

- Fixed wallet→Sauna transition (COMPLETE REWRITE):
  - Root cause: `js.global.luaBridge = { Lua table }` does NOT expose Lua functions to JavaScript
  - Love.js/Emscripten cannot convert Lua functions to JavaScript-callable functions
  - The Lua table exists only in Lua's memory space, not accessible from React
  - Solution: Message queue pattern - React queues messages, Lua polls for them
    - React: `pendingMessages` array + `getPendingBridgeMessages()` function
    - Lua: `Bridge.pollMessages()` called every frame in love.update()
    - Lua: `Bridge.parseMessages()` and `Bridge.handleMessage()` process messages

**Files Modified**:
- `game/src/sounds.lua` - Absolute paths (/assets/sounds/...)
- `frontend/src/bridge/luaBridge.ts` - Message queue + getPendingBridgeMessages()
- `game/src/bridge.lua` - pollMessages(), parseMessages(), handleMessage()
- `game/main.lua` - Call Bridge.pollMessages() in love.update()
- `frontend/src/App.tsx` - Simplified wallet state effect (no polling needed)

---

**Previous Session (Bug Fixes V2 - Did Not Work)**:
- Tried polling for window.luaBridge (up to 5 seconds)
- Tried noTouchTime-based joystick reset
- Added debug logging to sounds.lua
- None of these fixed the underlying issues

---

**Previous Session (Wallet, Joystick, Chat, Sound Fixes V1 - Did Not Work)**:
- Fixed wallet staying connected on revisit:
  - Set `autoConnect={false}` on WalletProvider in main.tsx
- Fixed joystick always visible:
  - Added safety reset in touchcontrols.lua update() to handle missed touchreleased events
  - Checks if tracked touch ID is still active via love.touch.getTouches()
- Fixed mobile chat input:
  - Added visible React input element at bottom of screen in lounge state
  - Sends `activateChatInput` event from Lua to focus the input
  - React input handles text entry and sends messages on Enter
- Fixed sound not playing:
  - Added WebAudio context initialization on first user interaction
  - Browser security requires AudioContext.resume() after user gesture

---

**Previous Session (ConnectButton Fix, Sound Fix)**:
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
