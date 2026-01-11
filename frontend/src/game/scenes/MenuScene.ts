// MenuScene - Title screen with synthwave/vaporwave moisture aesthetic

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
  updateRisingParticles,
  drawGlowingParticles,
  drawScanlines,
  drawVignette,
  drawEdgeFade,
  createGlowText,
  updateGlowTextPulse,
  sinePulse,
  GlowTextResult,
} from '../systems/VisualEffects';

export class MenuScene extends Phaser.Scene {
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private graphics!: Phaser.GameObjects.Graphics;
  private fxGraphics!: Phaser.GameObjects.Graphics;

  private character: Character | null = null;
  private gameTime = 0;
  private particles: WobblyParticle[] = [];
  private isButtonHovered = false;

  // Text objects
  private titleGlow!: GlowTextResult;
  private titleGlowMagenta!: Phaser.GameObjects.BitmapText;
  private titleGlowCyan!: Phaser.GameObjects.BitmapText;
  private subtitleText!: Phaser.GameObjects.BitmapText;
  private guestButtonText!: Phaser.GameObjects.BitmapText;
  private guestHintText!: Phaser.GameObjects.BitmapText;
  private walletHintText!: Phaser.GameObjects.BitmapText;
  private helpText!: Phaser.GameObjects.BitmapText;
  private footerText!: Phaser.GameObjects.BitmapText;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    // Create layered graphics for depth
    this.bgGraphics = this.add.graphics().setDepth(0);
    this.graphics = this.add.graphics().setDepth(5);
    this.fxGraphics = this.add.graphics().setDepth(15);

    // Initialize moisture particles
    this.particles = createWobblyParticles(25, { width: GAME_WIDTH, height: GAME_HEIGHT }, {
      sizeRange: [1, 3],
      speedRange: [8, 20],
      alphaRange: [0.1, 0.4],
      wobbleSpeedRange: [1, 3],
    });

    this.createTextElements();
    this.createCharacter();
    this.setupInput();

