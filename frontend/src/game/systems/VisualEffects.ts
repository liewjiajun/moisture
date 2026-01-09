// VisualEffects - Shared visual effect utilities for scenes
// Consolidates common patterns: gradients, scanlines, vignette, particles

import Phaser from 'phaser';

// ============================================================================
// CONSTANTS
// ============================================================================

export const GAME_WIDTH = 180;
export const GAME_HEIGHT = 320;

// Common colors used across scenes
export const Colors = {
  CYAN: 0x00ffff,
  MAGENTA: 0xff00ff,
  GREEN: 0x66cc99,
  RED: 0xff6666,
  ORANGE: 0xff6600,
  GOLD: 0xffd700,
  SILVER: 0xc0c0c0,
  BRONZE: 0xcd7f32,
} as const;

// ============================================================================
// PARTICLE INTERFACES
// ============================================================================

// Generic particle with common properties
export interface BaseParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

// Particle with wobble effect (steam, moisture)
export interface WobblyParticle extends BaseParticle {
  wobble: number;
  wobbleSpeed: number;
}

// Particle with color
export interface ColoredParticle extends BaseParticle {
  color: number;
}

// ============================================================================
// PARTICLE FACTORY
// ============================================================================

export function createWobblyParticles(
  count: number,
  bounds: { width: number; height: number },
  config: {
    sizeRange?: [number, number];
    speedRange?: [number, number];
    alphaRange?: [number, number];
    wobbleSpeedRange?: [number, number];
    ySpread?: 'full' | 'bottom';
  } = {}
): WobblyParticle[] {
  const {
    sizeRange = [1, 3],
    speedRange = [5, 15],
    alphaRange = [0.1, 0.4],
    wobbleSpeedRange = [0.5, 2],
    ySpread = 'full',
  } = config;

  const particles: WobblyParticle[] = [];
  for (let i = 0; i < count; i++) {
    const y = ySpread === 'bottom'
      ? bounds.height - Math.random() * 100
      : Math.random() * bounds.height;

    particles.push({
      x: Math.random() * bounds.width,
      y,
      size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
      speed: speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]),
      alpha: alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0]),
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: wobbleSpeedRange[0] + Math.random() * (wobbleSpeedRange[1] - wobbleSpeedRange[0]),
    });
  }
  return particles;
}

export function createColoredParticles(
  count: number,
  bounds: { width: number; height: number },
  color: number,
  config: {
    sizeRange?: [number, number];
    speedRange?: [number, number];
    alphaRange?: [number, number];
  } = {}
): ColoredParticle[] {
  const {
    sizeRange = [1, 3],
    speedRange = [5, 15],
    alphaRange = [0.1, 0.4],
  } = config;

  const particles: ColoredParticle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * bounds.width,
      y: Math.random() * bounds.height,
      size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
      speed: speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]),
      alpha: alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0]),
      color,
    });
  }
  return particles;
}

// ============================================================================
// PARTICLE UPDATE FUNCTIONS
// ============================================================================

export function updateRisingParticles(
  particles: WobblyParticle[],
  dt: number,
  bounds: { width: number; height: number },
  respawnY?: number
): void {
  for (const p of particles) {
    p.y -= p.speed * dt;
    p.wobble += p.wobbleSpeed * dt;
    p.x += Math.sin(p.wobble) * 0.3;

    if (p.y < -10) {
      p.y = respawnY ?? bounds.height + 10;
      p.x = Math.random() * bounds.width;
      p.wobble = Math.random() * Math.PI * 2;
    }

    if (p.x < 0) p.x = bounds.width;
    if (p.x > bounds.width) p.x = 0;
  }
}

export function updateFloatingParticles(
  particles: ColoredParticle[],
  dt: number,
  gameTime: number,
  bounds: { width: number; height: number }
): void {
  for (const p of particles) {
    p.y -= p.speed * dt;
    p.x += Math.sin(gameTime + p.y * 0.05) * 0.3;

    if (p.y < -10) {
      p.y = bounds.height + 10;
      p.x = Math.random() * bounds.width;
    }
  }
}

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

// Vertical gradient background
export function drawVerticalGradient(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  topColor: { r: number; g: number; b: number },
  bottomColor: { r: number; g: number; b: number },
  step: number = 2
): void {
  for (let y = 0; y < height; y += step) {
    const t = y / height;
    const r = Math.floor(topColor.r + t * (bottomColor.r - topColor.r));
    const g = Math.floor(topColor.g + t * (bottomColor.g - topColor.g));
    const b = Math.floor(topColor.b + t * (bottomColor.b - topColor.b));
    const color = (r << 16) | (g << 8) | b;
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, y, width, step);
  }
}

// Scanline effect (CRT)
export function drawScanlines(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  spacing: number = 3,
  alpha: number = 0.08
): void {
  for (let y = 0; y < height; y += spacing) {
    graphics.fillStyle(0x000000, alpha);
    graphics.fillRect(0, y, width, 1);
  }
}

