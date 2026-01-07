// MenuScene - Title screen
// Enhanced with synthwave/vaporwave moisture aesthetic

import Phaser from 'phaser';
import { Character } from '../entities/Character';
import { getAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';

// Moisture particle for atmospheric effect
interface MoistureParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  wobble: number;
  wobbleSpeed: number;
}

export class MenuScene extends Phaser.Scene {
  static readonly GAME_WIDTH = 180;
  static readonly GAME_HEIGHT = 320;

  graphics!: Phaser.GameObjects.Graphics;
  bgGraphics!: Phaser.GameObjects.Graphics;
  fxGraphics!: Phaser.GameObjects.Graphics;
  character: Character | null = null;
  gameTime: number = 0;

  // Moisture particles for atmosphere
  particles: MoistureParticle[] = [];

  // Text objects (BitmapText for pixel-perfect rendering)
  titleText!: Phaser.GameObjects.BitmapText;
  titleGlow1!: Phaser.GameObjects.BitmapText;
  titleGlow2!: Phaser.GameObjects.BitmapText;
  titleGlowCyan!: Phaser.GameObjects.BitmapText;
  titleGlowMagenta!: Phaser.GameObjects.BitmapText;
  subtitleText!: Phaser.GameObjects.BitmapText;
  guestButtonText!: Phaser.GameObjects.BitmapText;
  footerText!: Phaser.GameObjects.BitmapText;

  // Button hover state
  isButtonHovered: boolean = false;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;

    // Create layered graphics for depth
    this.bgGraphics = this.add.graphics().setDepth(0);
    this.graphics = this.add.graphics().setDepth(5);
    this.fxGraphics = this.add.graphics().setDepth(15);

    // Initialize moisture particles
    this.initParticles();

    // Create chromatic aberration glow layers (RGB split effect)
    // Magenta layer (left offset)
    this.titleGlowMagenta = this.add.bitmapText(w / 2 - 2, h * 0.25 + 10, FONT_KEYS.LARGE, 'MOISTURE')
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(0xff00ff);

    // Cyan layer (right offset)
    this.titleGlowCyan = this.add.bitmapText(w / 2 + 2, h * 0.25 + 10, FONT_KEYS.LARGE, 'MOISTURE')
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(0x00ffff);

