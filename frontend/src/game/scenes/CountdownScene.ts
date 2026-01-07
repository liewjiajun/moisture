// CountdownScene - 3...2...1...GO! before game
// Enhanced with dramatic synthwave countdown visuals

import Phaser from 'phaser';
import { getAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';

// Expanding ring for dramatic effect
interface ExpandRing {
  radius: number;
  alpha: number;
  speed: number;
  color: number;
}

// Star particle for atmosphere
interface StarParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

export class CountdownScene extends Phaser.Scene {
  static readonly GAME_WIDTH = 180;
  static readonly GAME_HEIGHT = 320;

  // Graphics layers
  bgGraphics!: Phaser.GameObjects.Graphics;
  graphics!: Phaser.GameObjects.Graphics;
  fxGraphics!: Phaser.GameObjects.Graphics;

  countdownTimer: number = 3.5;
  isPractice: boolean = false;
  gameTime: number = 0;
  lastNum: number = 4; // Track number changes for ring spawns

  // Track which sounds have been played
  playedSounds: Set<number> = new Set();

  // Expanding rings (spawn on each number)
  rings: ExpandRing[] = [];

  // Background stars
  stars: StarParticle[] = [];

  // Flash effect on GO
  flashAlpha: number = 0;

  // Text objects (BitmapText for pixel-perfect rendering)
  countdownText!: Phaser.GameObjects.BitmapText;
  countdownGlow1!: Phaser.GameObjects.BitmapText;
  countdownGlow2!: Phaser.GameObjects.BitmapText;
  countdownGlowOuter!: Phaser.GameObjects.BitmapText;
  practiceText!: Phaser.GameObjects.BitmapText;
  practiceGlow!: Phaser.GameObjects.BitmapText;

  constructor() {
    super({ key: 'CountdownScene' });
  }

  init(data: { isPractice?: boolean }) {
    this.isPractice = data.isPractice ?? false;
    this.countdownTimer = 3.0; // Start at 3.0 so Math.ceil shows 3
    this.gameTime = 0;
    this.lastNum = 4;
    this.playedSounds = new Set(); // Reset for each countdown
    this.rings = [];
    this.stars = [];
    this.flashAlpha = 0;
  }

  create() {
    const w = CountdownScene.GAME_WIDTH;
    const h = CountdownScene.GAME_HEIGHT;

    // Create layered graphics
    this.bgGraphics = this.add.graphics().setDepth(0);
    this.graphics = this.add.graphics().setDepth(5);
    this.fxGraphics = this.add.graphics().setDepth(15);

    // Initialize stars
    this.initStars();

    // Create chromatic aberration outer glow
    this.countdownGlowOuter = this.add.bitmapText(w / 2, h / 2, FONT_KEYS.LARGE, '3')
      .setOrigin(0.5)
      .setDepth(7)
      .setAlpha(0.2)
      .setTint(0xff00ff);

    // Create glow layers (behind main text)
    this.countdownGlow1 = this.add.bitmapText(w / 2 - 2, h / 2 - 2, FONT_KEYS.LARGE, '3')
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(0x00ffff);

    this.countdownGlow2 = this.add.bitmapText(w / 2 + 2, h / 2 + 2, FONT_KEYS.LARGE, '3')
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(0x00ffff);

    // Create countdown text (large centered number)
    this.countdownText = this.add.bitmapText(w / 2, h / 2, FONT_KEYS.LARGE, '3')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0xffffff);

    // Create practice mode indicator with glow
    this.practiceGlow = this.add.bitmapText(w / 2, h / 2 + 50, FONT_KEYS.SMALL, 'PRACTICE MODE')
      .setOrigin(0.5)
      .setDepth(9)
      .setAlpha(0.5)
      .setTint(0x66ff66);

    this.practiceText = this.add.bitmapText(w / 2, h / 2 + 50, FONT_KEYS.SMALL, 'PRACTICE MODE')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0x99ff99);

    this.practiceText.setVisible(this.isPractice);
    this.practiceGlow.setVisible(this.isPractice);

    // Spawn initial ring for "3"
    this.spawnRing(0x00ffff);

    // Emit state change (use registry.events for game-wide events)
    this.registry.set('gameState', 'countdown');
    this.registry.events.emit('gameStateChanged', 'countdown');
  }

  initStars() {
    const w = CountdownScene.GAME_WIDTH;
    const h = CountdownScene.GAME_HEIGHT;

    for (let i = 0; i < 30; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.5 + Math.random() * 1.5,
        speed: 20 + Math.random() * 40,
        alpha: 0.2 + Math.random() * 0.5,
      });
    }
  }

  spawnRing(color: number) {
    // Spawn multiple rings for dramatic effect
    for (let i = 0; i < 3; i++) {
      this.rings.push({
        radius: 20 + i * 10,
        alpha: 0.8 - i * 0.2,
        speed: 80 + i * 20,
        color: color,
      });
    }
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.gameTime += dt;
    this.countdownTimer -= dt;

    // Play countdown sounds (3, 2, 1) with pitch variation
    const audio = getAudioSystem();
    const num = Math.ceil(this.countdownTimer);

    // Spawn rings on number change
    if (num !== this.lastNum && num >= 0 && num <= 3) {
      this.lastNum = num;
      if (num > 0) {
        this.spawnRing(0x00ffff);
      }
    }

    if (num >= 1 && num <= 3 && !this.playedSounds.has(num)) {
      this.playedSounds.add(num);
      // Different pitch for each number: 3=low, 2=normal, 1=high
      const pitchMap: Record<number, number> = { 3: 0.8, 2: 1.0, 1: 1.2 };
      audio?.playWithPitch('countdown', pitchMap[num] || 1.0);
    }

    // Play GO sound and trigger flash
    if (this.countdownTimer <= 0.5 && !this.playedSounds.has(0)) {
      this.playedSounds.add(0);
      audio?.play('go');
      this.flashAlpha = 1.0;
      this.spawnRing(0x00ff80); // Green rings for GO
    }

    // Update flash
    if (this.flashAlpha > 0) {
      this.flashAlpha -= dt * 3;
      if (this.flashAlpha < 0) this.flashAlpha = 0;
    }

    // Update rings
    this.updateRings(dt);

    // Update stars
    this.updateStars(dt);

    if (this.countdownTimer <= 0) {
      this.scene.start('GameScene', {
        isPractice: this.isPractice,
        characterSeed: this.registry.get('characterSeed'),
      });
      return;
    }

    this.draw();
  }

  updateRings(dt: number) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.radius += ring.speed * dt;
      ring.alpha -= dt * 0.8;

      if (ring.alpha <= 0) {
        this.rings.splice(i, 1);
      }
    }
  }

  updateStars(dt: number) {
    const w = CountdownScene.GAME_WIDTH;
    const h = CountdownScene.GAME_HEIGHT;

    for (const star of this.stars) {
      // Stars move toward center (zoom effect)
      const dx = star.x - w / 2;
      const dy = star.y - h / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        star.x += (dx / dist) * star.speed * dt * 0.3;
        star.y += (dy / dist) * star.speed * dt * 0.3;
      }

      // Respawn when too far from center
      if (star.x < -10 || star.x > w + 10 || star.y < -10 || star.y > h + 10) {
        // Respawn near center
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 30;
        star.x = w / 2 + Math.cos(angle) * radius;
        star.y = h / 2 + Math.sin(angle) * radius;
      }
    }
  }

  draw() {
    const w = CountdownScene.GAME_WIDTH;
    const h = CountdownScene.GAME_HEIGHT;

    this.bgGraphics.clear();
    this.graphics.clear();
    this.fxGraphics.clear();

    // === BACKGROUND ===

    // Deep space gradient
    for (let y = 0; y < h; y += 2) {
      const t = Math.abs(y - h / 2) / (h / 2);
      const r = Math.floor(5 + t * 10);
      const g = Math.floor(2 + t * 5);
      const b = Math.floor(15 + t * 10);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, w, 2);
    }

    // Draw stars (streaming outward effect)
    for (const star of this.stars) {
      // Draw streak
      const dx = star.x - w / 2;
      const dy = star.y - h / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const streakLen = star.speed * 0.05;
        const endX = star.x + (dx / dist) * streakLen;
        const endY = star.y + (dy / dist) * streakLen;

        this.bgGraphics.lineStyle(star.size, 0xffffff, star.alpha * 0.5);
        this.bgGraphics.lineBetween(star.x, star.y, endX, endY);
      }

      // Star core
      this.bgGraphics.fillStyle(0xffffff, star.alpha);
      this.bgGraphics.fillCircle(star.x, star.y, star.size * 0.5);
    }

    // === EXPANDING RINGS ===
    for (const ring of this.rings) {
      this.graphics.lineStyle(3, ring.color, ring.alpha * 0.6);
      this.graphics.strokeCircle(w / 2, h / 2, ring.radius);

      // Inner ring (thinner)
      this.graphics.lineStyle(1, 0xffffff, ring.alpha * 0.4);
      this.graphics.strokeCircle(w / 2, h / 2, ring.radius * 0.9);
    }

    // === COUNTDOWN NUMBER ===
    const num = Math.ceil(this.countdownTimer);
    const isGo = num <= 0;

    // Color scheme
    const mainColor = isGo ? 0x00ff80 : 0x00ffff;
    const glowColor = isGo ? 0x00ff80 : 0x00ffff;
    const chromeColor = isGo ? 0xff00ff : 0xff00ff;

    // Pulsing effect
    const pulse = 0.7 + Math.sin(this.gameTime * 6) * 0.3;
    const beat = Math.max(0, Math.sin((this.countdownTimer % 1) * Math.PI));

    // Update text content
    const textContent = isGo ? 'GO!' : num.toString();
    this.countdownText.setText(textContent);
    this.countdownGlow1.setText(textContent);
    this.countdownGlow2.setText(textContent);
    this.countdownGlowOuter.setText(textContent);

    // Update tints
    this.countdownText.setTint(0xffffff);
    this.countdownGlow1.setTint(glowColor);
    this.countdownGlow2.setTint(glowColor);
    this.countdownGlowOuter.setTint(chromeColor);

    // Pulse the glows
    this.countdownGlow1.setAlpha(0.4 * pulse);
    this.countdownGlow2.setAlpha(0.4 * pulse);
    this.countdownGlowOuter.setAlpha(0.2 + beat * 0.2);

    // Center glow circle (large, soft)
    this.graphics.fillStyle(mainColor, 0.15 * pulse);
    this.graphics.fillCircle(w / 2, h / 2, 60);

    // Pulsing ring around number
    const ringPulse = 35 + beat * 15;
    this.graphics.lineStyle(4, mainColor, 0.5 * pulse);
    this.graphics.strokeCircle(w / 2, h / 2, ringPulse);

    // Inner glow
    this.graphics.fillStyle(mainColor, 0.3 * pulse);
    this.graphics.fillCircle(w / 2, h / 2, 25);

    // Core circle (dark)
    this.graphics.fillStyle(0x000000, 0.85);
    this.graphics.fillCircle(w / 2, h / 2, 20);

    // Practice mode indicator
    if (this.isPractice) {
      const practicePulse = 0.6 + Math.sin(this.gameTime * 2) * 0.3;
      this.practiceGlow.setAlpha(0.5 * practicePulse);
      this.practiceText.setAlpha(practicePulse);

      // Background for practice text
      this.graphics.fillStyle(0x339933, 0.6 * practicePulse);
      this.graphics.fillRoundedRect(w / 2 - 50, h / 2 + 40, 100, 20, 4);

      // Border
      this.graphics.lineStyle(1, 0x66ff66, 0.5 * practicePulse);
      this.graphics.strokeRoundedRect(w / 2 - 50, h / 2 + 40, 100, 20, 4);
    }

    // === EFFECTS ===

    // Corner accents
    const accentColor = isGo ? 0x00ff80 : 0x00ffff;
    const accentAlpha = 0.3 + beat * 0.2;

    // Top left
    this.fxGraphics.lineStyle(2, accentColor, accentAlpha);
    this.fxGraphics.lineBetween(10, 20, 10, 40);
    this.fxGraphics.lineBetween(10, 20, 30, 20);

    // Top right
    this.fxGraphics.lineBetween(w - 10, 20, w - 10, 40);
    this.fxGraphics.lineBetween(w - 10, 20, w - 30, 20);

    // Bottom left
    this.fxGraphics.lineBetween(10, h - 20, 10, h - 40);
    this.fxGraphics.lineBetween(10, h - 20, 30, h - 20);

    // Bottom right
    this.fxGraphics.lineBetween(w - 10, h - 20, w - 10, h - 40);
    this.fxGraphics.lineBetween(w - 10, h - 20, w - 30, h - 20);

    // Scanlines
    for (let y = 0; y < h; y += 4) {
      this.fxGraphics.fillStyle(0x000000, 0.08);
      this.fxGraphics.fillRect(0, y, w, 1);
    }

    // Flash effect (on GO)
    if (this.flashAlpha > 0) {
      this.fxGraphics.fillStyle(0xffffff, this.flashAlpha * 0.6);
      this.fxGraphics.fillRect(0, 0, w, h);
    }

    // Vignette
    for (let i = 1; i <= 4; i++) {
      const size = i * 12;
      const alpha = 0.2 * (1 - i / 5);
      this.fxGraphics.fillStyle(0x000000, alpha);
      this.fxGraphics.fillTriangle(0, 0, size, 0, 0, size);
      this.fxGraphics.fillTriangle(w, 0, w - size, 0, w, size);
      this.fxGraphics.fillTriangle(0, h, size, h, 0, h - size);
      this.fxGraphics.fillTriangle(w, h, w - size, h, w, h - size);
    }
  }

  // Clean up when scene shuts down
  shutdown() {
    this.bgGraphics?.destroy();
    this.graphics?.destroy();
    this.fxGraphics?.destroy();
    this.countdownText?.destroy();
    this.countdownGlow1?.destroy();
    this.countdownGlow2?.destroy();
    this.countdownGlowOuter?.destroy();
    this.practiceText?.destroy();
    this.practiceGlow?.destroy();
  }
}