// Corner vignette effect
export function drawVignette(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  layers: number = 4,
  baseSize: number = 15,
  baseAlpha: number = 0.3
): void {
  for (let i = 1; i <= layers; i++) {
    const size = i * baseSize;
    const alpha = baseAlpha * (1 - i / (layers + 1));
    graphics.fillStyle(0x000000, alpha);

    // Top-left
    graphics.fillTriangle(0, 0, size, 0, 0, size);
    // Top-right
    graphics.fillTriangle(width, 0, width - size, 0, width, size);
    // Bottom-left
    graphics.fillTriangle(0, height, size, height, 0, height - size);
    // Bottom-right
    graphics.fillTriangle(width, height, width - size, height, width, height - size);
  }
}

// Edge fade effect (top and bottom)
export function drawEdgeFade(
  graphics: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  fadeHeight: number = 20,
  maxAlpha: number = 0.3
): void {
  for (let i = 0; i < fadeHeight; i++) {
    const alpha = (1 - i / fadeHeight) * maxAlpha;
    graphics.fillStyle(0x000000, alpha);
    graphics.fillRect(0, i, width, 1);
    graphics.fillRect(0, height - 1 - i, width, 1);
  }
}

// Draw particles with glow effect
export function drawGlowingParticles(
  graphics: Phaser.GameObjects.Graphics,
  particles: BaseParticle[],
  glowColor: number,
  coreColor: number = 0xffffff
): void {
  for (const p of particles) {
    graphics.fillStyle(glowColor, p.alpha * 0.3);
    graphics.fillCircle(p.x, p.y, p.size + 1);
    graphics.fillStyle(coreColor, p.alpha);
    graphics.fillCircle(p.x, p.y, p.size * 0.5);
  }
}

// Draw particles with color property
export function drawColoredParticles(
  graphics: Phaser.GameObjects.Graphics,
  particles: ColoredParticle[]
): void {
  for (const p of particles) {
    graphics.fillStyle(p.color, p.alpha * 0.5);
    graphics.fillCircle(p.x, p.y, p.size + 1);
    graphics.fillStyle(0xffffff, p.alpha);
    graphics.fillCircle(p.x, p.y, p.size * 0.5);
  }
}

// ============================================================================
// PULSE CALCULATIONS
// ============================================================================

export function pulse(gameTime: number, speed: number = 2, min: number = 0.6, max: number = 1.0): number {
  const range = max - min;
  return min + (Math.sin(gameTime * speed) * 0.5 + 0.5) * range;
}

export function sinePulse(gameTime: number, speed: number = 2, amplitude: number = 0.3, offset: number = 0.7): number {
  return offset + Math.sin(gameTime * speed) * amplitude;
}

// ============================================================================
// GLOW TEXT HELPER
// ============================================================================

// Creates offset glow layers for text (call before creating main text)
export interface GlowTextConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  fontKey: string;
  text: string;
  glowColor: number;
  chromeColor?: number; // Optional chromatic aberration color
  glowOffset?: number;
  depth?: number;
}

export interface GlowTextResult {
  glow1: Phaser.GameObjects.BitmapText;
  glow2: Phaser.GameObjects.BitmapText;
  chrome?: Phaser.GameObjects.BitmapText;
  main: Phaser.GameObjects.BitmapText;
}

export function createGlowText(config: GlowTextConfig): GlowTextResult {
  const {
    scene,
    x,
    y,
    fontKey,
    text,
    glowColor,
    chromeColor,
    glowOffset = 1,
    depth = 9,
  } = config;

  const result: GlowTextResult = {
    glow1: scene.add.bitmapText(x - glowOffset, y - glowOffset, fontKey, text)
      .setOrigin(0.5)
      .setDepth(depth - 1)
      .setAlpha(0.4)
      .setTint(glowColor),
    glow2: scene.add.bitmapText(x + glowOffset, y + glowOffset, fontKey, text)
      .setOrigin(0.5)
      .setDepth(depth - 1)
      .setAlpha(0.4)
      .setTint(glowColor),
    main: scene.add.bitmapText(x, y, fontKey, text)
      .setOrigin(0.5)
      .setDepth(depth)
      .setTint(0xffffff),
  };

  if (chromeColor !== undefined) {
    result.chrome = scene.add.bitmapText(x, y, fontKey, text)
      .setOrigin(0.5)
      .setDepth(depth - 2)
      .setAlpha(0.2)
      .setTint(chromeColor);
  }

  return result;
}

// Update glow text alpha with pulsing
export function updateGlowTextPulse(
  glowText: GlowTextResult,
  pulseValue: number,
  chromePulseValue?: number
): void {
  glowText.glow1.setAlpha(0.4 * pulseValue);
  glowText.glow2.setAlpha(0.4 * pulseValue);
  if (glowText.chrome && chromePulseValue !== undefined) {
    glowText.chrome.setAlpha(0.2 + chromePulseValue * 0.2);
  }
}

// Set text content for all glow layers
export function setGlowTextContent(glowText: GlowTextResult, text: string): void {
  glowText.main.setText(text);
  glowText.glow1.setText(text);
  glowText.glow2.setText(text);
  if (glowText.chrome) {
    glowText.chrome.setText(text);
  }
}

// Set tint for all glow layers
export function setGlowTextTint(
  glowText: GlowTextResult,
  mainTint: number,
  glowTint: number,
  chromeTint?: number
): void {
  glowText.main.setTint(mainTint);
  glowText.glow1.setTint(glowTint);
  glowText.glow2.setTint(glowTint);
  if (glowText.chrome && chromeTint !== undefined) {
    glowText.chrome.setTint(chromeTint);
  }
}
