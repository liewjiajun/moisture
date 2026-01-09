// CountdownScene - 3...2...1...GO! with dramatic synthwave countdown visuals

import Phaser from 'phaser';
import { getAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  Colors,
  drawScanlines,
  drawVignette,
  createGlowText,
  updateGlowTextPulse,
  setGlowTextContent,
  setGlowTextTint,
  sinePulse,
  GlowTextResult,
} from '../systems/VisualEffects';

interface ExpandRing {
  radius: number;
  alpha: number;
  speed: number;
  color: number;
}

interface StarParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

export class CountdownScene extends Phaser.Scene {
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private graphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;

  private countdownTimer = 3.5;
  private isPractice = false;
  private gameTime = 0;
  private lastNum = 4;
  private playedSounds = new Set<number>();
  private rings: ExpandRing[] = [];
  private stars: StarParticle[] = [];
  private flashAlpha = 0;

  // Text objects
  private countdownGlow!: GlowTextResult;
  private practiceGlow!: GlowTextResult;

  constructor() {
    super({ key: 'CountdownScene' });
  }

  init(data: { isPractice?: boolean }): void {
    this.isPractice = data.isPractice ?? false;
    this.countdownTimer = 3.0;
    this.gameTime = 0;
    this.lastNum = 4;
    this.playedSounds = new Set();
    this.rings = [];
    this.stars = [];
    this.flashAlpha = 0;
  }

  create(): void {
    this.bgGraphics = this.add.graphics().setDepth(0);
    this.graphics = this.add.graphics().setDepth(5);
    this.fxGraphics = this.add.graphics().setDepth(15);

    this.initStars();

    // Countdown text with chromatic aberration
    this.countdownGlow = createGlowText({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      fontKey: FONT_KEYS.LARGE,
      text: '3',
      glowColor: Colors.CYAN,
      chromeColor: Colors.MAGENTA,
      glowOffset: 2,
      depth: 10,
    });

    // Practice mode indicator
    this.practiceGlow = createGlowText({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2 + 50,
      fontKey: FONT_KEYS.SMALL,
      text: 'PRACTICE MODE',
      glowColor: 0x66ff66,
      depth: 10,
    });
    this.practiceGlow.main.setTint(0x99ff99);
    this.practiceGlow.main.setVisible(this.isPractice);
    this.practiceGlow.glow1.setVisible(this.isPractice);
    this.practiceGlow.glow2.setVisible(this.isPractice);

    // Initial ring for "3"
    this.spawnRing(Colors.CYAN);

    this.registry.set('gameState', 'countdown');
    this.registry.events.emit('gameStateChanged', 'countdown');
  }

