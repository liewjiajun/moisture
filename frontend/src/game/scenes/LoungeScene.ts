// LoungeScene - Sauna social area
// Enhanced with warm atmospheric effects

import Phaser from 'phaser';
import { Character } from '../entities/Character';
import { getAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';

interface NPC {
  x: number;
  y: number;
  character: Character;
  targetX: number;
  moveTimer: number;
  facingLeft: boolean;
}

// Steam particle for atmosphere
interface SteamParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  wobble: number;
  wobbleSpeed: number;
}

export class LoungeScene extends Phaser.Scene {
  static readonly GAME_WIDTH = 180;
  static readonly GAME_HEIGHT = 320;

  bgGraphics!: Phaser.GameObjects.Graphics;
  graphics!: Phaser.GameObjects.Graphics;
  characterGraphics!: Phaser.GameObjects.Graphics;
  fxGraphics!: Phaser.GameObjects.Graphics;
  playerCharacter: Character | null = null;
  npcs: NPC[] = [];
  gameTime: number = 0;

  // Steam particles
  steamParticles: SteamParticle[] = [];

  // Player position
  playerX: number = 90;
  playerY: number = 200;
  playerFacingLeft: boolean = false;
  playerIsMoving: boolean = false;

  // Door state
  nearDoor: boolean = false;
  isPracticeMode: boolean = false;
  doorX: number = 140;
  doorY: number = 100;
  doorWidth: number = 30;
  doorHeight: number = 50;

  // Touch input
  joystickActive: boolean = false;
  joystickStartX: number = 0;
  joystickStartY: number = 0;
  joystickX: number = 0;
  joystickY: number = 0;
  touchId: number | null = null;

