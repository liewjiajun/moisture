// DeathScene - Game over screen with dramatic visual effects

import Phaser from 'phaser';
import { Character } from '../entities/Character';
import { getAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  ColoredParticle,
  createColoredParticles,
  updateFloatingParticles,
  drawColoredParticles,
  drawScanlines,
  createGlowText,
  updateGlowTextPulse,
  sinePulse,
  GlowTextResult,
} from '../systems/VisualEffects';

export class DeathScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;

  private character: Character | null = null;
  private survivalTime = 0;
  private score = 0;
  private isPractice = false;
  private gameTime = 0;
  private particles: ColoredParticle[] = [];

  // Text objects
  private titleGlow!: GlowTextResult;
  private promptText!: Phaser.GameObjects.BitmapText;
  private staticTexts: Phaser.GameObjects.BitmapText[] = [];

  constructor() {
    super({ key: 'DeathScene' });
  }

  init(data: { survivalTime?: number; score?: number; isPractice?: boolean }): void {
    this.survivalTime = data.survivalTime ?? 0;
    this.score = data.score ?? 0;
    this.isPractice = data.isPractice ?? false;
    this.gameTime = 0;
  }

  create(): void {
    this.graphics = this.add.graphics().setDepth(0);
    this.fxGraphics = this.add.graphics().setDepth(10);

    // Initialize particles with appropriate color
    const particleColor = this.isPractice ? 0x66cc99 : 0xff6666;
    this.particles = createColoredParticles(20, { width: GAME_WIDTH, height: GAME_HEIGHT }, particleColor, {
      sizeRange: [1, 3],
      speedRange: [5, 20],
      alphaRange: [0.1, 0.4],
    });

    // Get character
    const characterSeed = this.registry.get('characterSeed') || Date.now();
    this.character = new Character(characterSeed);

    this.createTextElements();
    this.setupInput();

    this.registry.set('gameState', 'death');
    this.registry.events.emit('gameStateChanged', 'death');
  }

  private createTextElements(): void {
    const titleLabel = this.isPractice ? 'PRACTICE' : 'EVAPORATED';
    const titleTint = this.isPractice ? 0x66cc99 : 0xff6666;
    const chromeColor = this.isPractice ? 0x00ffff : 0xff00ff;
    const titleY = GAME_HEIGHT / 2 - 60;

    // Title with glow and chromatic aberration
    this.titleGlow = createGlowText({
      scene: this,
      x: GAME_WIDTH / 2,
      y: titleY,
      fontKey: FONT_KEYS.LARGE,
      text: titleLabel,
      glowColor: titleTint,
      chromeColor,
      depth: 9,
    });

    // Stats with labels
    const statsY = GAME_HEIGHT / 2 + 30;

    this.staticTexts.push(
      this.add.bitmapText(GAME_WIDTH / 2 - 35, statsY, FONT_KEYS.SMALL, 'TIME')
        .setOrigin(0, 0.5)
        .setDepth(9)
        .setTint(0x888888),
      this.add.bitmapText(GAME_WIDTH / 2 + 35, statsY, FONT_KEYS.MEDIUM, `${this.survivalTime.toFixed(1)}s`)
        .setOrigin(1, 0.5)
        .setDepth(9)
        .setTint(0x4dccff),
      this.add.bitmapText(GAME_WIDTH / 2 - 35, statsY + 20, FONT_KEYS.SMALL, 'SCORE')
        .setOrigin(0, 0.5)
        .setDepth(9)
        .setTint(0x888888),
      this.add.bitmapText(GAME_WIDTH / 2 + 35, statsY + 20, FONT_KEYS.MEDIUM, this.score.toString())
        .setOrigin(1, 0.5)
        .setDepth(9)
        .setTint(0xffd94d)
    );

    // Prompt
    this.promptText = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 85, FONT_KEYS.SMALL, 'TAP TO CONTINUE')
      .setOrigin(0.5)
      .setDepth(9)
      .setTint(0x666666);
  }

  private setupInput(): void {
    this.input.on('pointerdown', () => this.returnToLounge());
    this.input.keyboard?.on('keydown-SPACE', () => this.returnToLounge());
    this.input.keyboard?.on('keydown-ENTER', () => this.returnToLounge());
  }

  private returnToLounge(): void {
    getAudioSystem()?.play('click');
    this.scene.start('LoungeScene');
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.gameTime += dt;

    updateFloatingParticles(this.particles, dt, this.gameTime, { width: GAME_WIDTH, height: GAME_HEIGHT });
    this.draw();
  }

  private draw(): void {
    this.graphics.clear();
    this.fxGraphics.clear();

    this.drawBackground();
    drawColoredParticles(this.graphics, this.particles);
    this.drawVignetteBorder();
    this.drawTitle();
    this.drawGhostCharacter();
    this.drawStatsPanel();
    this.drawPrompt();
    drawScanlines(this.fxGraphics, GAME_WIDTH, GAME_HEIGHT, 4, 0.06);
  }

  private drawBackground(): void {
    // Gradient background based on mode
    for (let y = 0; y < GAME_HEIGHT; y += 2) {
      const t = y / GAME_HEIGHT;
      let r: number, g: number, b: number;
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
      this.graphics.fillRect(0, y, GAME_WIDTH, 2);
    }
  }

  private drawVignetteBorder(): void {
    const pulse = sinePulse(this.gameTime, 2, 0.15, 0.4);
    const vignetteColor = this.isPractice ? 0x003322 : 0x330011;

    for (let i = 1; i <= 6; i++) {
      const size = i * 10;
      const alpha = pulse * (1 - i / 7) * 0.5;
      this.graphics.lineStyle(3, vignetteColor, alpha);
      this.graphics.strokeRect(size, size, GAME_WIDTH - size * 2, GAME_HEIGHT - size * 2);
    }
  }

  private drawTitle(): void {
    const titleY = GAME_HEIGHT / 2 - 60;
    const titlePulse = sinePulse(this.gameTime, 3, 0.2, 0.4);
    const titleColor = this.isPractice ? 0x339966 : 0xff4d4d;

    updateGlowTextPulse(this.titleGlow, titlePulse, titlePulse);

    // Title background glow
    this.graphics.fillStyle(titleColor, titlePulse * 0.4);
    this.graphics.fillRoundedRect(GAME_WIDTH / 2 - 65, titleY - 12, 130, 26, 6);

    // Inner glow
    this.graphics.fillStyle(titleColor, titlePulse * 0.6);
    this.graphics.fillRoundedRect(GAME_WIDTH / 2 - 55, titleY - 8, 110, 18, 4);
  }

  private drawGhostCharacter(): void {
    if (!this.character) return;

    const bob = Math.sin(this.gameTime * 2) * 3;
    const ghostY = GAME_HEIGHT / 2 - 15;
    const shadowColor = this.isPractice ? 0x339966 : 0xff4d4d;

    // Character shadow/glow
    this.graphics.fillStyle(shadowColor, 0.15);
    this.graphics.fillEllipse(GAME_WIDTH / 2, ghostY + 20, 25, 8);

    // Ghost with reduced alpha
    this.graphics.setAlpha(0.5);
    this.character.draw(this.graphics, GAME_WIDTH / 2, ghostY + bob, 2, false);
    this.graphics.setAlpha(1);
  }

  private drawStatsPanel(): void {
    const statsY = GAME_HEIGHT / 2 + 20;
    const borderColor = this.isPractice ? 0x339966 : 0x994444;

    // Panel background
    this.graphics.fillStyle(0x000000, 0.6);
    this.graphics.fillRoundedRect(GAME_WIDTH / 2 - 50, statsY, 100, 48, 6);

    // Panel border
    this.graphics.lineStyle(2, borderColor, 0.5);
    this.graphics.strokeRoundedRect(GAME_WIDTH / 2 - 50, statsY, 100, 48, 6);

    // Separator line
    this.graphics.lineStyle(1, 0x444444, 0.5);
    this.graphics.lineBetween(GAME_WIDTH / 2 - 40, statsY + 24, GAME_WIDTH / 2 + 40, statsY + 24);
  }

  private drawPrompt(): void {
    const promptPulse = sinePulse(this.gameTime, 3, 0.4, 0.4);
    this.promptText.setAlpha(promptPulse);

    // Prompt background
    this.graphics.fillStyle(0x333333, promptPulse * 0.5);
    this.graphics.fillRoundedRect(GAME_WIDTH / 2 - 55, GAME_HEIGHT / 2 + 78, 110, 16, 4);
  }

  shutdown(): void {
    this.staticTexts.forEach(text => text.destroy());
    this.staticTexts = [];
  }
}
