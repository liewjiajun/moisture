// Bullet Entity - Ported from Lua
// Handles bullet physics including bouncing

export interface BulletConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage?: number;
  radius?: number;
  maxBounces?: number;
  fromEnemy?: boolean;
}

export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSpeed: number;
  life: number = 10;
  bounces: number = 0;
  maxBounces: number;
  radius: number;
  currentRadius: number;
  damage: number;
  fromEnemy: boolean;
  trailTimer: number = 0;

  constructor(config: BulletConfig) {
    this.x = config.x;
    this.y = config.y;
    this.vx = config.vx;
    this.vy = config.vy;
    this.baseSpeed = Math.sqrt(config.vx * config.vx + config.vy * config.vy);
    this.damage = config.damage ?? 1;
    this.radius = config.radius ?? 3;
    this.currentRadius = this.radius;
    this.maxBounces = config.maxBounces ?? 2;
    this.fromEnemy = config.fromEnemy ?? true;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.trailTimer += dt;
  }

  // Check wall collision and bounce
  checkWallBounce(screenWidth: number, screenHeight: number): boolean {
    let bounced = false;

    if (this.x < 4) {
      this.x = 4;
      this.vx = -this.vx;
      bounced = true;
    } else if (this.x > screenWidth - 4) {
      this.x = screenWidth - 4;
      this.vx = -this.vx;
      bounced = true;
    }

    if (this.y < 4) {
      this.y = 4;
      this.vy = -this.vy;
      bounced = true;
    } else if (this.y > screenHeight - 4) {
      this.y = screenHeight - 4;
      this.vy = -this.vy;
      bounced = true;
    }

    if (bounced) {
      this.bounces++;
    }

    return bounced;
  }

  // Apply repel effect (curve away from player)
  applyRepel(playerX: number, playerY: number, repelStrength: number, repelRange: number, dt: number): void {
    if (repelStrength <= 0) return;

    const dx = this.x - playerX;
    const dy = this.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < repelRange && dist > 0) {
      const force = repelStrength * (1 - dist / repelRange) * dt;
      this.vx += (dx / dist) * force;
      this.vy += (dy / dist) * force;

      // Normalize speed
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > this.baseSpeed * 1.5) {
        this.vx = (this.vx / speed) * this.baseSpeed;
        this.vy = (this.vy / speed) * this.baseSpeed;
      }
    }
  }

  // Apply freeze effect (slow down near player)
  applyFreeze(playerX: number, playerY: number, freezeRange: number, freezeStrength: number): number {
    if (freezeRange <= 0) return 1;

    const dx = this.x - playerX;
    const dy = this.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < freezeRange) {
      return 1 - freezeStrength * (1 - dist / freezeRange);
    }
    return 1;
  }

  // Apply shrink effect
  applyShrink(playerX: number, playerY: number, shrinkRange: number, shrinkAmount: number): void {
    if (shrinkRange <= 0) {
      this.currentRadius = this.radius;
      return;
    }

    const dx = this.x - playerX;
    const dy = this.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < shrinkRange) {
      const mult = 1 - shrinkAmount * (1 - dist / shrinkRange);
      this.currentRadius = this.radius * Math.max(0.3, mult);
    } else {
      this.currentRadius = this.radius;
    }
  }

  // Get color based on bounce count
  getColor(): { r: number; g: number; b: number } {
    if (this.bounces === 0) {
      return { r: 1, g: 0.3, b: 0.3 }; // Red = dangerous
    } else if (this.bounces === 1) {
      return { r: 1, g: 0.8, b: 0.3 }; // Orange = 1 bounce
    } else {
      return { r: 0.3, g: 1, b: 0.5 }; // Green = friendly
    }
  }

  // Check if bullet is expired
  isExpired(): boolean {
    return this.life <= 0 || this.bounces > this.maxBounces;
  }

  // Check collision with a circle
  collidesWith(x: number, y: number, radius: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < radius + this.currentRadius;
  }

  // Draw bullet with glow effect
  draw(graphics: Phaser.GameObjects.Graphics): void {
    const color = this.getColor();
    const hex = Phaser.Display.Color.GetColor(
      Math.floor(color.r * 255),
      Math.floor(color.g * 255),
      Math.floor(color.b * 255)
    );

    // Outer glow
    graphics.fillStyle(hex, 0.15);
    graphics.fillCircle(this.x, this.y, this.currentRadius * 2);

    // Middle glow
    graphics.fillStyle(hex, 0.4);
    graphics.fillCircle(this.x, this.y, this.currentRadius * 1.3);

    // Core
    graphics.fillStyle(hex, 1);
    graphics.fillCircle(this.x, this.y, this.currentRadius);

    // Highlight center
    graphics.fillStyle(0xffffff, 0.8);
    graphics.fillCircle(this.x, this.y, this.currentRadius * 0.35);
  }
}
