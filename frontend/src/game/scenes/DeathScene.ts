// DeathScene - Game over screen
// Enhanced with dramatic visual effects

import Phaser from 'phaser';
import { Character } from '../entities/Character';
import { getAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';

// Floating particle for atmosphere
interface FloatParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  color: number;
}

export class DeathScene extends Phaser.Scene {
  static readonly GAME_WIDTH = 180;
  static readonly GAME_HEIGHT = 320;

  graphics!: Phaser.GameObjects.Graphics;
  fxGraphics!: Phaser.GameObjects.Graphics;
  character: Character | null = null;
  survivalTime: number = 0;
  score: number = 0;
  isPractice: boolean = false;
  gameTime: number = 0;

  // Floating particles
  particles: FloatParticle[] = [];

  // Text objects (BitmapText for pixel-perfect rendering)
  titleText!: Phaser.GameObjects.BitmapText;
  titleGlow1!: Phaser.GameObjects.BitmapText;
  titleGlow2!: Phaser.GameObjects.BitmapText;
  titleGlowOuter!: Phaser.GameObjects.BitmapText;
  timeText!: Phaser.GameObjects.BitmapText;
  timeLabelText!: Phaser.GameObjects.BitmapText;
  scoreText!: Phaser.GameObjects.BitmapText;
  scoreLabelText!: Phaser.GameObjects.BitmapText;
  promptText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super({ key: 'DeathScene' });
  }

  init(data: { survivalTime?: number; score?: number; isPractice?: boolean }) {
    this.survivalTime = data.survivalTime ?? 0;
    this.score = data.score ?? 0;
    this.isPractice = data.isPractice ?? false;
    this.gameTime = 0;
  }

  create() {
    const w = DeathScene.GAME_WIDTH;
    const h = DeathScene.GAME_HEIGHT;

    this.graphics = this.add.graphics().setDepth(0);
    this.fxGraphics = this.add.graphics().setDepth(10);

    // Initialize particles
    this.initParticles();

    // Get character
    const characterSeed = this.registry.get('characterSeed') || Date.now();
    this.character = new Character(characterSeed);

    // Title setup
    const titleLabel = this.isPractice ? 'PRACTICE' : 'EVAPORATED';
    const titleTint = this.isPractice ? 0x66cc99 : 0xff6666;
    const titleY = h / 2 - 60;

    // Outer glow (chromatic)
    this.titleGlowOuter = this.add.bitmapText(w / 2, titleY, FONT_KEYS.LARGE, titleLabel)
      .setOrigin(0.5)
      .setDepth(7)
      .setAlpha(0.2)
      .setTint(this.isPractice ? 0x00ffff : 0xff00ff);

    // Glow layers
    this.titleGlow1 = this.add.bitmapText(w / 2 - 1, titleY - 1, FONT_KEYS.LARGE, titleLabel)
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(titleTint);

    this.titleGlow2 = this.add.bitmapText(w / 2 + 1, titleY + 1, FONT_KEYS.LARGE, titleLabel)
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(titleTint);

    // Main title
    this.titleText = this.add.bitmapText(w / 2, titleY, FONT_KEYS.LARGE, titleLabel)
      .setOrigin(0.5)
      .setDepth(9)
      .setTint(0xffffff);

    // Stats with labels
    const statsY = h / 2 + 30;

    this.timeLabelText = this.add.bitmapText(w / 2 - 35, statsY, FONT_KEYS.SMALL, 'TIME')
      .setOrigin(0, 0.5)
      .setDepth(9)
      .setTint(0x888888);

    this.timeText = this.add.bitmapText(w / 2 + 35, statsY, FONT_KEYS.MEDIUM, `${this.survivalTime.toFixed(1)}s`)
      .setOrigin(1, 0.5)
      .setDepth(9)
      .setTint(0x4dccff);

    this.scoreLabelText = this.add.bitmapText(w / 2 - 35, statsY + 20, FONT_KEYS.SMALL, 'SCORE')
      .setOrigin(0, 0.5)
      .setDepth(9)
      .setTint(0x888888);

    this.scoreText = this.add.bitmapText(w / 2 + 35, statsY + 20, FONT_KEYS.MEDIUM, this.score.toString())
      .setOrigin(1, 0.5)
      .setDepth(9)
      .setTint(0xffd94d);

    // Prompt
    this.promptText = this.add.bitmapText(w / 2, h / 2 + 85, FONT_KEYS.SMALL, 'TAP TO CONTINUE')
      .setOrigin(0.5)
      .setDepth(9)
      .setTint(0x666666);

    // Input handlers
    this.input.on('pointerdown', () => this.returnToLounge());
    this.input.keyboard?.on('keydown-SPACE', () => this.returnToLounge());
    this.input.keyboard?.on('keydown-ENTER', () => this.returnToLounge());

    // Emit state change
    this.registry.set('gameState', 'death');
    this.registry.events.emit('gameStateChanged', 'death');
  }

  initParticles() {
    const w = DeathScene.GAME_WIDTH;
    const h = DeathScene.GAME_HEIGHT;
    const particleColor = this.isPractice ? 0x66cc99 : 0xff6666;

    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 1 + Math.random() * 2,
        speed: 5 + Math.random() * 15,
        alpha: 0.1 + Math.random() * 0.3,
        color: particleColor,
      });
    }
  }

  returnToLounge() {
    getAudioSystem()?.play('click');
    this.scene.start('LoungeScene');
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.gameTime += dt;

    // Update particles
    this.updateParticles(dt);

    this.draw();
  }

  updateParticles(dt: number) {
    const w = DeathScene.GAME_WIDTH;
    const h = DeathScene.GAME_HEIGHT;

    for (const p of this.particles) {
      p.y -= p.speed * dt;
      p.x += Math.sin(this.gameTime + p.y * 0.05) * 0.3;

      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
    }
  }

  draw() {
    const w = DeathScene.GAME_WIDTH;
    const h = DeathScene.GAME_HEIGHT;

    this.graphics.clear();
    this.fxGraphics.clear();

    // === BACKGROUND ===

    // Gradient background
    for (let y = 0; y < h; y += 2) {
      const t = y / h;
      let r, g, b;
      if (this.isPractice) {
        r = Math.floor(5 + t * 10);
        g = Math.floor(20 + t * 15);
        b = Math.floor(15 + t * 10);
      } else {
        r = Math.floor(25 + t * 15);
        g = Math.floor(5 + t * 5);
        b = Math.floor(10 + t * 8);
      }
      const color = (r << 16) | (g << 8) | b;
      this.graphics.fillStyle(color, 1);
      this.graphics.fillRect(0, y, w, 2);
    }

    // === PARTICLES ===
    for (const p of this.particles) {
      this.graphics.fillStyle(p.color, p.alpha * 0.5);
      this.graphics.fillCircle(p.x, p.y, p.size + 1);
      this.graphics.fillStyle(0xffffff, p.alpha);
      this.graphics.fillCircle(p.x, p.y, p.size * 0.5);
    }

    // === VIGNETTE ===
    const pulse = 0.4 + Math.sin(this.gameTime * 2) * 0.15;
    const vignetteColor = this.isPractice ? 0x003322 : 0x330011;

    for (let i = 1; i <= 6; i++) {
      const size = i * 10;
      const alpha = pulse * (1 - i / 7) * 0.5;
      this.graphics.lineStyle(3, vignetteColor, alpha);
      this.graphics.strokeRect(size, size, w - size * 2, h - size * 2);
    }

    // === TITLE EFFECTS ===
    const titleY = h / 2 - 60;
    const titlePulse = 0.4 + Math.sin(this.gameTime * 3) * 0.2;
    const titleColor = this.isPractice ? 0x339966 : 0xff4d4d;

    // Outer glow pulse
    this.titleGlowOuter.setAlpha(titlePulse * 0.3);

    // Glow layers
    this.titleGlow1.setAlpha(titlePulse);
    this.titleGlow2.setAlpha(titlePulse);

    // Title background glow
    this.graphics.fillStyle(titleColor, titlePulse * 0.4);
    this.graphics.fillRoundedRect(w / 2 - 65, titleY - 12, 130, 26, 6);

    // Inner glow
    this.graphics.fillStyle(titleColor, titlePulse * 0.6);
    this.graphics.fillRoundedRect(w / 2 - 55, titleY - 8, 110, 18, 4);

    // === GHOST CHARACTER ===
    if (this.character) {
      const bob = Math.sin(this.gameTime * 2) * 3;
      const ghostY = h / 2 - 15;

      // Character shadow/glow
      this.graphics.fillStyle(this.isPractice ? 0x339966 : 0xff4d4d, 0.15);
      this.graphics.fillEllipse(w / 2, ghostY + 20, 25, 8);

      // Ghost with higher alpha
      this.graphics.setAlpha(0.5);
      this.character.draw(this.graphics, w / 2, ghostY + bob, 2, false);
      this.graphics.setAlpha(1);
    }

    // === STATS PANEL ===
    const statsY = h / 2 + 20;

    // Panel background
    this.graphics.fillStyle(0x000000, 0.6);
    this.graphics.fillRoundedRect(w / 2 - 50, statsY, 100, 48, 6);

    // Panel border
    const borderColor = this.isPractice ? 0x339966 : 0x994444;
    this.graphics.lineStyle(2, borderColor, 0.5);
    this.graphics.strokeRoundedRect(w / 2 - 50, statsY, 100, 48, 6);

    // Separator line
    this.graphics.lineStyle(1, 0x444444, 0.5);
    this.graphics.lineBetween(w / 2 - 40, statsY + 24, w / 2 + 40, statsY + 24);

    // === PROMPT ===
    const promptPulse = 0.4 + Math.sin(this.gameTime * 3) * 0.4;
    this.promptText.setAlpha(promptPulse);

    // Prompt background
    this.graphics.fillStyle(0x333333, promptPulse * 0.5);
    this.graphics.fillRoundedRect(w / 2 - 55, h / 2 + 78, 110, 16, 4);

    // === SCANLINES ===
    for (let y = 0; y < h; y += 4) {
      this.fxGraphics.fillStyle(0x000000, 0.06);
      this.fxGraphics.fillRect(0, y, w, 1);
    }
  }
}