    this.registry.set('gameState', 'menu');
    this.registry.events.emit('gameStateChanged', 'menu');
  }

  private createTextElements(): void {
    const titleY = GAME_HEIGHT * 0.25 + 10;

    // Chromatic aberration layers (magenta left, cyan right)
    this.titleGlowMagenta = this.add.bitmapText(GAME_WIDTH / 2 - 2, titleY, FONT_KEYS.LARGE, 'MOISTURE')
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(Colors.MAGENTA);

    this.titleGlowCyan = this.add.bitmapText(GAME_WIDTH / 2 + 2, titleY, FONT_KEYS.LARGE, 'MOISTURE')
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.4)
      .setTint(Colors.CYAN);

    // Standard glow layers
    this.titleGlow = createGlowText({
      scene: this,
      x: GAME_WIDTH / 2,
      y: titleY,
      fontKey: FONT_KEYS.LARGE,
      text: 'MOISTURE',
      glowColor: Colors.CYAN,
      depth: 10,
    });

    // Subtitle
    this.subtitleText = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT * 0.25 + 34, FONT_KEYS.SMALL, 'DODGE. UPGRADE. SURVIVE.')
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0.7)
      .setTint(Colors.CYAN);

    // Guest button
    this.guestButtonText = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT * 0.72 + 12, FONT_KEYS.SMALL, 'PLAY AS GUEST')
      .setOrigin(0.5)
      .setDepth(11)
      .setTint(0xffffff);

    // Guest mode hint (practice only)
    this.guestHintText = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT * 0.72 + 30, FONT_KEYS.SMALL, 'PRACTICE ONLY')
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0.5)
      .setTint(0xffaa66);

    // Wallet connect hint
    this.walletHintText = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT * 0.82, FONT_KEYS.SMALL, 'CONNECT WALLET TO COMPETE')
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0.4)
      .setTint(Colors.GOLD);

    // Help text (top right)
    this.helpText = this.add.bitmapText(GAME_WIDTH - 10, 10, FONT_KEYS.SMALL, '?')
      .setOrigin(1, 0)
      .setDepth(11)
      .setTint(0x888888);

    // Footer
    this.footerText = this.add.bitmapText(GAME_WIDTH / 2, GAME_HEIGHT - 15, FONT_KEYS.SMALL, 'WIN SUI PRIZES!')
      .setOrigin(0.5)
      .setDepth(10)
      .setTint(0x666666);
  }

  private createCharacter(): void {
    let characterSeed = this.registry.get('characterSeed');
    if (!characterSeed) {
      characterSeed = Date.now() + Math.floor(Math.random() * 999999);
      this.registry.set('characterSeed', characterSeed);
    }
    this.character = new Character(characterSeed);
  }

  private setupInput(): void {
    const btnW = 100;
    const btnH = 24;
    const btnX = (GAME_WIDTH - btnW) / 2;
    const guestY = GAME_HEIGHT * 0.72;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isInBounds(pointer.x, pointer.y, btnX, guestY, btnW, btnH)) {
        this.enterAsGuest();
        return;
      }

      // Help button click (top right)
      if (this.isInBounds(pointer.x, pointer.y, GAME_WIDTH - 25, 5, 20, 20)) {
        this.showHelp();
        return;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.isButtonHovered = this.isInBounds(pointer.x, pointer.y, btnX, guestY, btnW, btnH);
    });

    this.input.keyboard?.on('keydown-SPACE', () => this.enterAsGuest());
    this.input.keyboard?.on('keydown-ENTER', () => this.enterAsGuest());
    this.input.keyboard?.on('keydown-H', () => this.showHelp());
  }

  private showHelp(): void {
    getAudioSystem()?.play('click');
    // For now, just show a quick tip by pulsing the subtitle
    // In the future, this could open a modal
    this.subtitleText.setText('AVOID BULLETS!');
    this.time.delayedCall(2000, () => {
      this.subtitleText.setText('DODGE. UPGRADE. SURVIVE.');
    });
  }

  private isInBounds(x: number, y: number, bx: number, by: number, bw: number, bh: number): boolean {
    return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
  }

  private enterAsGuest(): void {
    getAudioSystem()?.play('click');
    this.registry.set('isGuest', true);
    this.scene.start('LoungeScene');
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.gameTime += dt;

    this.character?.update(dt, false);
    updateRisingParticles(this.particles, dt, { width: GAME_WIDTH, height: GAME_HEIGHT });

    // Check for wallet connection from React
    if (this.registry.get('walletConnected')) {
      this.registry.set('isGuest', false);
      this.scene.start('LoungeScene');
      return;
    }

    this.draw();
  }

  private draw(): void {
    this.bgGraphics.clear();
    this.graphics.clear();
    this.fxGraphics.clear();

    this.drawBackground();
    this.drawPerspectiveGrid();
    drawGlowingParticles(this.bgGraphics, this.particles, Colors.CYAN);
    this.drawTitle();
    this.drawCharacterPreview();
    this.drawButton();
    this.drawFooter();
    drawVignette(this.fxGraphics, GAME_WIDTH, GAME_HEIGHT);
    drawEdgeFade(this.fxGraphics, GAME_WIDTH, GAME_HEIGHT);
    drawScanlines(this.fxGraphics, GAME_WIDTH, GAME_HEIGHT);
  }

  private drawBackground(): void {
    // Deep gradient background (dark purple to black)
    for (let y = 0; y < GAME_HEIGHT; y += 2) {
      const t = y / GAME_HEIGHT;
      const r = Math.floor(15 - t * 10);
      const g = Math.floor(5 - t * 5);
      const b = Math.floor(25 - t * 15);
      const color = (r << 16) | (g << 8) | b;
      this.bgGraphics.fillStyle(color, 1);
      this.bgGraphics.fillRect(0, y, GAME_WIDTH, 2);
    }
  }

  private drawPerspectiveGrid(): void {
    const gridStartY = GAME_HEIGHT * 0.55;
    const horizonY = GAME_HEIGHT * 0.5;

    // Horizontal lines with perspective spacing
    const hLineCount = 8;
    for (let i = 0; i <= hLineCount; i++) {
      const t = i / hLineCount;
      const perspectiveT = Math.pow(t, 1.5);
      const y = gridStartY + (GAME_HEIGHT - gridStartY) * perspectiveT;
      const alpha = 0.1 + t * 0.15;
      this.bgGraphics.lineStyle(1, Colors.CYAN, alpha);
      this.bgGraphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    // Vertical lines converging toward horizon
    const vLineCount = 9;
    for (let i = 0; i <= vLineCount; i++) {
      const t = i / vLineCount;
      const topX = GAME_WIDTH * t;
      const bottomX = -20 + (GAME_WIDTH + 40) * t;
      const alpha = 0.05 + Math.abs(t - 0.5) * 0.15;
      this.bgGraphics.lineStyle(1, Colors.CYAN, alpha);
      this.bgGraphics.lineBetween(topX, horizonY, bottomX, GAME_HEIGHT);
    }
  }

  private drawTitle(): void {
    const pulse = sinePulse(this.gameTime, 2.5, 0.4, 0.6);
    const chromaPulse = sinePulse(this.gameTime, 3, 0.2, 0.3);

    // Update chromatic aberration layers
    this.titleGlowMagenta.setAlpha(chromaPulse);
    this.titleGlowCyan.setAlpha(chromaPulse);

    // Update standard glow layers
    updateGlowTextPulse(this.titleGlow, pulse);

    // Background glow effects
    this.graphics.fillStyle(Colors.CYAN, 0.15 * pulse);
    this.graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT * 0.25 + 10, 50);
    this.graphics.fillStyle(Colors.CYAN, 0.25 * pulse);
    this.graphics.fillRoundedRect(GAME_WIDTH / 2 - 55, GAME_HEIGHT * 0.25 - 2, 110, 26, 4);

    // Subtitle pulse
    this.subtitleText.setAlpha(sinePulse(this.gameTime, 1.5, 0.2, 0.5));
  }

  private drawCharacterPreview(): void {
    if (!this.character) return;

    const bob = Math.sin(this.gameTime * 2) * 2;
    const charY = GAME_HEIGHT * 0.45;

    // Shadow beneath character
    this.graphics.fillStyle(Colors.CYAN, 0.2);
    this.graphics.fillEllipse(GAME_WIDTH / 2, charY + 15, 20, 6);

    this.character.draw(this.graphics, GAME_WIDTH / 2, charY + bob, 2, false);
  }

  private drawButton(): void {
    const btnW = 100;
    const btnH = 24;
    const btnX = (GAME_WIDTH - btnW) / 2;
    const guestY = GAME_HEIGHT * 0.72;
    const pulse = sinePulse(this.gameTime, 2.5, 0.4, 0.6);

    // Button glow (larger when hovered)
    const glowAlpha = this.isButtonHovered ? 0.4 : 0.15;
    const glowPadding = this.isButtonHovered ? 8 : 4;
    this.graphics.fillStyle(Colors.CYAN, glowAlpha * pulse);
    this.graphics.fillRoundedRect(
      btnX - glowPadding,
      guestY - glowPadding,
      btnW + glowPadding * 2,
      btnH + glowPadding * 2,
      6
    );

    // Button background
    const bgColor = this.isButtonHovered ? 0x004444 : 0x002222;
    this.graphics.fillStyle(bgColor, 0.8);
    this.graphics.fillRoundedRect(btnX, guestY, btnW, btnH, 4);

    // Button border
    const borderColor = this.isButtonHovered ? Colors.CYAN : 0x008888;
    this.graphics.lineStyle(2, borderColor, 0.9);
    this.graphics.strokeRoundedRect(btnX, guestY, btnW, btnH, 4);

    // Button text color
    this.guestButtonText.setTint(this.isButtonHovered ? Colors.CYAN : 0xffffff);

    // Guest hint pulse
    const hintPulse = sinePulse(this.gameTime, 2, 0.3, 0.6);
    this.guestHintText.setAlpha(hintPulse);
  }

  private drawFooter(): void {
    const footerPulse = sinePulse(this.gameTime, 2, 0.2, 0.4);
    this.graphics.fillStyle(0x333333, footerPulse);
    this.graphics.fillRoundedRect(GAME_WIDTH / 2 - 50, GAME_HEIGHT - 22, 100, 14, 2);
    this.footerText.setAlpha(footerPulse);

    // Animate wallet hint
    const walletPulse = sinePulse(this.gameTime, 1.5, 0.3, 0.5);
    this.walletHintText.setAlpha(walletPulse);

    // Draw help button background
    const helpPulse = sinePulse(this.gameTime, 3, 0.3, 0.5);
    this.graphics.fillStyle(0x333333, helpPulse);
    this.graphics.fillCircle(GAME_WIDTH - 14, 14, 10);
    this.graphics.lineStyle(1, 0x666666, helpPulse);
    this.graphics.strokeCircle(GAME_WIDTH - 14, 14, 10);
    this.helpText.setAlpha(helpPulse + 0.3);
  }
}
