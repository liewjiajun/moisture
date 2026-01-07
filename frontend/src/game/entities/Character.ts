// Procedural Character Generator - Ported from Lua
// Generates unique humanoid pixel characters from a seed

export interface CharacterColors {
  skin: { base: number[]; shadow: number[]; highlight: number[] };
  hair: { base: number[]; shadow: number[] };
  shirt: { base: number[]; shadow: number[] };
  pants: { base: number[]; shadow: number[] };
  eyes: number[];
}

// Seeded random number generator (LCG - same as Lua)
function createRNG(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

// Hash a string to a number (for wallet addresses)
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash * 33) + str.charCodeAt(i)) % 2147483648;
  }
  return hash;
}

// HSV to RGB conversion
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

function generateSkinTone(rng: () => number): { base: number[]; shadow: number[]; highlight: number[] } {
  const lightness = 0.4 + rng() * 0.5;
  const warmth = 0.02 + rng() * 0.08;
  const saturation = 0.2 + rng() * 0.4;
  const baseHue = 0.08 + warmth;

  return {
    base: hsvToRgb(baseHue, saturation, lightness),
    shadow: hsvToRgb(baseHue, saturation + 0.1, lightness * 0.8),
    highlight: hsvToRgb(baseHue, saturation * 0.7, Math.min(1, lightness * 1.1)),
  };
}

function generateHairColor(rng: () => number): { base: number[]; shadow: number[] } {
  const colorType = rng();
  let h: number, s: number, v: number;

  if (colorType < 0.5) {
    // Natural colors
    if (rng() < 0.3) {
      // Blonde
      h = 0.1 + rng() * 0.05;
      s = 0.3 + rng() * 0.3;
      v = 0.7 + rng() * 0.25;
    } else if (rng() < 0.5) {
      // Brown
      h = 0.05 + rng() * 0.05;
      s = 0.4 + rng() * 0.3;
      v = 0.2 + rng() * 0.4;
    } else if (rng() < 0.7) {
      // Black
      h = rng();
      s = 0.1 + rng() * 0.2;
      v = 0.1 + rng() * 0.15;
    } else {
      // Red
      h = 0.02 + rng() * 0.04;
      s = 0.6 + rng() * 0.3;
      v = 0.4 + rng() * 0.3;
    }
  } else {
    // Fantasy colors
    h = rng();
    s = 0.5 + rng() * 0.5;
    v = 0.5 + rng() * 0.4;
  }

  return {
    base: hsvToRgb(h, s, v),
    shadow: hsvToRgb(h, Math.min(1, s + 0.1), v * 0.7),
  };
}

function generateClothingColor(rng: () => number): { base: number[]; shadow: number[] } {
  const h = rng();
  const s = 0.3 + rng() * 0.6;
  const v = 0.4 + rng() * 0.5;

  return {
    base: hsvToRgb(h, s, v),
    shadow: hsvToRgb(h, Math.min(1, s + 0.15), v * 0.75),
  };
}

function generateEyeColor(rng: () => number): number[] {
  const colorType = rng();
  let h: number, s: number, v: number;

  if (colorType < 0.4) {
    h = 0.05 + rng() * 0.08;
    s = 0.5 + rng() * 0.4;
    v = 0.3 + rng() * 0.4;
  } else if (colorType < 0.6) {
    h = 0.55 + rng() * 0.1;
    s = 0.5 + rng() * 0.4;
    v = 0.5 + rng() * 0.4;
  } else if (colorType < 0.75) {
    h = 0.3 + rng() * 0.1;
    s = 0.4 + rng() * 0.4;
    v = 0.4 + rng() * 0.4;
  } else {
    h = rng();
    s = 0.6 + rng() * 0.4;
    v = 0.6 + rng() * 0.3;
  }

  return hsvToRgb(h, s, v);
}

