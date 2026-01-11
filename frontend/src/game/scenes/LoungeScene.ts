// LoungeScene - Sauna social area with warm atmospheric effects

import Phaser from 'phaser';
import { Character } from '../entities/Character';
import { getAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  Colors,
  WobblyParticle,
  createWobblyParticles,
  sinePulse,
} from '../systems/VisualEffects';

interface NPC {
  x: number;
  y: number;
  character: Character;
  targetX: number;
  moveTimer: number;
  facingLeft: boolean;
}

export class LoungeScene extends Phaser.Scene {
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private graphics!: Phaser.GameObjects.Graphics;
  private characterGraphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;

  private playerCharacter: Character | null = null;
  private npcs: NPC[] = [];
  private gameTime = 0;
  private steamParticles: WobblyParticle[] = [];

  // Player state
  private playerX = 90;
  private playerY = 200;
  private playerFacingLeft = false;
  private playerIsMoving = false;

  // Door state
  private nearDoor = false;
  private isPracticeMode = false;
  private readonly doorX = 140;
  private readonly doorY = 100;
  private readonly doorWidth = 30;
  private readonly doorHeight = 50;

  // Joystick state
  private joystickActive = false;
  private joystickStartX = 0;
  private joystickStartY = 0;
  private joystickX = 0;
  private joystickY = 0;
  private touchId: number | null = null;

  // Text objects (dynamic ones have individual refs, static ones in array)
  private saunaTitleGlow!: Phaser.GameObjects.BitmapText;
  private enterButtonText!: Phaser.GameObjects.BitmapText;
  private practiceText!: Phaser.GameObjects.BitmapText;
  private doorHintText!: Phaser.GameObjects.BitmapText;
  private staticTexts: Phaser.GameObjects.BitmapText[] = [];

