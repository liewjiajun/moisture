// Player Entity - Ported from Lua

import { Character } from './Character';
import { CardLevels } from '../types';

export class Player {
  x: number;
  y: number;
  facingLeft: boolean = false;
  hp: number;
  maxHp: number;
  lastDx: number = 0;
  lastDy: number = 0;
  visualScale: number = 1;
  character: Character;

  constructor(x: number, y: number, seed: number | string, extraHP: number = 0) {
    this.x = x;
    this.y = y;
    this.maxHp = 3 + extraHP;
    this.hp = this.maxHp;
    this.character = new Character(seed);
  }

  update(dt: number, dx: number, dy: number, speed: number, screenWidth: number, screenHeight: number): void {
    // Move
    this.x += dx * speed * dt;
    this.y += dy * speed * dt;

    // Clamp to screen
    this.x = Math.max(8, Math.min(screenWidth - 8, this.x));
    this.y = Math.max(8, Math.min(screenHeight - 8, this.y));

    // Update character animation
    const isMoving = dx !== 0 || dy !== 0;
    this.character.update(dt, isMoving);

    // Facing direction
    if (dx !== 0) {
      this.facingLeft = dx < 0;
    }

    // Store movement for blink
    this.lastDx = dx;
    this.lastDy = dy;
  }

  takeDamage(): boolean {
    this.hp--;
    return this.hp <= 0;
  }

  heal(amount: number = 1): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  setMaxHp(maxHp: number): void {
    const hpDiff = maxHp - this.maxHp;
    this.maxHp = maxHp;
    if (hpDiff > 0) {
      this.hp += hpDiff;
    }
  }

  getHitboxRadius(levels: CardLevels, isMovingSlow: boolean): number {
    let mult = 1.0;

    // Tiny upgrade
    if (levels.tiny > 0) {
      mult -= levels.tiny * 0.15;
    }

    // Focus upgrade
    if (levels.focus > 0 && isMovingSlow) {
      mult -= levels.focus * 0.15;
    }

    return 4 * Math.max(0.25, mult);
  }

  draw(graphics: Phaser.GameObjects.Graphics, scale: number = 1): void {
    this.character.draw(graphics, this.x, this.y, scale * this.visualScale, this.facingLeft);
  }
}