function generateHairStyle(rng: () => number): number[][] {
  const style: number[][] = [];
  const hairType = Math.floor(rng() * 6);

  for (let y = 0; y < 4; y++) {
    style[y] = [];
    for (let x = 0; x < 8; x++) {
      let hasHair = false;

      switch (hairType) {
        case 0: // Short spiky
          hasHair = y <= 1 && x >= 1 && x <= 6;
          if (y === 0 && (x === 1 || x === 6)) hasHair = rng() > 0.5;
          break;
        case 1: // Medium with bangs
          hasHair = (y <= 2 && x >= 1 && x <= 6) || (y === 3 && (x <= 1 || x >= 6));
          break;
        case 2: // Long flowing
          hasHair = x >= 0 && x <= 7 && (y <= 2 || (y === 3 && (x <= 1 || x >= 6)));
          break;
        case 3: // Ponytail
          hasHair = (y <= 1 && x >= 1 && x <= 6) || (y >= 2 && x >= 5);
          break;
        case 4: // Twin tails
          hasHair = (y <= 1 && x >= 1 && x <= 6) || (y >= 2 && (x <= 1 || x >= 6));
          break;
        default: // Procedural random with symmetry
          const center = 3.5;
          const dist = Math.abs(x - center);
          const threshold = 0.3 + (1 - y / 4) * 0.5 - dist * 0.1;
          hasHair = rng() < threshold;
      }

      // Add randomness
      if (hasHair && rng() < 0.1) hasHair = false;
      if (!hasHair && rng() < 0.05) hasHair = true;

      style[y][x] = hasHair ? 1 : 0;
    }
  }

  // Symmetry
  if (rng() < 0.7) {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        style[y][7 - x] = style[y][x];
      }
    }
  }

  return style;
}

export type EyeStyle = 'normal' | 'anime' | 'cat' | 'happy' | 'determined' | 'sparkle';
export type ShirtStyle = 'plain' | 'stripes_h' | 'stripes_v' | 'dots' | 'collar';
export type PantsStyle = 'pants' | 'shorts' | 'skirt_short' | 'skirt_long';
export type AccessoryType = 'bow' | 'ribbon' | 'headband' | 'flower' | 'star' | 'horn' | 'cat_ears' | 'halo' | null;

export class Character {
  seed: number;
  colors: CharacterColors;
  hairStyle: number[][];
  eyeStyle: EyeStyle;
  shirtStyle: ShirtStyle;
  pantsStyle: PantsStyle;
  accessory: AccessoryType;

  // Animation state
  animTimer: number = 0;
  walkCycle: number = 0;
  frame: number = 0;

  constructor(seed: number | string) {
    // Convert seed
    if (typeof seed === 'string') {
      this.seed = hashString(seed);
    } else {
      this.seed = seed || Date.now();
    }

    const rng = createRNG(this.seed);

    // Generate features
    this.colors = {
      skin: generateSkinTone(rng),
      hair: generateHairColor(rng),
      shirt: generateClothingColor(rng),
      pants: generateClothingColor(rng),
      eyes: generateEyeColor(rng),
    };

    this.hairStyle = generateHairStyle(rng);

    const eyeStyles: EyeStyle[] = ['normal', 'anime', 'cat', 'happy', 'determined', 'sparkle'];
    this.eyeStyle = eyeStyles[Math.floor(rng() * eyeStyles.length)];

    const shirtStyles: ShirtStyle[] = ['plain', 'stripes_h', 'stripes_v', 'dots', 'collar', 'plain'];
    this.shirtStyle = shirtStyles[Math.floor(rng() * shirtStyles.length)];

    const pantsStyles: PantsStyle[] = ['pants', 'shorts', 'skirt_short', 'skirt_long', 'pants'];
    this.pantsStyle = pantsStyles[Math.floor(rng() * pantsStyles.length)];

    // 40% chance of accessory
    if (rng() >= 0.6) {
      const accessories: AccessoryType[] = ['bow', 'ribbon', 'headband', 'flower', 'star', 'horn', 'cat_ears', 'halo'];
      this.accessory = accessories[Math.floor(rng() * accessories.length)];
    } else {
      this.accessory = null;
    }
  }

  update(dt: number, isMoving: boolean): void {
    this.animTimer += dt;

    if (isMoving) {
      const walkSpeed = 8;
      this.walkCycle += dt * walkSpeed;
      const cyclePos = this.walkCycle % 4;

      if (cyclePos < 1) this.frame = 0;
      else if (cyclePos < 2) this.frame = 1;
      else if (cyclePos < 3) this.frame = 0;
      else this.frame = 3;
    } else {
      this.frame = 0;
      this.walkCycle = 0;
    }
  }

  getMainColor(): number[] {
    return this.colors.shirt.base;
  }