  // Dynamic content text objects
  private chatTexts: Phaser.GameObjects.BitmapText[] = [];
  private leaderboardTexts: Phaser.GameObjects.BitmapText[] = [];
  private roundTimerText!: Phaser.GameObjects.BitmapText;
  private prizePoolText!: Phaser.GameObjects.BitmapText;
  private onlineCountText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super({ key: 'LoungeScene' });
  }

  create(): void {
    this.bgGraphics = this.add.graphics().setDepth(0);
    this.graphics = this.add.graphics().setDepth(1);
    this.characterGraphics = this.add.graphics().setDepth(2);
    this.fxGraphics = this.add.graphics().setDepth(10);

    // Initialize steam particles (rising from bottom)
    this.steamParticles = createWobblyParticles(15, { width: GAME_WIDTH, height: GAME_HEIGHT }, {
      sizeRange: [2, 6],
      speedRange: [5, 15],
      alphaRange: [0.05, 0.15],
      wobbleSpeedRange: [0.5, 1.5],
      ySpread: 'bottom',
    });

    // Create character
    const characterSeed = this.registry.get('characterSeed') || Date.now();
    this.playerCharacter = new Character(characterSeed);
    this.playerX = GAME_WIDTH / 2;
    this.playerY = GAME_HEIGHT * 0.6;

    this.createTextElements();
    this.createNPCs();
    this.setupInput();

    this.registry.set('gameState', 'lounge');
    this.registry.events.emit('gameStateChanged', 'lounge');
  }

  private createTextElements(): void {
    // Sauna title with glow
    this.saunaTitleGlow = this.add.bitmapText(GAME_WIDTH / 2, 50, FONT_KEYS.LARGE, 'THE SAUNA')
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0.4)
      .setTint(Colors.ORANGE);

    this.staticTexts.push(
      this.add.bitmapText(GAME_WIDTH / 2, 50, FONT_KEYS.LARGE, 'THE SAUNA')
        .setOrigin(0.5)
        .setDepth(10)
        .setTint(0xffcc66)
    );

    // Door label
    this.staticTexts.push(
      this.add.bitmapText(this.doorX, this.doorY + 8, FONT_KEYS.SMALL, 'GAME')
        .setOrigin(0.5)
        .setDepth(10)
        .setTint(0x222222)
    );

    // Door hints and buttons (dynamic visibility)
    this.doorHintText = this.add.bitmapText(this.doorX, this.doorY - 15, FONT_KEYS.SMALL, 'ENTER')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(Colors.CYAN)
      .setVisible(false);

    this.enterButtonText = this.add.bitmapText(this.doorX, this.doorY + this.doorHeight + 18, FONT_KEYS.SMALL, 'PLAY')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0xffffff)
      .setVisible(false);

    this.practiceText = this.add.bitmapText(this.doorX, this.doorY + this.doorHeight + 38, FONT_KEYS.SMALL, 'PRACTICE')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0x888888)
      .setVisible(false);

    // Menu button
    this.staticTexts.push(
      this.add.bitmapText(22, 12, FONT_KEYS.SMALL, 'MENU')
        .setOrigin(0.5)
        .setDepth(11)
        .setTint(0xffffff)
    );

    // Leaderboard
    this.staticTexts.push(
      this.add.bitmapText(35, 95, FONT_KEYS.SMALL, 'TOP 3')
        .setOrigin(0.5)
        .setDepth(10)
        .setTint(Colors.GOLD)
    );

    // Dynamic leaderboard entries
    const leaderboardColors = [Colors.GOLD, Colors.SILVER, Colors.BRONZE];
    for (let i = 0; i < 3; i++) {
      const text = this.add.bitmapText(35, 108 + i * 11, FONT_KEYS.SMALL, '---')
        .setOrigin(0.5)
        .setDepth(10)
        .setTint(leaderboardColors[i]);
      this.leaderboardTexts.push(text);
    }

    // Round info (bottom right)
    this.roundTimerText = this.add.bitmapText(GAME_WIDTH - 6, GAME_HEIGHT - 52, FONT_KEYS.SMALL, '00:00')
      .setOrigin(1, 0)
      .setDepth(10)
      .setTint(Colors.CYAN);

    this.prizePoolText = this.add.bitmapText(GAME_WIDTH - 6, GAME_HEIGHT - 40, FONT_KEYS.SMALL, '0 SUI')
      .setOrigin(1, 0)
      .setDepth(10)
      .setTint(Colors.GOLD);

    this.onlineCountText = this.add.bitmapText(GAME_WIDTH - 6, GAME_HEIGHT - 28, FONT_KEYS.SMALL, '0 ONLINE')
      .setOrigin(1, 0)
      .setDepth(10)
      .setTint(0x66ff66);

    // Chat area
    this.staticTexts.push(
      this.add.bitmapText(10, GAME_HEIGHT - 58, FONT_KEYS.SMALL, 'CHAT')
        .setDepth(10)
        .setTint(0x66ccff)
    );

    // Dynamic chat messages (3 visible at a time)
    for (let i = 0; i < 3; i++) {
      const text = this.add.bitmapText(10, GAME_HEIGHT - 45 + i * 11, FONT_KEYS.SMALL, '')
        .setDepth(10)
        .setTint(0x999999);
      this.chatTexts.push(text);
    }
  }

  private createNPCs(): void {
    this.npcs = [];
    for (let i = 0; i < 4; i++) {
      const seed = Date.now() + i * 12345 + Math.floor(Math.random() * 1000);
      this.npcs.push({
        x: 20 + Math.random() * (GAME_WIDTH - 40),
        y: 150 + Math.random() * 100,
        character: new Character(seed),
        targetX: 20 + Math.random() * (GAME_WIDTH - 40),
        moveTimer: Math.random() * 5,
        facingLeft: Math.random() > 0.5,
      });
    }
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const { x, y } = pointer;

      if (this.isMenuButtonClicked(x, y)) {
        getAudioSystem()?.play('click');
        this.scene.start('MenuScene');
        return;
      }

      if (this.nearDoor) {
        if (this.isDoorEnterClicked(x, y)) {
          this.enterGame();
          return;
        }
        if (this.isDoorToggleClicked(x, y)) {
          this.isPracticeMode = !this.isPracticeMode;
          getAudioSystem()?.play('click');
          return;
        }
      }

      if (!this.joystickActive) {
        this.joystickActive = true;
        this.joystickStartX = x;
        this.joystickStartY = y;
        this.joystickX = 0;
        this.joystickY = 0;
        this.touchId = pointer.id;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickActive && pointer.id === this.touchId) {
        const dx = pointer.x - this.joystickStartX;
        const dy = pointer.y - this.joystickStartY;
        const maxDist = 30;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          const normDist = Math.min(dist, maxDist);
          this.joystickX = (dx / dist) * (normDist / maxDist);
          this.joystickY = (dy / dist) * (normDist / maxDist);
        }
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.touchId) {
        this.joystickActive = false;
        this.joystickX = 0;
        this.joystickY = 0;
        this.touchId = null;
      }
    });
  }

  private isDoorEnterClicked(x: number, y: number): boolean {
    return x >= this.doorX - 20 && x <= this.doorX + 20 &&
           y >= this.doorY + this.doorHeight + 5 && y <= this.doorY + this.doorHeight + 28;
  }

  private isDoorToggleClicked(x: number, y: number): boolean {
    return x >= this.doorX - 25 && x <= this.doorX + 25 &&
           y >= this.doorY + this.doorHeight + 28 && y <= this.doorY + this.doorHeight + 48;
  }

  private isMenuButtonClicked(x: number, y: number): boolean {
    return x >= 2 && x <= 42 && y >= 2 && y <= 22;
  }

  private enterGame(): void {
    getAudioSystem()?.play('door');
    const isGuest = this.registry.get('isGuest');
    const walletConnected = this.registry.get('walletConnected');

    if (this.isPracticeMode || isGuest || !walletConnected) {
      this.scene.start('CountdownScene', { isPractice: true });
    } else {
      this.registry.events.emit('requestEnterGame');
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.gameTime += dt;

    this.updateSteamParticles(dt);
    this.updatePlayerMovement(dt);
    this.updateNPCs(dt);
    this.updateDynamicContent();
    this.draw();
  }

  private updateDynamicContent(): void {
    // Update chat messages from registry
    const chatMessages = this.registry.get('chatMessages') || [];
    const recentMessages = chatMessages.slice(-3); // Last 3 messages
    for (let i = 0; i < 3; i++) {
      const msg = recentMessages[i];
      if (msg) {
        // Truncate sender address and message for display
        const sender = msg.sender.length > 8 ? msg.sender.slice(0, 6) + '..' : msg.sender;
        const text = msg.message.length > 10 ? msg.message.slice(0, 10) + '..' : msg.message;
        this.chatTexts[i].setText(`${sender}: ${text}`);
      } else {
        this.chatTexts[i].setText('');
      }
    }

    // Update leaderboard from registry
    const leaderboard = this.registry.get('leaderboard') || [];
    for (let i = 0; i < 3; i++) {
      const entry = leaderboard[i];
      if (entry) {
        // Format time as seconds with 1 decimal (survivalTime is in ms)
        const timeStr = (entry.survivalTime / 1000).toFixed(1) + 's';
        const addr = entry.address.length > 6 ? entry.address.slice(0, 4) + '..' : entry.address;
        this.leaderboardTexts[i].setText(`${addr} ${timeStr}`);
      } else {
        this.leaderboardTexts[i].setText('---');
      }
    }

    // Update round timer
    const timeRemaining = this.registry.get('roundTimeRemaining') || 0;
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    this.roundTimerText.setText(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);

    // Update prize pool (convert from MIST to SUI)
    const prizePool = this.registry.get('prizePool') || 0;
    const suiAmount = (prizePool / 1_000_000_000).toFixed(1);
    this.prizePoolText.setText(`${suiAmount} SUI`);

    // Update online count
    const onlineCount = this.registry.get('onlineCount') || 0;
    this.onlineCountText.setText(`${onlineCount} ONLINE`);
  }

  private updateSteamParticles(dt: number): void {
    for (const p of this.steamParticles) {
      p.y -= p.speed * dt;
      p.wobble += p.wobbleSpeed * dt;
      p.x += Math.sin(p.wobble) * 0.5;

      // Fade as it rises
      const heightRatio = (GAME_HEIGHT - p.y) / GAME_HEIGHT;
      p.alpha = Math.max(0, 0.15 - heightRatio * 0.15);

      if (p.y < 80 || p.alpha <= 0) {
        p.y = GAME_HEIGHT + 10;
        p.x = Math.random() * GAME_WIDTH;
        p.alpha = 0.05 + Math.random() * 0.1;
        p.wobble = Math.random() * Math.PI * 2;
      }
    }
  }

  private updatePlayerMovement(dt: number): void {
    let dx = this.joystickX;
    let dy = this.joystickY;

    // Keyboard input
    const cursors = this.input.keyboard?.createCursorKeys();
    const wasd = this.input.keyboard?.addKeys('W,A,S,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    if (cursors?.left.isDown || wasd?.A.isDown) dx = -1;
    if (cursors?.right.isDown || wasd?.D.isDown) dx = 1;
    if (cursors?.up.isDown || wasd?.W.isDown) dy = -1;
    if (cursors?.down.isDown || wasd?.S.isDown) dy = 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    const speed = 40;
    this.playerX += dx * speed * dt;
    this.playerY += dy * speed * dt;

    // Clamp to bounds
    this.playerX = Math.max(10, Math.min(GAME_WIDTH - 10, this.playerX));
    this.playerY = Math.max(120, Math.min(GAME_HEIGHT - 40, this.playerY));

    this.playerIsMoving = dx !== 0 || dy !== 0;
    if (dx !== 0) this.playerFacingLeft = dx < 0;

    this.playerCharacter?.update(dt, this.playerIsMoving);

    // Check door proximity
    const doorDist = Math.sqrt(
      (this.playerX - this.doorX) ** 2 +
      (this.playerY - (this.doorY + this.doorHeight)) ** 2
    );
    this.nearDoor = doorDist < 40;
  }

  private updateNPCs(dt: number): void {
    for (const npc of this.npcs) {
      npc.moveTimer -= dt;

      if (npc.moveTimer <= 0) {
        npc.targetX = 20 + Math.random() * (GAME_WIDTH - 40);
        npc.moveTimer = 3 + Math.random() * 5;
      }

      const dx = npc.targetX - npc.x;
      if (Math.abs(dx) > 2) {
        const speed = 15;
        npc.x += Math.sign(dx) * speed * dt;
        npc.facingLeft = dx < 0;
        npc.character.update(dt, true);
      } else {
        npc.character.update(dt, false);
      }
    }
  }

  private draw(): void {
    this.bgGraphics.clear();
    this.graphics.clear();
    this.characterGraphics.clear();
    this.fxGraphics.clear();

    this.drawBackground();
    this.drawLeaderboardSign();
    this.drawDoor();
    this.drawMenuButton();
    this.drawChatArea();
    this.drawSteamParticles();
    this.drawAmbientLighting();
    this.drawCharacters();
    this.updateDoorUI();
    this.drawJoystick();
    this.updateTitleGlow();
  }

  private drawBackground(): void {
    // Wall gradient (warm wood tones)
    for (let y = 0; y < 120; y += 2) {
      const t = y / 120;
      const r = Math.floor(60 + t * 20);
      const g = Math.floor(30 + t * 10);
      const b = Math.floor(20 + t * 5);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, GAME_WIDTH, 2);
    }

    // Wall planks
    this.bgGraphics.lineStyle(1, 0x3d1f1f, 0.4);
    for (let y = 15; y < 120; y += 20) {
      this.bgGraphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    // Floor gradient (darker wood)
    for (let y = 120; y < GAME_HEIGHT; y += 2) {
      const t = (y - 120) / (GAME_HEIGHT - 120);
      const r = Math.floor(50 - t * 15);
      const g = Math.floor(25 - t * 8);
      const b = Math.floor(15 - t * 5);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, GAME_WIDTH, 2);
    }

    // Floor planks
    this.bgGraphics.lineStyle(1, 0x2a1515, 0.5);
    for (let y = 130; y < GAME_HEIGHT; y += 16) {
      this.bgGraphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    // Wall trim
    this.bgGraphics.fillStyle(0x8b4513, 0.8);
    this.bgGraphics.fillRect(0, 0, GAME_WIDTH, 6);
    this.bgGraphics.fillRect(0, 114, GAME_WIDTH, 6);
  }

  private drawLeaderboardSign(): void {
    const signX = 8;
    const signY = 80;
    const signW = 54;
    const signH = 55;

    // Outer frame
    this.bgGraphics.fillStyle(0x5c3a21);
    this.bgGraphics.fillRoundedRect(signX, signY, signW, signH, 4);

    // Inner background
    this.bgGraphics.fillStyle(0x2a1a10);
    this.bgGraphics.fillRoundedRect(signX + 3, signY + 3, signW - 6, signH - 6, 3);

    // Gold trim
    this.bgGraphics.lineStyle(1, 0xb8860b, 0.6);
    this.bgGraphics.strokeRoundedRect(signX + 3, signY + 3, signW - 6, signH - 6, 3);

    // Medal indicators
    const medalColors = [Colors.GOLD, Colors.SILVER, Colors.BRONZE];
    for (let i = 0; i < 3; i++) {
      this.bgGraphics.fillStyle(medalColors[i], 0.8);
      this.bgGraphics.fillCircle(signX + 12, signY + 28 + i * 11, 3);
    }
  }

  private drawDoor(): void {
    const doorX = this.doorX - 15;
    const doorY = this.doorY;

    // Door glow when near
    if (this.nearDoor) {
      const pulse = sinePulse(this.gameTime, 4, 0.2, 0.4);

      this.graphics.fillStyle(Colors.CYAN, pulse * 0.3);
      this.graphics.fillRoundedRect(doorX - 8, doorY - 8, this.doorWidth + 16, this.doorHeight + 16, 8);

      this.graphics.fillStyle(Colors.CYAN, pulse * 0.5);
      this.graphics.fillRoundedRect(doorX - 4, doorY - 4, this.doorWidth + 8, this.doorHeight + 8, 6);
    }

    // Door frame
    this.graphics.fillStyle(0x2a1515);
    this.graphics.fillRoundedRect(doorX - 4, doorY - 4, this.doorWidth + 8, this.doorHeight + 8, 4);

    // Door body
    this.graphics.fillStyle(0x4d3030);
    this.graphics.fillRoundedRect(doorX, doorY, this.doorWidth, this.doorHeight, 3);

    // Door panels
    this.graphics.fillStyle(0x3d2525);
    this.graphics.fillRoundedRect(doorX + 3, doorY + 4, this.doorWidth - 6, 18, 2);
    this.graphics.fillRoundedRect(doorX + 3, doorY + 26, this.doorWidth - 6, 20, 2);

    // Door handle
    this.graphics.fillStyle(0xb8860b);
    this.graphics.fillCircle(doorX + this.doorWidth - 6, doorY + this.doorHeight / 2, 3);

    // Label background
    this.graphics.fillStyle(0xddccaa);
    this.graphics.fillRoundedRect(doorX + 3, doorY + 2, this.doorWidth - 6, 12, 2);

    // Arrow indicator when near
    if (this.nearDoor) {
      const bounce = Math.sin(this.gameTime * 6) * 2;
      this.graphics.fillStyle(Colors.CYAN, 0.8);

      const arrowX = this.doorX;
      const arrowY = this.doorY - 20 + bounce;
      this.graphics.fillTriangle(
        arrowX, arrowY + 6,
        arrowX - 5, arrowY,
        arrowX + 5, arrowY
      );
    }
  }

  private drawMenuButton(): void {
    const menuPulse = sinePulse(this.gameTime, 2, 0.1, 0.7);
    this.bgGraphics.fillStyle(0x331a1a, 0.9);
    this.bgGraphics.fillRoundedRect(2, 2, 40, 18, 4);
    this.bgGraphics.lineStyle(1, 0x664444, menuPulse);
    this.bgGraphics.strokeRoundedRect(2, 2, 40, 18, 4);
  }

  private drawChatArea(): void {
    const chatX = 4;
    const chatY = GAME_HEIGHT - 62;
    const chatW = 95;
    const chatH = 55;

    this.bgGraphics.fillStyle(0x1a1a2e, 0.85);
    this.bgGraphics.fillRoundedRect(chatX, chatY, chatW, chatH, 4);

    this.bgGraphics.lineStyle(1, 0x4d6680, 0.5);
    this.bgGraphics.strokeRoundedRect(chatX, chatY, chatW, chatH, 4);

    this.bgGraphics.lineStyle(1, 0x334455, 0.6);
    this.bgGraphics.lineBetween(chatX + 4, chatY + 12, chatX + chatW - 4, chatY + 12);
  }

  private drawSteamParticles(): void {
    for (const p of this.steamParticles) {
      this.bgGraphics.fillStyle(0xffddaa, p.alpha);
      this.bgGraphics.fillCircle(p.x, p.y, p.size);
    }
  }

  private drawAmbientLighting(): void {
    // Warm lamp glow (top corners)
    this.bgGraphics.fillStyle(Colors.ORANGE, 0.08);
    this.bgGraphics.fillCircle(10, 10, 40);
    this.bgGraphics.fillCircle(GAME_WIDTH - 10, 10, 40);

    // Vignette (subtle)
    for (let i = 0; i < 10; i++) {
      const alpha = (1 - i / 10) * 0.15;
      this.bgGraphics.fillStyle(0x000000, alpha);
      this.bgGraphics.fillRect(0, GAME_HEIGHT - i * 3, GAME_WIDTH, 3);
    }
  }

  private drawCharacters(): void {
    // NPCs behind player
    for (const npc of this.npcs) {
      if (npc.y < this.playerY) {
        npc.character.draw(this.characterGraphics, npc.x, npc.y, 1, npc.facingLeft);
      }
    }

    // Player with shadow
    if (this.playerCharacter) {
      this.characterGraphics.fillStyle(0x000000, 0.2);
      this.characterGraphics.fillEllipse(this.playerX, this.playerY + 8, 12, 4);
      this.playerCharacter.draw(this.characterGraphics, this.playerX, this.playerY, 1, this.playerFacingLeft);
    }

    // NPCs in front of player
    for (const npc of this.npcs) {
      if (npc.y >= this.playerY) {
        npc.character.draw(this.characterGraphics, npc.x, npc.y, 1, npc.facingLeft);
      }
    }
  }

  private updateDoorUI(): void {
    this.enterButtonText.setVisible(this.nearDoor);
    this.practiceText.setVisible(this.nearDoor);
    this.doorHintText.setVisible(this.nearDoor);

    if (!this.nearDoor) return;

    // Hint text animation
    const hintPulse = sinePulse(this.gameTime, 4, 0.4, 0.6);
    this.doorHintText.setAlpha(hintPulse);

    // Practice text color
    this.practiceText.setTint(this.isPracticeMode ? 0x66ff66 : 0x666666);

    // Button backgrounds
    const btnX = this.doorX - 22;
    const playBtnY = this.doorY + this.doorHeight + 6;
    const practiceBtnY = this.doorY + this.doorHeight + 28;

    // Play button
    this.graphics.fillStyle(0x006666, 0.9);
    this.graphics.fillRoundedRect(btnX, playBtnY, 44, 18, 4);
    this.graphics.lineStyle(2, Colors.CYAN, 0.8);
    this.graphics.strokeRoundedRect(btnX, playBtnY, 44, 18, 4);

    // Practice toggle
    const practiceColor = this.isPracticeMode ? 0x336633 : 0x333333;
    const practiceBorder = this.isPracticeMode ? 0x66ff66 : 0x555555;
    this.graphics.fillStyle(practiceColor, 0.9);
    this.graphics.fillRoundedRect(btnX, practiceBtnY, 44, 16, 3);
    this.graphics.lineStyle(1, practiceBorder, 0.8);
    this.graphics.strokeRoundedRect(btnX, practiceBtnY, 44, 16, 3);
  }

  private drawJoystick(): void {
    if (!this.joystickActive) return;

    this.fxGraphics.lineStyle(2, 0xffffff, 0.3);
    this.fxGraphics.strokeCircle(this.joystickStartX, this.joystickStartY, 25);

    this.fxGraphics.fillStyle(Colors.CYAN, 0.6);
    this.fxGraphics.fillCircle(
      this.joystickStartX + this.joystickX * 25,
      this.joystickStartY + this.joystickY * 25,
      8
    );
  }

  private updateTitleGlow(): void {
    const titlePulse = sinePulse(this.gameTime, 2, 0.2, 0.3);
    this.saunaTitleGlow.setAlpha(titlePulse);
  }

  shutdown(): void {
    this.staticTexts.forEach(text => text.destroy());
    this.staticTexts = [];
    this.chatTexts.forEach(text => text.destroy());
    this.chatTexts = [];
    this.leaderboardTexts.forEach(text => text.destroy());
    this.leaderboardTexts = [];
  }
}