  private initStars(): void {
    for (let i = 0; i < 30; i++) {
      this.stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: 0.5 + Math.random() * 1.5,
        speed: 20 + Math.random() * 40,
        alpha: 0.2 + Math.random() * 0.5,
      });
    }
  }

  private spawnRing(color: number): void {
    for (let i = 0; i < 3; i++) {
      this.rings.push({
        radius: 20 + i * 10,
        alpha: 0.8 - i * 0.2,
        speed: 80 + i * 20,
        color,
      });
    }
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.gameTime += dt;
    this.countdownTimer -= dt;

    const audio = getAudioSystem();
    const num = Math.ceil(this.countdownTimer);

    // Spawn rings on number change
    if (num !== this.lastNum && num >= 0 && num <= 3) {
      this.lastNum = num;
      if (num > 0) {
        this.spawnRing(Colors.CYAN);
      }
    }

    // Play countdown sounds
    if (num >= 1 && num <= 3 && !this.playedSounds.has(num)) {
      this.playedSounds.add(num);
      const pitchMap: Record<number, number> = { 3: 0.8, 2: 1.0, 1: 1.2 };
      audio?.playWithPitch('countdown', pitchMap[num] || 1.0);
    }

    // Play GO sound and trigger flash
    if (this.countdownTimer <= 0.5 && !this.playedSounds.has(0)) {
      this.playedSounds.add(0);
      audio?.play('go');
      this.flashAlpha = 1.0;
      this.spawnRing(0x00ff80);
    }

    // Update flash
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3);
    }

    this.updateRings(dt);
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

  private updateRings(dt: number): void {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.radius += ring.speed * dt;
      ring.alpha -= dt * 0.8;

      if (ring.alpha <= 0) {
        this.rings.splice(i, 1);
      }
    }
  }

  private updateStars(dt: number): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    for (const star of this.stars) {
      // Stars move toward center (zoom effect)
      const dx = star.x - centerX;
      const dy = star.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        star.x += (dx / dist) * star.speed * dt * 0.3;
        star.y += (dy / dist) * star.speed * dt * 0.3;
      }

      // Respawn when too far from center
      if (star.x < -10 || star.x > GAME_WIDTH + 10 || star.y < -10 || star.y > GAME_HEIGHT + 10) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 30;
        star.x = centerX + Math.cos(angle) * radius;
        star.y = centerY + Math.sin(angle) * radius;
      }
    }
  }

  private draw(): void {
    this.bgGraphics.clear();
    this.graphics.clear();
    this.fxGraphics.clear();

    this.drawBackground();
    this.drawStars();
    this.drawRings();
    this.drawCountdownNumber();
    this.drawPracticeIndicator();
    this.drawCornerAccents();
    drawScanlines(this.fxGraphics, GAME_WIDTH, GAME_HEIGHT, 4, 0.08);
    this.drawFlash();
    drawVignette(this.fxGraphics, GAME_WIDTH, GAME_HEIGHT, 4, 12, 0.2);
  }

  private drawBackground(): void {
    for (let y = 0; y < GAME_HEIGHT; y += 2) {
      const t = Math.abs(y - GAME_HEIGHT / 2) / (GAME_HEIGHT / 2);
      const r = Math.floor(5 + t * 10);
      const g = Math.floor(2 + t * 5);
      const b = Math.floor(15 + t * 10);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, GAME_WIDTH, 2);
    }
  }

  private drawStars(): void {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    for (const star of this.stars) {
      const dx = star.x - centerX;
      const dy = star.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        const streakLen = star.speed * 0.05;
        const endX = star.x + (dx / dist) * streakLen;
        const endY = star.y + (dy / dist) * streakLen;

        this.bgGraphics.lineStyle(star.size, 0xffffff, star.alpha * 0.5);
        this.bgGraphics.lineBetween(star.x, star.y, endX, endY);
      }

      this.bgGraphics.fillStyle(0xffffff, star.alpha);
      this.bgGraphics.fillCircle(star.x, star.y, star.size * 0.5);
    }
  }

  private drawRings(): void {
    for (const ring of this.rings) {
      this.graphics.lineStyle(3, ring.color, ring.alpha * 0.6);
      this.graphics.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, ring.radius);

      this.graphics.lineStyle(1, 0xffffff, ring.alpha * 0.4);
      this.graphics.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, ring.radius * 0.9);
    }
  }

  private drawCountdownNumber(): void {
    const num = Math.ceil(this.countdownTimer);
    const isGo = num <= 0;
    const textContent = isGo ? 'GO!' : num.toString();

    // Color scheme
    const mainColor = isGo ? 0x00ff80 : Colors.CYAN;
    const glowColor = isGo ? 0x00ff80 : Colors.CYAN;
    const chromeColor = Colors.MAGENTA;

    // Update text content and colors
    setGlowTextContent(this.countdownGlow, textContent);
    setGlowTextTint(this.countdownGlow, 0xffffff, glowColor, chromeColor);

    // Pulsing effect
    const pulse = sinePulse(this.gameTime, 6, 0.3, 0.7);
    const beat = Math.max(0, Math.sin((this.countdownTimer % 1) * Math.PI));

    // Update glow alphas
    updateGlowTextPulse(this.countdownGlow, pulse, beat);

    // Center glow circle
    this.graphics.fillStyle(mainColor, 0.15 * pulse);
    this.graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 60);

    // Pulsing ring around number
    const ringPulse = 35 + beat * 15;
    this.graphics.lineStyle(4, mainColor, 0.5 * pulse);
    this.graphics.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, ringPulse);

    // Inner glow
    this.graphics.fillStyle(mainColor, 0.3 * pulse);
    this.graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 25);

    // Core circle (dark)
    this.graphics.fillStyle(0x000000, 0.85);
    this.graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 20);
  }

  private drawPracticeIndicator(): void {
    if (!this.isPractice) return;

    const practicePulse = sinePulse(this.gameTime, 2, 0.3, 0.6);
    updateGlowTextPulse(this.practiceGlow, practicePulse);
    this.practiceGlow.main.setAlpha(practicePulse);

    // Background for practice text
    this.graphics.fillStyle(0x339933, 0.6 * practicePulse);
    this.graphics.fillRoundedRect(GAME_WIDTH / 2 - 50, GAME_HEIGHT / 2 + 40, 100, 20, 4);

    this.graphics.lineStyle(1, 0x66ff66, 0.5 * practicePulse);
    this.graphics.strokeRoundedRect(GAME_WIDTH / 2 - 50, GAME_HEIGHT / 2 + 40, 100, 20, 4);
  }

  private drawCornerAccents(): void {
    const num = Math.ceil(this.countdownTimer);
    const isGo = num <= 0;
    const accentColor = isGo ? 0x00ff80 : Colors.CYAN;
    const beat = Math.max(0, Math.sin((this.countdownTimer % 1) * Math.PI));
    const accentAlpha = 0.3 + beat * 0.2;

    this.fxGraphics.lineStyle(2, accentColor, accentAlpha);

    // Top left
    this.fxGraphics.lineBetween(10, 20, 10, 40);
    this.fxGraphics.lineBetween(10, 20, 30, 20);

    // Top right
    this.fxGraphics.lineBetween(GAME_WIDTH - 10, 20, GAME_WIDTH - 10, 40);
    this.fxGraphics.lineBetween(GAME_WIDTH - 10, 20, GAME_WIDTH - 30, 20);

    // Bottom left
    this.fxGraphics.lineBetween(10, GAME_HEIGHT - 20, 10, GAME_HEIGHT - 40);
    this.fxGraphics.lineBetween(10, GAME_HEIGHT - 20, 30, GAME_HEIGHT - 20);

    // Bottom right
    this.fxGraphics.lineBetween(GAME_WIDTH - 10, GAME_HEIGHT - 20, GAME_WIDTH - 10, GAME_HEIGHT - 40);
    this.fxGraphics.lineBetween(GAME_WIDTH - 10, GAME_HEIGHT - 20, GAME_WIDTH - 30, GAME_HEIGHT - 20);
  }

  private drawFlash(): void {
    if (this.flashAlpha > 0) {
      this.fxGraphics.fillStyle(0xffffff, this.flashAlpha * 0.6);
      this.fxGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  }

  shutdown(): void {
    this.bgGraphics?.destroy();
    this.graphics?.destroy();
    this.fxGraphics?.destroy();
    this.countdownGlow?.main?.destroy();
    this.countdownGlow?.glow1?.destroy();
    this.countdownGlow?.glow2?.destroy();
    this.countdownGlow?.chrome?.destroy();
    this.practiceGlow?.main?.destroy();
    this.practiceGlow?.glow1?.destroy();
    this.practiceGlow?.glow2?.destroy();
  }
}