  // Draw character to a Phaser Graphics object
  // NOTE: Scene is responsible for calling graphics.clear() once per frame
  draw(graphics: Phaser.GameObjects.Graphics, x: number, y: number, scale: number = 1, facingLeft: boolean = false): void {

    const ox = x - 6 * scale;
    const oy = y - 8 * scale;
    const s = scale;

    // Walking animation offsets
    let bodyBob = 0;
    let leftLeg = 0;
    let rightLeg = 0;

    if (this.frame === 1) {
      bodyBob = -1 * s;
      leftLeg = 1 * s;
    } else if (this.frame === 3) {
      bodyBob = -1 * s;
      rightLeg = 1 * s;
    }

    // Note: facingLeft could be used for flipX in future
    void facingLeft;

    // Helper to convert RGB array to hex
    const toHex = (c: number[]) => Phaser.Display.Color.GetColor(c[0], c[1], c[2]);

    const skin = this.colors.skin;
    const hair = this.colors.hair;
    const shirt = this.colors.shirt;
    const pants = this.colors.pants;

    const isSkirt = this.pantsStyle === 'skirt_short' || this.pantsStyle === 'skirt_long';

    // Draw legs/skirt
    if (isSkirt) {
      graphics.fillStyle(toHex(pants.base));
      graphics.fillRect(ox + 3 * s, oy + 12 * s + bodyBob, 6 * s, 4 * s);
      graphics.fillStyle(toHex(pants.shadow));
      graphics.fillRect(ox + 3 * s, oy + 15 * s + bodyBob, 6 * s, 1 * s);
      // Legs under skirt
      graphics.fillStyle(toHex(skin.base));
      graphics.fillRect(ox + 4 * s, oy + 14 * s + leftLeg, 1 * s, 2 * s - leftLeg);
      graphics.fillRect(ox + 7 * s, oy + 14 * s + rightLeg, 1 * s, 2 * s - rightLeg);
    } else {
      // Pants
      graphics.fillStyle(toHex(pants.base));
      graphics.fillRect(ox + 4 * s, oy + 13 * s + leftLeg, 2 * s, 3 * s - leftLeg);
      graphics.fillRect(ox + 6 * s, oy + 13 * s + rightLeg, 2 * s, 3 * s - rightLeg);
      graphics.fillStyle(toHex(pants.shadow));
      graphics.fillRect(ox + 4 * s, oy + 14 * s + leftLeg, 1 * s, 2 * s - leftLeg);
      graphics.fillRect(ox + 6 * s, oy + 14 * s + rightLeg, 1 * s, 2 * s - rightLeg);
    }

    // Body/shirt
    graphics.fillStyle(toHex(shirt.base));
    graphics.fillRect(ox + 3 * s, oy + 8 * s + bodyBob, 6 * s, 5 * s);
    graphics.fillStyle(toHex(shirt.shadow));
    graphics.fillRect(ox + 3 * s, oy + 8 * s + bodyBob, 1 * s, 5 * s);
    graphics.fillRect(ox + 3 * s, oy + 12 * s + bodyBob, 6 * s, 1 * s);

    // Shirt pattern
    if (this.shirtStyle === 'stripes_h') {
      graphics.fillStyle(0xffffff, 0.3);
      graphics.fillRect(ox + 3 * s, oy + 9 * s + bodyBob, 6 * s, 1 * s);
      graphics.fillRect(ox + 3 * s, oy + 11 * s + bodyBob, 6 * s, 1 * s);
    } else if (this.shirtStyle === 'stripes_v') {
      graphics.fillStyle(0xffffff, 0.3);
      graphics.fillRect(ox + 4 * s, oy + 8 * s + bodyBob, 1 * s, 5 * s);
      graphics.fillRect(ox + 7 * s, oy + 8 * s + bodyBob, 1 * s, 5 * s);
    } else if (this.shirtStyle === 'dots') {
      graphics.fillStyle(0xffffff, 0.4);
      graphics.fillRect(ox + 4 * s, oy + 9 * s + bodyBob, 1 * s, 1 * s);
      graphics.fillRect(ox + 6 * s, oy + 10 * s + bodyBob, 1 * s, 1 * s);
    } else if (this.shirtStyle === 'collar') {
      graphics.fillStyle(0xffffff, 0.8);
      graphics.fillRect(ox + 4 * s, oy + 8 * s + bodyBob, 1 * s, 1 * s);
      graphics.fillRect(ox + 7 * s, oy + 8 * s + bodyBob, 1 * s, 1 * s);
    }

    // Arms
    graphics.fillStyle(toHex(skin.base));
    graphics.fillRect(ox + 2 * s, oy + 9 * s + bodyBob, 1 * s, 3 * s);
    graphics.fillRect(ox + 9 * s, oy + 9 * s + bodyBob, 1 * s, 3 * s);

    // Head
    graphics.fillStyle(toHex(skin.base));
    graphics.fillRect(ox + 3 * s, oy + 3 * s + bodyBob, 6 * s, 5 * s);
    graphics.fillStyle(toHex(skin.shadow));
    graphics.fillRect(ox + 3 * s, oy + 3 * s + bodyBob, 1 * s, 5 * s);
    graphics.fillStyle(toHex(skin.highlight));
    graphics.fillRect(ox + 3 * s, oy + 7 * s + bodyBob, 6 * s, 1 * s);

    // Hair
    graphics.fillStyle(toHex(hair.base));
    for (let hy = 0; hy < 4; hy++) {
      for (let hx = 0; hx < 8; hx++) {
        if (this.hairStyle[hy] && this.hairStyle[hy][hx] === 1) {
          graphics.fillRect(ox + (hx + 2) * s, oy + hy * s + bodyBob, 1 * s, 1 * s);
        }
      }
    }

    // Eyes
    graphics.fillStyle(toHex(this.colors.eyes));
    switch (this.eyeStyle) {
      case 'normal':
        graphics.fillRect(ox + 4 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
        graphics.fillRect(ox + 7 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
        break;
      case 'anime':
        graphics.fillRect(ox + 4 * s, oy + 4 * s + bodyBob, 1 * s, 2 * s);
        graphics.fillRect(ox + 7 * s, oy + 4 * s + bodyBob, 1 * s, 2 * s);
        break;
      case 'cat':
        graphics.fillRect(ox + 4 * s, oy + 5 * s + bodyBob, 2 * s, 1 * s);
        graphics.fillRect(ox + 6 * s, oy + 5 * s + bodyBob, 2 * s, 1 * s);
        break;
      case 'happy':
        graphics.fillStyle(0x000000);
        graphics.fillRect(ox + 4 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
        graphics.fillRect(ox + 7 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
        break;
      case 'sparkle':
        graphics.fillRect(ox + 4 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
        graphics.fillRect(ox + 7 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
        graphics.fillStyle(0xffffff);
        graphics.fillRect(ox + 4 * s, oy + 4 * s + bodyBob, 1 * s, 1 * s);
        graphics.fillRect(ox + 7 * s, oy + 4 * s + bodyBob, 1 * s, 1 * s);
        break;
      default:
        graphics.fillRect(ox + 4 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
        graphics.fillRect(ox + 7 * s, oy + 5 * s + bodyBob, 1 * s, 1 * s);
    }

    // Accessory
    if (this.accessory) {
      switch (this.accessory) {
        case 'bow':
        case 'ribbon':
          graphics.fillStyle(0xff4d80);
          graphics.fillRect(ox + 2 * s, oy + 1 * s + bodyBob, 2 * s, 1 * s);
          graphics.fillRect(ox + 3 * s, oy + 0 * s + bodyBob, 1 * s, 1 * s);
          break;
        case 'headband':
          graphics.fillStyle(0xe6e64d);
          graphics.fillRect(ox + 2 * s, oy + 2 * s + bodyBob, 8 * s, 1 * s);
          break;
        case 'flower':
          graphics.fillStyle(0xff8080);
          graphics.fillRect(ox + 2 * s, oy + 1 * s + bodyBob, 1 * s, 1 * s);
          graphics.fillStyle(0xffff80);
          graphics.fillRect(ox + 2 * s, oy + 0 * s + bodyBob, 1 * s, 1 * s);
          break;
        case 'star':
          graphics.fillStyle(0xffff4d);
          graphics.fillRect(ox + 2 * s, oy + 0 * s + bodyBob, 1 * s, 1 * s);
          break;
        case 'horn':
          graphics.fillStyle(0xe6ccb3);
          graphics.fillRect(ox + 5 * s, oy + 0 * s + bodyBob, 2 * s, 1 * s);
          graphics.fillRect(ox + 6 * s, oy - 1 * s + bodyBob, 1 * s, 1 * s);
          break;
        case 'cat_ears':
          graphics.fillStyle(toHex(hair.base));
          graphics.fillRect(ox + 2 * s, oy + 0 * s + bodyBob, 1 * s, 2 * s);
          graphics.fillRect(ox + 9 * s, oy + 0 * s + bodyBob, 1 * s, 2 * s);
          break;
        case 'halo':
          graphics.fillStyle(0xffffb3, 0.8);
          graphics.fillRect(ox + 4 * s, oy - 1 * s + bodyBob, 4 * s, 1 * s);
          break;
      }
    }
  }
}
