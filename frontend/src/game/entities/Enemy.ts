// Enemy System - Ported from Lua
// Procedural enemy generation and stats

import { EnemyType, EnemyStats, BulletPattern } from '../types';

// Seeded RNG
function createRNG(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

// HSV to RGB
function hsvToRgb(h: number, s: number, v: number): number[] {
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

interface EnemyTypeConfig {
  baseHue: number;
  hueRange: number;
  saturation: [number, number];
  brightness: [number, number];
  hasWings?: boolean;
  hasTail?: boolean;
  hasEars?: 'bunny' | 'cat' | 'fox';
  hasHat?: boolean;
  hasHorns?: boolean;
  hasHalo?: boolean;
  bodyStyle: 'small' | 'blob' | 'robed' | 'ghostly' | 'elegant' | 'normal';
  transparent?: boolean;
}

const ENEMY_TYPES: Record<EnemyType, EnemyTypeConfig> = {
  fairy: {
    baseHue: 0.85, hueRange: 0.15,
    saturation: [0.4, 0.7], brightness: [0.7, 0.9],
    hasWings: true, bodyStyle: 'small',
  },
  slime: {
    baseHue: 0.35, hueRange: 0.3,
    saturation: [0.5, 0.8], brightness: [0.5, 0.8],
    bodyStyle: 'blob', transparent: true,
  },
  bunny: {
    baseHue: 0.95, hueRange: 0.1,
    saturation: [0.2, 0.5], brightness: [0.8, 0.95],
    hasTail: true, hasEars: 'bunny', bodyStyle: 'small',
  },
  neko: {
    baseHue: 0.08, hueRange: 0.15,
    saturation: [0.3, 0.6], brightness: [0.5, 0.8],
    hasTail: true, hasEars: 'cat', bodyStyle: 'small',
  },
  witch: {
    baseHue: 0.75, hueRange: 0.1,
    saturation: [0.4, 0.7], brightness: [0.3, 0.5],
    hasHat: true, bodyStyle: 'robed',
  },
  miko: {
    baseHue: 0.0, hueRange: 0.05,
    saturation: [0.6, 0.8], brightness: [0.7, 0.9],
    bodyStyle: 'robed',
  },
  ghost: {
    baseHue: 0.6, hueRange: 0.1,
    saturation: [0.1, 0.3], brightness: [0.8, 0.95],
    bodyStyle: 'ghostly', transparent: true,
  },
  demon: {
    baseHue: 0.0, hueRange: 0.08,
    saturation: [0.6, 0.9], brightness: [0.3, 0.5],
    hasWings: true, hasTail: true, hasHorns: true, bodyStyle: 'normal',
  },
  kitsune: {
    baseHue: 0.08, hueRange: 0.08,
    saturation: [0.5, 0.8], brightness: [0.6, 0.85],
    hasTail: true, hasEars: 'fox', bodyStyle: 'elegant',
  },
  angel: {
    baseHue: 0.15, hueRange: 0.1,
    saturation: [0.2, 0.5], brightness: [0.85, 1.0],
    hasWings: true, hasHalo: true, bodyStyle: 'elegant',
  },
};

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  fairy: { speed: 20, health: 1, damage: 1, shootRate: 2.5, points: 10 },
  slime: { speed: 15, health: 2, damage: 1, shootRate: 3.0, points: 15, splits: true },
  bunny: { speed: 35, health: 1, damage: 1, shootRate: 2.0, points: 12 },
  neko: { speed: 40, health: 1, damage: 1, shootRate: 1.8, points: 18 },
  witch: { speed: 18, health: 2, damage: 1, shootRate: 1.5, points: 25 },
  miko: { speed: 22, health: 2, damage: 1, shootRate: 2.0, points: 20 },
  ghost: { speed: 25, health: 1, damage: 1, shootRate: 1.2, points: 30, phasing: true },
  demon: { speed: 28, health: 3, damage: 1, shootRate: 1.0, points: 35 },
  kitsune: { speed: 30, health: 2, damage: 1, shootRate: 0.8, points: 40, multishot: true },
  angel: { speed: 20, health: 4, damage: 1, shootRate: 0.5, points: 50, homing: true },
};

const BULLET_PATTERNS: Record<EnemyType, BulletPattern> = {
  fairy: 'spread3',
  slime: 'random_spread',
  bunny: 'burst',
  neko: 'wave',
  witch: 'spread5',
  miko: 'aimed_double',
  ghost: 'spiral',
  demon: 'ring',
  kitsune: 'spread5',
  angel: 'ring',
};

const SHOOT_RATES: Record<EnemyType, number> = {
  fairy: 2.0,
  slime: 2.5,
  bunny: 1.5,
  neko: 1.8,
  witch: 2.2,
  miko: 1.6,
  ghost: 1.4,
  demon: 2.8,
  kitsune: 1.2,
  angel: 2.0,
};

export function getEnemyStats(type: EnemyType): EnemyStats {
  return ENEMY_STATS[type];
}

export function getBulletPattern(type: EnemyType): BulletPattern {
  return BULLET_PATTERNS[type];
}

export function getShootRate(type: EnemyType): number {
  return SHOOT_RATES[type];
}

export function getRandomEnemyType(humidity: number): EnemyType {
  const allTypes: EnemyType[] = ['fairy', 'slime', 'bunny', 'neko', 'witch', 'miko', 'ghost', 'demon', 'kitsune', 'angel'];

  let pool: EnemyType[];

  if (humidity < 1.5) {
    pool = ['fairy', 'slime', 'bunny'];
  } else if (humidity < 2.5) {
    pool = ['fairy', 'slime', 'bunny', 'neko', 'witch', 'miko'];
  } else if (humidity < 3.5) {
    pool = ['fairy', 'neko', 'witch', 'miko', 'ghost', 'demon', 'kitsune'];
  } else {
    pool = allTypes;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

export interface EnemyColors {
  main: number[];
  shadow: number[];
  highlight: number[];
  secondary: number[];
  secondaryShadow: number[];
  skin: number[];
  skinShadow: number[];
}

function generateEnemyColors(rng: () => number, config: EnemyTypeConfig): EnemyColors {
  let hue = config.baseHue + (rng() - 0.5) * config.hueRange;
  hue = ((hue % 1) + 1) % 1;

  const sat = config.saturation[0] + rng() * (config.saturation[1] - config.saturation[0]);
  const val = config.brightness[0] + rng() * (config.brightness[1] - config.brightness[0]);

  const mainColor = hsvToRgb(hue, sat, val);
  const shadowColor = hsvToRgb(hue, Math.min(1, sat + 0.15), val * 0.7);
  const highlightColor = hsvToRgb(hue, sat * 0.7, Math.min(1, val * 1.15));

  const secondaryHue = (hue + 0.3 + rng() * 0.4) % 1;
  const secondaryColor = hsvToRgb(secondaryHue, sat * 0.8, val * 0.9);
  const secondaryShadow = hsvToRgb(secondaryHue, Math.min(1, sat * 0.8 + 0.15), val * 0.7);

  const skinHue = 0.08 + rng() * 0.04;
  const skinSat = 0.2 + rng() * 0.3;
  const skinVal = 0.6 + rng() * 0.3;
  const skinColor = hsvToRgb(skinHue, skinSat, skinVal);
  const skinShadow = hsvToRgb(skinHue, skinSat + 0.1, skinVal * 0.8);

  return {
    main: mainColor,
    shadow: shadowColor,
    highlight: highlightColor,
    secondary: secondaryColor,
    secondaryShadow: secondaryShadow,
    skin: skinColor,
    skinShadow: skinShadow,
  };
}

export class Enemy {
  x: number;
  y: number;
  type: EnemyType;
  colors: EnemyColors;
  speed: number;
  health: number;
  maxHealth: number;
  shootRate: number;
  shootCooldown: number;
  bulletPattern: BulletPattern;
  points: number;
  splits: boolean;
  facingLeft: boolean = false;
  animTime: number = 0;
  bobOffset: number = 0;
  alive: boolean = true;
  hitFlash: number = 0;
  spawnEffect: number = 0.5;
  moveDx: number = 0;
  moveDy: number = 0;
  moveTimer: number = 0;
  spiralOffset: number = 0;

  constructor(x: number, y: number, type: EnemyType, seed?: number) {
    this.x = x;
    this.y = y;
    this.type = type;

    const rng = createRNG(seed || Math.floor(Math.random() * 999999));
    const config = ENEMY_TYPES[type];
    this.colors = generateEnemyColors(rng, config);

    const stats = ENEMY_STATS[type];
    this.speed = stats.speed;
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.points = stats.points;
    this.splits = stats.splits || false;

    this.bulletPattern = BULLET_PATTERNS[type];
    this.shootRate = SHOOT_RATES[type];
    this.shootCooldown = Math.random() * this.shootRate;
    this.animTime = Math.random() * 10;
  }

  update(dt: number): void {
    this.animTime += dt;
    this.bobOffset = Math.sin(this.animTime * 6);

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
    }
    if (this.spawnEffect > 0) {
      this.spawnEffect -= dt;
    }
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    this.hitFlash = 0.15;
    return this.health <= 0;
  }

  // Draw enemy to Phaser Graphics
  // NOTE: Scene is responsible for calling graphics.clear() once per frame
  draw(graphics: Phaser.GameObjects.Graphics, scale: number = 1): void {
    const toHex = (c: number[]) => Phaser.Display.Color.GetColor(c[0], c[1], c[2]);
    const config = ENEMY_TYPES[this.type];
    const alpha = config.transparent ? 0.8 : 1;
    const s = scale;

    // Base position + centering offset
    const ox = this.x - 5 * s;
    const oy = this.y - 6 * s;

    // Apply hit flash
    if (this.hitFlash > 0) {
      graphics.fillStyle(0xffffff);
    }

    // Draw based on body style
    if (config.bodyStyle === 'blob') {
      graphics.fillStyle(toHex(this.colors.main), alpha);
      graphics.fillRect(ox + 2 * s, oy + 6 * s, 6 * s, 5 * s);
      graphics.fillRect(ox + 3 * s, oy + 4 * s, 4 * s, 2 * s);
      graphics.fillStyle(toHex(this.colors.shadow), alpha);
      graphics.fillRect(ox + 2 * s, oy + 9 * s, 6 * s, 2 * s);
      graphics.fillStyle(0x000000, alpha);
      graphics.fillRect(ox + 3 * s, oy + 6 * s, 1 * s, 1 * s);
      graphics.fillRect(ox + 6 * s, oy + 6 * s, 1 * s, 1 * s);
      graphics.fillStyle(toHex(this.colors.highlight), 0.5);
      graphics.fillRect(ox + 3 * s, oy + 5 * s, 2 * s, 1 * s);
    } else if (config.bodyStyle === 'ghostly') {
      graphics.fillStyle(toHex(this.colors.main), alpha);
      graphics.fillRect(ox + 2 * s, oy + 2 * s, 6 * s, 6 * s);
      graphics.fillRect(ox + 1 * s, oy + 4 * s, 8 * s, 4 * s);
      graphics.fillRect(ox + 2 * s, oy + 8 * s, 2 * s, 2 * s);
      graphics.fillRect(ox + 6 * s, oy + 8 * s, 2 * s, 2 * s);
      graphics.fillRect(ox + 4 * s, oy + 9 * s, 2 * s, 2 * s);
      graphics.fillStyle(0x000000, alpha);
      graphics.fillRect(ox + 3 * s, oy + 4 * s, 1 * s, 2 * s);
      graphics.fillRect(ox + 6 * s, oy + 4 * s, 1 * s, 2 * s);
    } else if (config.bodyStyle === 'robed') {
      graphics.fillStyle(toHex(this.colors.skin));
      graphics.fillRect(ox + 3 * s, oy + 3 * s, 4 * s, 4 * s);
      graphics.fillStyle(toHex(this.colors.main));
      graphics.fillRect(ox + 2 * s, oy + 7 * s, 6 * s, 4 * s);
      graphics.fillRect(ox + 1 * s, oy + 8 * s, 8 * s, 3 * s);
      graphics.fillStyle(toHex(this.colors.shadow));
      graphics.fillRect(ox + 2 * s, oy + 10 * s, 6 * s, 1 * s);
      if (config.hasHat) {
        graphics.fillStyle(toHex(this.colors.secondary));
        graphics.fillRect(ox + 2 * s, oy + 2 * s, 6 * s, 2 * s);
        graphics.fillRect(ox + 3 * s, oy + 0 * s, 4 * s, 2 * s);
        graphics.fillRect(ox + 4 * s, oy - 1 * s, 2 * s, 1 * s);
      }
      graphics.fillStyle(0x000000);
      graphics.fillRect(ox + 3 * s, oy + 4 * s, 1 * s, 1 * s);
      graphics.fillRect(ox + 6 * s, oy + 4 * s, 1 * s, 1 * s);
    } else if (config.bodyStyle === 'elegant') {
      graphics.fillStyle(toHex(this.colors.main));
      graphics.fillRect(ox + 2 * s, oy + 0 * s, 6 * s, 3 * s);
      graphics.fillRect(ox + 1 * s, oy + 1 * s, 8 * s, 2 * s);
      graphics.fillStyle(toHex(this.colors.skin));
      graphics.fillRect(ox + 3 * s, oy + 2 * s, 4 * s, 4 * s);
      graphics.fillStyle(toHex(this.colors.secondary));
      graphics.fillRect(ox + 3 * s, oy + 6 * s, 4 * s, 4 * s);
      graphics.fillRect(ox + 2 * s, oy + 7 * s, 6 * s, 3 * s);
      graphics.fillStyle(toHex(this.colors.skin));
      graphics.fillRect(ox + 3 * s, oy + 10 * s, 1 * s, 2 * s);
      graphics.fillRect(ox + 6 * s, oy + 10 * s, 1 * s, 2 * s);
      graphics.fillStyle(0x000000);
      graphics.fillRect(ox + 3 * s, oy + 4 * s, 1 * s, 1 * s);
      graphics.fillRect(ox + 6 * s, oy + 4 * s, 1 * s, 1 * s);
    } else {
      // Normal/small body
      graphics.fillStyle(toHex(this.colors.main));
      graphics.fillRect(ox + 2 * s, oy + 0 * s, 6 * s, 3 * s);
      graphics.fillRect(ox + 1 * s, oy + 1 * s, 8 * s, 2 * s);
      graphics.fillStyle(toHex(this.colors.skin));
      graphics.fillRect(ox + 3 * s, oy + 2 * s, 4 * s, 4 * s);
      graphics.fillStyle(toHex(this.colors.skinShadow));
      graphics.fillRect(ox + 3 * s, oy + 5 * s, 4 * s, 1 * s);
      graphics.fillStyle(toHex(this.colors.secondary));
      graphics.fillRect(ox + 3 * s, oy + 6 * s, 4 * s, 4 * s);
      graphics.fillStyle(toHex(this.colors.secondaryShadow));
      graphics.fillRect(ox + 3 * s, oy + 9 * s, 4 * s, 1 * s);
      graphics.fillStyle(toHex(this.colors.skin));
      graphics.fillRect(ox + 3 * s, oy + 10 * s, 1 * s, 2 * s);
      graphics.fillRect(ox + 6 * s, oy + 10 * s, 1 * s, 2 * s);
      graphics.fillStyle(0x000000);
      graphics.fillRect(ox + 3 * s, oy + 4 * s, 1 * s, 1 * s);
      graphics.fillRect(ox + 6 * s, oy + 4 * s, 1 * s, 1 * s);
    }

    // Wings
    if (config.hasWings) {
      if (this.type === 'demon') {
        graphics.fillStyle(toHex(this.colors.shadow));
      } else {
        graphics.fillStyle(toHex(this.colors.highlight), 0.7);
      }
      graphics.fillRect(ox + 0 * s, oy + 4 * s, 2 * s, 3 * s);
      graphics.fillRect(ox + 8 * s, oy + 4 * s, 2 * s, 3 * s);
    }

    // Ears
    if (config.hasEars) {
      graphics.fillStyle(toHex(this.colors.main));
      if (config.hasEars === 'bunny') {
        graphics.fillRect(ox + 2 * s, oy - 2 * s, 1 * s, 3 * s);
        graphics.fillRect(ox + 7 * s, oy - 2 * s, 1 * s, 3 * s);
      } else {
        graphics.fillRect(ox + 1 * s, oy + 0 * s, 2 * s, 2 * s);
        graphics.fillRect(ox + 7 * s, oy + 0 * s, 2 * s, 2 * s);
      }
    }

    // Tail
    if (config.hasTail) {
      graphics.fillStyle(toHex(this.colors.main));
      graphics.fillRect(ox + 8 * s, oy + 8 * s, 2 * s, 1 * s);
      graphics.fillRect(ox + 9 * s, oy + 9 * s, 1 * s, 1 * s);
    }

    // Horns
    if (config.hasHorns) {
      graphics.fillStyle(0x4d3333);
      graphics.fillRect(ox + 1 * s, oy + 0 * s, 1 * s, 2 * s);
      graphics.fillRect(ox + 8 * s, oy + 0 * s, 1 * s, 2 * s);
    }

    // Halo
    if (config.hasHalo) {
      graphics.fillStyle(0xffffb3, 0.8);
      graphics.fillRect(ox + 3 * s, oy - 1 * s, 4 * s, 1 * s);
    }
  }
}