  // Text objects (BitmapText for pixel-perfect rendering)
  saunaTitleText!: Phaser.GameObjects.BitmapText;
  saunaTitleGlow!: Phaser.GameObjects.BitmapText;
  doorLabelText!: Phaser.GameObjects.BitmapText;
  enterButtonText!: Phaser.GameObjects.BitmapText;
  practiceText!: Phaser.GameObjects.BitmapText;
  menuButtonText!: Phaser.GameObjects.BitmapText;
  leaderboardTitleText!: Phaser.GameObjects.BitmapText;
  leaderboardTexts: Phaser.GameObjects.BitmapText[] = [];
  chatTitleText!: Phaser.GameObjects.BitmapText;
  chatTexts: Phaser.GameObjects.BitmapText[] = [];
  doorHintText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super({ key: 'LoungeScene' });
  }

  create() {
    const w = LoungeScene.GAME_WIDTH;
    const h = LoungeScene.GAME_HEIGHT;

    // Create layered graphics
    this.bgGraphics = this.add.graphics().setDepth(0);
    this.graphics = this.add.graphics().setDepth(1);
    this.characterGraphics = this.add.graphics().setDepth(2);
    this.fxGraphics = this.add.graphics().setDepth(10);

    // Initialize steam particles
    this.initSteamParticles();

    // Get or create character
    const characterSeed = this.registry.get('characterSeed') || Date.now();
    this.playerCharacter = new Character(characterSeed);

    // Reset player position
    this.playerX = w / 2;
    this.playerY = h * 0.6;

    // Sauna title with glow
    this.saunaTitleGlow = this.add.bitmapText(w / 2, 50, FONT_KEYS.LARGE, 'THE SAUNA')
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0.4)
      .setTint(0xff6600);

    this.saunaTitleText = this.add.bitmapText(w / 2, 50, FONT_KEYS.LARGE, 'THE SAUNA')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0xffcc66);

    // Door label
    this.doorLabelText = this.add.bitmapText(this.doorX, this.doorY + 8, FONT_KEYS.SMALL, 'GAME')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0x222222);

    // Door hint (shows when near)
    this.doorHintText = this.add.bitmapText(this.doorX, this.doorY - 15, FONT_KEYS.SMALL, 'ENTER')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0x00ffff)
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
    this.menuButtonText = this.add.bitmapText(22, 12, FONT_KEYS.SMALL, 'MENU')
      .setOrigin(0.5)
      .setDepth(11)
      .setTint(0xffffff);

    // Leaderboard
    this.leaderboardTitleText = this.add.bitmapText(35, 95, FONT_KEYS.SMALL, 'TOP 3')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0xffd700);

    const placeholderScores = ['1ST', '2ND', '3RD'];
    const leaderboardColors = [0xffd700, 0xc0c0c0, 0xcd7f32];
    this.leaderboardTexts = [];
    for (let i = 0; i < 3; i++) {
      const text = this.add.bitmapText(35, 108 + i * 11, FONT_KEYS.SMALL, placeholderScores[i])
        .setOrigin(0.5)
        .setDepth(10)
        .setTint(leaderboardColors[i]);
      this.leaderboardTexts.push(text);
    }

    // Chat area
    this.chatTitleText = this.add.bitmapText(10, h - 58, FONT_KEYS.SMALL, 'CHAT')
      .setDepth(10)
      .setTint(0x66ccff);

    const placeholderChat = ['Welcome!', 'Good luck', 'Have fun~'];
    this.chatTexts = [];
    for (let i = 0; i < 3; i++) {
      const text = this.add.bitmapText(10, h - 45 + i * 11, FONT_KEYS.SMALL, placeholderChat[i])
        .setDepth(10)
        .setTint(0x999999);
      this.chatTexts.push(text);
    }

    // Create NPCs
    this.createNPCs();

    // Set up input
    this.setupInput();

    // Emit state change
    this.registry.set('gameState', 'lounge');
    this.registry.events.emit('gameStateChanged', 'lounge');
  }

  initSteamParticles() {
    const w = LoungeScene.GAME_WIDTH;
    const h = LoungeScene.GAME_HEIGHT;

    for (let i = 0; i < 15; i++) {
      this.steamParticles.push({
        x: Math.random() * w,
        y: h - Math.random() * 100,
        size: 2 + Math.random() * 4,
        speed: 5 + Math.random() * 10,
        alpha: 0.05 + Math.random() * 0.1,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.5 + Math.random() * 1,
      });
    }
  }

  createNPCs() {
    this.npcs = [];
    for (let i = 0; i < 4; i++) {
      const seed = Date.now() + i * 12345 + Math.floor(Math.random() * 1000);
      this.npcs.push({
        x: 20 + Math.random() * (LoungeScene.GAME_WIDTH - 40),
        y: 150 + Math.random() * 100,
        character: new Character(seed),
        targetX: 20 + Math.random() * (LoungeScene.GAME_WIDTH - 40),
        moveTimer: Math.random() * 5,
        facingLeft: Math.random() > 0.5,
      });
    }
  }

  setupInput() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = pointer.x;
      const y = pointer.y;

      if (this.isMenuButtonClicked(x, y)) {
        getAudioSystem()?.play('click');
        this.scene.start('MenuScene');
        return;
      }

      if (this.nearDoor && this.isDoorEnterClicked(x, y)) {
        this.enterGame();
        return;
      }

      if (this.nearDoor && this.isDoorToggleClicked(x, y)) {
        this.isPracticeMode = !this.isPracticeMode;
        getAudioSystem()?.play('click');
        return;
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

  isDoorEnterClicked(x: number, y: number): boolean {
    return x >= this.doorX - 20 && x <= this.doorX + 20 &&
           y >= this.doorY + this.doorHeight + 5 && y <= this.doorY + this.doorHeight + 28;
  }

  isDoorToggleClicked(x: number, y: number): boolean {
    return x >= this.doorX - 25 && x <= this.doorX + 25 &&
           y >= this.doorY + this.doorHeight + 28 && y <= this.doorY + this.doorHeight + 48;
  }

  isMenuButtonClicked(x: number, y: number): boolean {
    return x >= 2 && x <= 42 && y >= 2 && y <= 22;
  }

  enterGame() {
    getAudioSystem()?.play('door');
    const isGuest = this.registry.get('isGuest');
    const walletConnected = this.registry.get('walletConnected');

    if (this.isPracticeMode || isGuest) {
      this.scene.start('CountdownScene', { isPractice: true });
    } else if (walletConnected) {
      this.registry.events.emit('requestEnterGame');
    } else {
      this.scene.start('CountdownScene', { isPractice: true });
    }
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.gameTime += dt;

    // Update steam
    this.updateSteamParticles(dt);

    // Get input
    let dx = this.joystickX;
    let dy = this.joystickY;

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

    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    const speed = 40;
    this.playerX += dx * speed * dt;
    this.playerY += dy * speed * dt;

    const w = LoungeScene.GAME_WIDTH;
    const h = LoungeScene.GAME_HEIGHT;
    this.playerX = Math.max(10, Math.min(w - 10, this.playerX));
    this.playerY = Math.max(120, Math.min(h - 40, this.playerY));

    this.playerIsMoving = dx !== 0 || dy !== 0;
    if (dx !== 0) this.playerFacingLeft = dx < 0;

    if (this.playerCharacter) {
      this.playerCharacter.update(dt, this.playerIsMoving);
    }

    const doorDist = Math.sqrt((this.playerX - this.doorX) ** 2 + (this.playerY - (this.doorY + this.doorHeight)) ** 2);
    this.nearDoor = doorDist < 40;

    this.updateNPCs(dt);
    this.draw();
  }

  updateSteamParticles(dt: number) {
    const w = LoungeScene.GAME_WIDTH;
    const h = LoungeScene.GAME_HEIGHT;

    for (const p of this.steamParticles) {
      p.y -= p.speed * dt;
      p.wobble += p.wobbleSpeed * dt;
      p.x += Math.sin(p.wobble) * 0.5;

      // Fade as it rises
      const heightRatio = (h - p.y) / h;
      p.alpha = Math.max(0, 0.15 - heightRatio * 0.15);

      if (p.y < 80 || p.alpha <= 0) {
        p.y = h + 10;
        p.x = Math.random() * w;
        p.alpha = 0.05 + Math.random() * 0.1;
        p.wobble = Math.random() * Math.PI * 2;
      }
    }
  }

  updateNPCs(dt: number) {
    for (const npc of this.npcs) {
      npc.moveTimer -= dt;

      if (npc.moveTimer <= 0) {
        npc.targetX = 20 + Math.random() * (LoungeScene.GAME_WIDTH - 40);
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

  draw() {
    const w = LoungeScene.GAME_WIDTH;
    const h = LoungeScene.GAME_HEIGHT;

    this.bgGraphics.clear();
    this.graphics.clear();
    this.characterGraphics.clear();
    this.fxGraphics.clear();

    // === BACKGROUND ===

    // Wall gradient (warm wood tones)
    for (let y = 0; y < 120; y += 2) {
      const t = y / 120;
      const r = Math.floor(60 + t * 20);
      const g = Math.floor(30 + t * 10);
      const b = Math.floor(20 + t * 5);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, w, 2);
    }

    // Wall planks (horizontal)
    this.bgGraphics.lineStyle(1, 0x3d1f1f, 0.4);
    for (let y = 15; y < 120; y += 20) {
      this.bgGraphics.lineBetween(0, y, w, y);
    }

    // Floor gradient (darker wood)
    for (let y = 120; y < h; y += 2) {
      const t = (y - 120) / (h - 120);
      const r = Math.floor(50 - t * 15);
      const g = Math.floor(25 - t * 8);
      const b = Math.floor(15 - t * 5);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, w, 2);
    }

    // Floor planks (horizontal lines)
    this.bgGraphics.lineStyle(1, 0x2a1515, 0.5);
    for (let y = 130; y < h; y += 16) {
      this.bgGraphics.lineBetween(0, y, w, y);
    }

    // Wall trim (decorative)
    this.bgGraphics.fillStyle(0x8b4513, 0.8);
    this.bgGraphics.fillRect(0, 0, w, 6);
    this.bgGraphics.fillRect(0, 114, w, 6);

    // === LEADERBOARD SIGN ===
    this.drawLeaderboardSign();

    // === DOOR ===
    this.drawDoor();

    // === MENU BUTTON ===
    const menuPulse = 0.7 + Math.sin(this.gameTime * 2) * 0.1;
    this.bgGraphics.fillStyle(0x331a1a, 0.9);
    this.bgGraphics.fillRoundedRect(2, 2, 40, 18, 4);
    this.bgGraphics.lineStyle(1, 0x664444, menuPulse);
    this.bgGraphics.strokeRoundedRect(2, 2, 40, 18, 4);

    // === CHAT AREA ===
    this.drawChatArea();

    // === STEAM PARTICLES ===
    for (const p of this.steamParticles) {
      this.bgGraphics.fillStyle(0xffddaa, p.alpha);
      this.bgGraphics.fillCircle(p.x, p.y, p.size);
    }

    // === AMBIENT LIGHTING ===
    this.drawAmbientLighting();

    // === CHARACTERS ===
    // NPCs behind player
    for (const npc of this.npcs) {
      if (npc.y < this.playerY) {
        npc.character.draw(this.characterGraphics, npc.x, npc.y, 1, npc.facingLeft);
      }
    }

    // Player with shadow
    if (this.playerCharacter) {
      // Shadow
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

    // === UI UPDATES ===
    this.updateDoorUI();

    // === JOYSTICK ===
    if (this.joystickActive) {
      this.fxGraphics.lineStyle(2, 0xffffff, 0.3);
      this.fxGraphics.strokeCircle(this.joystickStartX, this.joystickStartY, 25);

      this.fxGraphics.fillStyle(0x00ffff, 0.6);
      this.fxGraphics.fillCircle(
        this.joystickStartX + this.joystickX * 25,
        this.joystickStartY + this.joystickY * 25,
        8
      );
    }

    // === TITLE GLOW ===
    const titlePulse = 0.3 + Math.sin(this.gameTime * 2) * 0.2;
    this.saunaTitleGlow.setAlpha(titlePulse);
  }

  drawLeaderboardSign() {
    const signX = 8;
    const signY = 80;
    const signW = 54;
    const signH = 55;

    // Outer frame (wood)
    this.bgGraphics.fillStyle(0x5c3a21);
    this.bgGraphics.fillRoundedRect(signX, signY, signW, signH, 4);

    // Inner background
    this.bgGraphics.fillStyle(0x2a1a10);
    this.bgGraphics.fillRoundedRect(signX + 3, signY + 3, signW - 6, signH - 6, 3);

    // Gold trim
    this.bgGraphics.lineStyle(1, 0xb8860b, 0.6);
    this.bgGraphics.strokeRoundedRect(signX + 3, signY + 3, signW - 6, signH - 6, 3);

    // Medal indicators
    const medalColors = [0xffd700, 0xc0c0c0, 0xcd7f32];
    for (let i = 0; i < 3; i++) {
      // Small medal circle
      this.bgGraphics.fillStyle(medalColors[i], 0.8);
      this.bgGraphics.fillCircle(signX + 12, signY + 28 + i * 11, 3);
    }
  }

  drawDoor() {
    const doorX = this.doorX - 15;
    const doorY = this.doorY;

    // Door glow when near (pulsing)
    if (this.nearDoor) {
      const pulse = 0.4 + Math.sin(this.gameTime * 4) * 0.2;

      // Outer glow
      this.graphics.fillStyle(0x00ffff, pulse * 0.3);
      this.graphics.fillRoundedRect(doorX - 8, doorY - 8, this.doorWidth + 16, this.doorHeight + 16, 8);

      // Inner glow
      this.graphics.fillStyle(0x00ffff, pulse * 0.5);
      this.graphics.fillRoundedRect(doorX - 4, doorY - 4, this.doorWidth + 8, this.doorHeight + 8, 6);
    }

    // Door frame (dark wood)
    this.graphics.fillStyle(0x2a1515);
    this.graphics.fillRoundedRect(doorX - 4, doorY - 4, this.doorWidth + 8, this.doorHeight + 8, 4);

    // Door body (lighter wood)
    this.graphics.fillStyle(0x4d3030);
    this.graphics.fillRoundedRect(doorX, doorY, this.doorWidth, this.doorHeight, 3);

    // Door panels (decorative)
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
      this.graphics.fillStyle(0x00ffff, 0.8);

      // Down arrow pointing to door
      const arrowX = this.doorX;
      const arrowY = this.doorY - 20 + bounce;
      this.graphics.fillTriangle(
        arrowX, arrowY + 6,
        arrowX - 5, arrowY,
        arrowX + 5, arrowY
      );
    }
  }

  drawChatArea() {
    const h = LoungeScene.GAME_HEIGHT;
    const chatX = 4;
    const chatY = h - 62;
    const chatW = 95;
    const chatH = 55;

    // Chat background (dark with transparency)
    this.bgGraphics.fillStyle(0x1a1a2e, 0.85);
    this.bgGraphics.fillRoundedRect(chatX, chatY, chatW, chatH, 4);

    // Chat border (subtle cyan)
    this.bgGraphics.lineStyle(1, 0x4d6680, 0.5);
    this.bgGraphics.strokeRoundedRect(chatX, chatY, chatW, chatH, 4);

    // Chat header line
    this.bgGraphics.lineStyle(1, 0x334455, 0.6);
    this.bgGraphics.lineBetween(chatX + 4, chatY + 12, chatX + chatW - 4, chatY + 12);
  }

  drawAmbientLighting() {
    const w = LoungeScene.GAME_WIDTH;
    const h = LoungeScene.GAME_HEIGHT;

    // Warm lamp glow (top corners)
    this.bgGraphics.fillStyle(0xff6600, 0.08);
    this.bgGraphics.fillCircle(10, 10, 40);
    this.bgGraphics.fillCircle(w - 10, 10, 40);

    // Vignette (subtle)
    for (let i = 0; i < 10; i++) {
      const alpha = (1 - i / 10) * 0.15;
      this.bgGraphics.fillStyle(0x000000, alpha);
      this.bgGraphics.fillRect(0, h - i * 3, w, 3);
    }
  }

  updateDoorUI() {
    this.enterButtonText.setVisible(this.nearDoor);
    this.practiceText.setVisible(this.nearDoor);
    this.doorHintText.setVisible(this.nearDoor);

    if (this.nearDoor) {
      // Hint text animation
      const hintPulse = 0.6 + Math.sin(this.gameTime * 4) * 0.4;
      this.doorHintText.setAlpha(hintPulse);

      // Practice text color
      this.practiceText.setTint(this.isPracticeMode ? 0x66ff66 : 0x666666);

      // Draw button backgrounds
      const btnX = this.doorX - 22;
      const playBtnY = this.doorY + this.doorHeight + 6;
      const practiceBtnY = this.doorY + this.doorHeight + 28;

      // Play button
      this.graphics.fillStyle(0x006666, 0.9);
      this.graphics.fillRoundedRect(btnX, playBtnY, 44, 18, 4);
      this.graphics.lineStyle(2, 0x00ffff, 0.8);
      this.graphics.strokeRoundedRect(btnX, playBtnY, 44, 18, 4);

      // Practice toggle
      const practiceColor = this.isPracticeMode ? 0x336633 : 0x333333;
      const practiceBorder = this.isPracticeMode ? 0x66ff66 : 0x555555;
      this.graphics.fillStyle(practiceColor, 0.9);
      this.graphics.fillRoundedRect(btnX, practiceBtnY, 44, 16, 3);
      this.graphics.lineStyle(1, practiceBorder, 0.8);
      this.graphics.strokeRoundedRect(btnX, practiceBtnY, 44, 16, 3);
    }
  }
}
