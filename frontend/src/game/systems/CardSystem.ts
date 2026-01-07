// Card System - Ported from Lua
// Defines all upgrade cards and handles card selection

import { CardDefinition, CardLevels } from '../types';

export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  // DEFENSE
  heart: {
    id: 'heart',
    name: 'HEART',
    desc: '+1 max HP',
    icon: '\u2665', // Heart symbol
    category: 'defense',
    color: 0xff4d4d,
    maxLevel: 5,
    effect: 'Increases maximum health',
  },
  tiny: {
    id: 'tiny',
    name: 'TINY',
    desc: 'Smaller hitbox',
    icon: '\u00b7',
    category: 'defense',
    color: 0x80ff80,
    maxLevel: 5,
    effect: 'Reduces your collision size by 15%',
  },
  ghost: {
    id: 'ghost',
    name: 'GHOST',
    desc: 'Longer i-frames',
    icon: 'G',
    category: 'defense',
    color: 0xb3b3e6,
    maxLevel: 3,
    effect: 'More invincibility time after damage',
  },
  shield: {
    id: 'shield',
    name: 'SHIELD',
    desc: 'Auto-block',
    icon: 'O',
    category: 'defense',
    color: 0x4db3ff,
    maxLevel: 3,
    effect: 'Absorb 1 bullet every 8 seconds',
  },

  // MOVEMENT
  swift: {
    id: 'swift',
    name: 'SWIFT',
    desc: '+15% speed',
    icon: '\u00bb',
    category: 'movement',
    color: 0x4de6ff,
    maxLevel: 5,
    effect: 'Move faster',
  },
  blink: {
    id: 'blink',
    name: 'BLINK',
    desc: 'Teleport',
    icon: '\u21af',
    category: 'movement',
    color: 0xffb34d,
    maxLevel: 3,
    effect: 'Short teleport with cooldown',
  },
  focus: {
    id: 'focus',
    name: 'FOCUS',
    desc: 'Slow = tiny',
    icon: '\u25ce',
    category: 'movement',
    color: 0xffe64d,
    maxLevel: 3,
    effect: 'Smaller hitbox when moving slowly',
  },

  // BULLET MANIPULATION
  reflect: {
    id: 'reflect',
    name: 'REFLECT',
    desc: 'Bounce power',
    icon: '\u27f2',
    category: 'bullet',
    color: 0xff8033,
    maxLevel: 5,
    effect: 'Bounced bullets deal +50% damage',
  },
  repel: {
    id: 'repel',
    name: 'REPEL',
    desc: 'Bullet curve',
    icon: '\u21ba',
    category: 'bullet',
    color: 0xe63399,
    maxLevel: 5,
    effect: 'Bullets curve away from you',
  },
  freeze: {
    id: 'freeze',
    name: 'FREEZE',
    desc: 'Slow bullets',
    icon: '\u2744',
    category: 'bullet',
    color: 0x80ccff,
    maxLevel: 5,
    effect: 'Bullets slow down near you',
  },
  shrink: {
    id: 'shrink',
    name: 'SHRINK',
    desc: 'Tiny bullets',
    icon: '\u2193',
    category: 'bullet',
    color: 0x99e699,
    maxLevel: 3,
    effect: 'Bullets get smaller near you',
  },

  // UTILITY
  calm: {
    id: 'calm',
    name: 'CALM',
    desc: 'Slow fire',
    icon: '~',
    category: 'utility',
    color: 0x8080e6,
    maxLevel: 5,
    effect: 'Enemies shoot 15% slower',
  },
  chaos: {
    id: 'chaos',
    name: 'CHAOS',
    desc: 'Bad aim',
    icon: '?',
    category: 'utility',
    color: 0xe69933,
    maxLevel: 5,
    effect: 'Enemy bullets spread randomly',
  },
};

export class CardSystem {
  active: boolean = false;
  choices: CardDefinition[] = [];
  selectedIndex: number = 0;
  animTimer: number = 0;
  levels: CardLevels;

  constructor() {
    this.levels = {
      heart: 0,
      tiny: 0,
      ghost: 0,
      shield: 0,
      swift: 0,
      blink: 0,
      focus: 0,
      reflect: 0,
      repel: 0,
      freeze: 0,
      shrink: 0,
      calm: 0,
      chaos: 0,
    };
  }

  reset(): void {
    this.active = false;
    this.choices = [];
    this.selectedIndex = 0;
    this.animTimer = 0;
    Object.keys(this.levels).forEach((key) => {
      this.levels[key as keyof CardLevels] = 0;
    });
  }

  getAvailableCards(): CardDefinition[] {
    const available: CardDefinition[] = [];
    for (const id in CARD_DEFINITIONS) {
      const def = CARD_DEFINITIONS[id];
      if (this.levels[id as keyof CardLevels] < def.maxLevel) {
        available.push(def);
      }
    }
    return available;
  }

  generateChoices(count: number): CardDefinition[] {
    const available = this.getAvailableCards();
    const choices: CardDefinition[] = [];

    // Shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    for (let i = 0; i < Math.min(count, available.length); i++) {
      choices.push(available[i]);
    }

    return choices;
  }

  showSelection(): boolean {
    this.choices = this.generateChoices(3);
    if (this.choices.length > 0) {
      this.active = true;
      this.selectedIndex = 0;
      this.animTimer = 0;
      return true;
    }
    return false;
  }

  selectCard(index: number): CardDefinition | null {
    if (!this.active || index < 0 || index >= this.choices.length) {
      return null;
    }

    const card = this.choices[index];
    this.levels[card.id as keyof CardLevels]++;
    this.active = false;
    this.choices = [];

    return card;
  }

  getLevel(cardId: string): number {
    return this.levels[cardId as keyof CardLevels] || 0;
  }

  update(dt: number): void {
    if (this.active) {
      this.animTimer += dt;
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
