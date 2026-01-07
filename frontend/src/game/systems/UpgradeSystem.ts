// Upgrade Effects System - Ported from Lua
// Handles all active upgrade effects during gameplay

import { CardLevels } from '../types';

export class UpgradeSystem {
  // Shield
  shieldTimer: number = 0;
  shieldReady: boolean = false;
  shieldFlash: number = 0;

  // Blink
  blinkCooldown: number = 0;
  blinkReady: boolean = false;

  // Invincibility frames
  iFrames: number = 0;

  // Focus detection
  moveSpeed: number = 0;

  // Visual effects
  repelPulse: number = 0;
  freezeRadius: number = 0;

  reset(): void {
    this.shieldTimer = 0;
    this.shieldReady = false;
    this.shieldFlash = 0;
    this.blinkCooldown = 0;
    this.blinkReady = false;
    this.iFrames = 0;
    this.moveSpeed = 0;
    this.repelPulse = 0;
    this.freezeRadius = 0;
  }

  update(dt: number, _playerX: number, _playerY: number, _isMoving: boolean, moveSpeed: number, levels: CardLevels): void {
    // Shield recharge
    if (levels.shield > 0) {
      const shieldCooldown = 10 - levels.shield * 2; // 8s, 6s, 4s
      this.shieldTimer += dt;
      if (this.shieldTimer >= shieldCooldown) {
        this.shieldReady = true;
      }
      if (this.shieldFlash > 0) {
        this.shieldFlash -= dt;
      }
    }

    // Blink recharge
    if (levels.blink > 0) {
      // Blink cooldown: 4s, 3s, 2s based on level
      if (this.blinkCooldown > 0) {
        this.blinkCooldown -= dt;
      }
      this.blinkReady = this.blinkCooldown <= 0;
    }

    // I-frames countdown
    if (this.iFrames > 0) {
      this.iFrames -= dt;
    }

    // Focus tracking
    this.moveSpeed = moveSpeed;

    // Visual pulses
    if (levels.repel > 0) {
      this.repelPulse += dt * 3;
    }
    if (levels.freeze > 0) {
      this.freezeRadius = 25 + levels.freeze * 10;
    }
  }

  // Defense helpers
  getHitboxMultiplier(levels: CardLevels, isMovingSlow: boolean): number {
    let mult = 1.0;

    // Tiny upgrade
    if (levels.tiny > 0) {
      mult -= levels.tiny * 0.15; // 15% per level
    }

    // Focus upgrade
    if (levels.focus > 0 && isMovingSlow) {
      mult -= levels.focus * 0.15;
    }

    return Math.max(0.25, mult); // Minimum 25% size
  }

  getIFrameDuration(levels: CardLevels): number {
    let base = 0.5;
    if (levels.ghost > 0) {
      base += levels.ghost * 0.3; // +0.3s per level
    }
    return base;
  }

  tryAbsorbBullet(levels: CardLevels): boolean {
    if (levels.shield > 0 && this.shieldReady) {
      this.shieldReady = false;
      this.shieldTimer = 0;
      this.shieldFlash = 0.3;
      return true;
    }
    return false;
  }

  isInvincible(): boolean {
    return this.iFrames > 0;
  }

  triggerIFrames(levels: CardLevels): void {
    this.iFrames = this.getIFrameDuration(levels);
  }

  // Movement helpers
  getSpeedMultiplier(levels: CardLevels): number {
    return 1 + levels.swift * 0.15; // 15% per level
  }

  tryBlink(
    levels: CardLevels,
    dx: number,
    dy: number,
    playerX: number,
    playerY: number,
    screenW: number,
    screenH: number
  ): { blinked: boolean; newX: number; newY: number } {
    if (levels.blink > 0 && this.blinkReady) {
      this.blinkReady = false;
      this.blinkCooldown = 5 - levels.blink;

      // Blink distance
      const dist = 25 + levels.blink * 10; // 35, 45, 55 pixels

      // Normalize direction
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        dx /= len;
        dy /= len;
      } else {
        dx = 0;
        dy = -1; // Default up
      }

      let newX = playerX + dx * dist;
      let newY = playerY + dy * dist;

      // Clamp to screen
      newX = Math.max(8, Math.min(screenW - 8, newX));
      newY = Math.max(8, Math.min(screenH - 8, newY));

      return { blinked: true, newX, newY };
    }
    return { blinked: false, newX: playerX, newY: playerY };
  }

  // Bullet manipulation helpers
  getBulletDamageMultiplier(levels: CardLevels, hasBounced: boolean): number {
    if (hasBounced && levels.reflect > 0) {
      return 1 + levels.reflect * 0.5; // +50% per level
    }
    return 1;
  }

  getRepelStrength(levels: CardLevels): number {
    return levels.repel * 15; // Repel force per level
  }

  getFreezeRange(levels: CardLevels): number {
    if (levels.freeze > 0) {
      return 25 + levels.freeze * 10;
    }
    return 0;
  }

  getFreezeStrength(levels: CardLevels): number {
    return levels.freeze * 0.15; // 15% slow per level
  }

  getShrinkRange(levels: CardLevels): number {
    if (levels.shrink > 0) {
      return 40 + levels.shrink * 15;
    }
    return 0;
  }

  getShrinkAmount(levels: CardLevels): number {
    return levels.shrink * 0.25; // 25% smaller per level
  }

  // Utility helpers
  getEnemyFireRateMultiplier(levels: CardLevels): number {
    return 1 + levels.calm * 0.15;
  }

  getChaosSpread(levels: CardLevels): number {
    return levels.chaos * 0.2; // Radians
  }

  getExtraHP(levels: CardLevels): number {
    return levels.heart;
  }
}