    // Soft glow layers (behind main text)
    this.titleGlow1 = this.add.bitmapText(w / 2 - 1, h * 0.25 + 9, FONT_KEYS.LARGE, 'MOISTURE')
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0.5)
      .setTint(0x00ffff);

    this.titleGlow2 = this.add.bitmapText(w / 2 + 1, h * 0.25 + 11, FONT_KEYS.LARGE, 'MOISTURE')
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0.5)
      .setTint(0x00ffff);

    // Main title text (white core)
    this.titleText = this.add.bitmapText(w / 2, h * 0.25 + 10, FONT_KEYS.LARGE, 'MOISTURE')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0xffffff);

    // Subtitle with slight animation offset
    this.subtitleText = this.add.bitmapText(w / 2, h * 0.25 + 34, FONT_KEYS.SMALL, 'BULLET HELL SURVIVOR')
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0.7)
      .setTint(0x00ffff);

    // Button text
    this.guestButtonText = this.add.bitmapText(w / 2, h * 0.72 + 12, FONT_KEYS.SMALL, 'PLAY AS GUEST')
      .setOrigin(0.5)
      .setDepth(11)
      .setTint(0xffffff);

    // Footer
    this.footerText = this.add.bitmapText(w / 2, h - 15, FONT_KEYS.SMALL, 'TAP TO ENTER')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0x666666);

    // Get or create character seed
    let characterSeed = this.registry.get('characterSeed');
    if (!characterSeed) {
      characterSeed = Date.now() + Math.floor(Math.random() * 999999);
      this.registry.set('characterSeed', characterSeed);
    }

    this.character = new Character(characterSeed);

    // Set up input
    this.setupInput();

    // Emit state change
    this.registry.set('gameState', 'menu');
    this.registry.events.emit('gameStateChanged', 'menu');
  }

  initParticles() {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;

    // Create initial moisture particles
    for (let i = 0; i < 25; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 1 + Math.random() * 2,
        speed: 8 + Math.random() * 12,
        alpha: 0.1 + Math.random() * 0.3,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 1 + Math.random() * 2,
      });
    }
  }

  setupInput() {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;
    const btnW = 100;
    const btnH = 24;
    const btnX = (w - btnW) / 2;
    const guestY = h * 0.72;

    // Touch/click handlers
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const x = pointer.x;
      const y = pointer.y;

      // Play as Guest button
      if (x >= btnX && x <= btnX + btnW && y >= guestY && y <= guestY + btnH) {
        this.enterAsGuest();
      }
    });

    // Pointer move for hover effect
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const x = pointer.x;
      const y = pointer.y;
      this.isButtonHovered = (x >= btnX && x <= btnX + btnW && y >= guestY && y <= guestY + btnH);
    });

    // Keyboard
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.enterAsGuest();
    });
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.enterAsGuest();
    });
  }

  enterAsGuest() {
    getAudioSystem()?.play('click');
    this.registry.set('isGuest', true);
    this.scene.start('LoungeScene');
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.gameTime += dt;

    if (this.character) {
      this.character.update(dt, false);
    }

    // Update particles
    this.updateParticles(dt);

    // Check if wallet connected (from React)
    const walletConnected = this.registry.get('walletConnected');
    if (walletConnected) {
      this.registry.set('isGuest', false);
      this.scene.start('LoungeScene');
      return;
    }

    this.draw();
  }

  updateParticles(dt: number) {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;

    for (const p of this.particles) {
      // Rise upward
      p.y -= p.speed * dt;
      // Wobble horizontally
      p.wobble += p.wobbleSpeed * dt;
      p.x += Math.sin(p.wobble) * 0.3;

      // Respawn at bottom when off-screen
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
        p.wobble = Math.random() * Math.PI * 2;
      }

      // Wrap horizontally
      if (p.x < 0) p.x = w;
      if (p.x > w) p.x = 0;
    }
  }

  draw() {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;

    this.bgGraphics.clear();
    this.graphics.clear();
    this.fxGraphics.clear();

    // === BACKGROUND LAYER ===

    // Deep gradient background (dark purple to black)
    for (let y = 0; y < h; y += 2) {
      const t = y / h;
      // Blend from deep purple at top to near-black at bottom
      const r = Math.floor(15 - t * 10);
      const g = Math.floor(5 - t * 5);
      const b = Math.floor(25 - t * 15);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, w, 2);
    }

    // Perspective grid floor (bottom half)
    this.drawPerspectiveGrid();

    // === MOISTURE PARTICLES ===
    for (const p of this.particles) {
      // Glow around particle
      this.bgGraphics.fillStyle(0x00ffff, p.alpha * 0.3);
      this.bgGraphics.fillCircle(p.x, p.y, p.size + 1);
      // Core
      this.bgGraphics.fillStyle(0xffffff, p.alpha);
      this.bgGraphics.fillCircle(p.x, p.y, p.size * 0.5);
    }

    // === MAIN GRAPHICS LAYER ===

    // Title glow effects
    const pulse = 0.6 + Math.sin(this.gameTime * 2.5) * 0.4;
    const chromaPulse = 0.3 + Math.sin(this.gameTime * 3) * 0.2;

    // Update chromatic aberration layers
    this.titleGlowMagenta.setAlpha(chromaPulse);
    this.titleGlowCyan.setAlpha(chromaPulse);

    // Update soft glow layers
    this.titleGlow1.setAlpha(0.4 * pulse);
    this.titleGlow2.setAlpha(0.4 * pulse);

    // Title background glow (large, soft)
    this.graphics.fillStyle(0x00ffff, 0.15 * pulse);
    this.graphics.fillCircle(w / 2, h * 0.25 + 10, 50);

    // Inner glow rectangle
    this.graphics.fillStyle(0x00ffff, 0.25 * pulse);
    this.graphics.fillRoundedRect(w / 2 - 55, h * 0.25 - 2, 110, 26, 4);

    // Subtitle pulse
    const subPulse = 0.5 + Math.sin(this.gameTime * 1.5) * 0.2;
    this.subtitleText.setAlpha(subPulse);

    // Character preview with enhanced glow
    if (this.character) {
      const bob = Math.sin(this.gameTime * 2) * 2;

      // Character glow (shadow beneath)
      this.graphics.fillStyle(0x00ffff, 0.2);
      this.graphics.fillEllipse(w / 2, h * 0.45 + 15, 20, 6);

      this.character.draw(this.graphics, w / 2, h * 0.45 + bob, 2, false);
    }

    // === BUTTON ===
    const btnW = 100;
    const btnH = 24;
    const btnX = (w - btnW) / 2;
    const guestY = h * 0.72;

    // Button glow (larger when hovered)
    const btnGlow = this.isButtonHovered ? 0.4 : 0.15;
    const btnGlowSize = this.isButtonHovered ? 8 : 4;
    this.graphics.fillStyle(0x00ffff, btnGlow * pulse);
    this.graphics.fillRoundedRect(btnX - btnGlowSize, guestY - btnGlowSize, btnW + btnGlowSize * 2, btnH + btnGlowSize * 2, 6);

    // Button background
    const btnBg = this.isButtonHovered ? 0x004444 : 0x002222;
    this.graphics.fillStyle(btnBg, 0.8);
    this.graphics.fillRoundedRect(btnX, guestY, btnW, btnH, 4);

    // Button border
    const borderColor = this.isButtonHovered ? 0x00ffff : 0x008888;
    this.graphics.lineStyle(2, borderColor, 0.9);
    this.graphics.strokeRoundedRect(btnX, guestY, btnW, btnH, 4);

    // Button text glow
    this.guestButtonText.setTint(this.isButtonHovered ? 0x00ffff : 0xffffff);

    // Footer background
    const footerPulse = 0.4 + Math.sin(this.gameTime * 2) * 0.2;
    this.graphics.fillStyle(0x333333, footerPulse);
    this.graphics.fillRoundedRect(w / 2 - 50, h - 22, 100, 14, 2);
    this.footerText.setAlpha(footerPulse);

    // === EFFECTS LAYER ===

    // Vignette (darker corners)
    this.drawVignette();

    // Scanlines (subtle CRT effect)
    this.drawScanlines();
  }

  drawPerspectiveGrid() {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;

    // Grid starts from middle and extends down
    const gridStartY = h * 0.55;
    const horizonY = h * 0.5;

    // Horizontal lines (perspective spacing)
    const lineCount = 8;
    for (let i = 0; i <= lineCount; i++) {
      const t = i / lineCount;
      // Perspective: lines get closer together near horizon
      const perspectiveT = Math.pow(t, 1.5);
      const y = gridStartY + (h - gridStartY) * perspectiveT;

      const alpha = 0.1 + t * 0.15;
      this.bgGraphics.lineStyle(1, 0x00ffff, alpha);
      this.bgGraphics.lineBetween(0, y, w, y);
    }

    // Vertical lines (converge toward horizon center)
    const vLineCount = 9;
    for (let i = 0; i <= vLineCount; i++) {
      const t = i / vLineCount;
      const topX = w * t; // At horizon
      const bottomX = -20 + (w + 40) * t; // Wider at bottom

      const alpha = 0.05 + Math.abs(t - 0.5) * 0.15;
      this.bgGraphics.lineStyle(1, 0x00ffff, alpha);
      this.bgGraphics.lineBetween(topX, horizonY, bottomX, h);
    }
  }

  drawVignette() {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;

    const pulse = 0.3 + Math.sin(this.gameTime * 1.5) * 0.1;

    // Corner shadows
    for (let i = 1; i <= 4; i++) {
      const size = i * 15;
      const alpha = pulse * (1 - i / 5) * 0.4;
      this.fxGraphics.fillStyle(0x000000, alpha);

      // Top-left corner
      this.fxGraphics.fillTriangle(0, 0, size, 0, 0, size);
      // Top-right corner
      this.fxGraphics.fillTriangle(w, 0, w - size, 0, w, size);
      // Bottom-left corner
      this.fxGraphics.fillTriangle(0, h, size, h, 0, h - size);
      // Bottom-right corner
      this.fxGraphics.fillTriangle(w, h, w - size, h, w, h - size);
    }

    // Edge fade (top and bottom)
    for (let i = 0; i < 20; i++) {
      const alpha = (1 - i / 20) * 0.3;
      this.fxGraphics.fillStyle(0x000000, alpha);
      this.fxGraphics.fillRect(0, i, w, 1);
      this.fxGraphics.fillRect(0, h - 1 - i, w, 1);
    }
  }

  drawScanlines() {
    const w = MenuScene.GAME_WIDTH;
    const h = MenuScene.GAME_HEIGHT;

    // Subtle scanline effect
    for (let y = 0; y < h; y += 3) {
      this.fxGraphics.fillStyle(0x000000, 0.08);
      this.fxGraphics.fillRect(0, y, w, 1);
    }
  }
}
