// GameScene - Main gameplay scene
// Ported from Love2D main.lua

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, getRandomEnemyType, getShootRate } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet';
import { CardSystem } from '../systems/CardSystem';
import { UpgradeSystem } from '../systems/UpgradeSystem';
import { AudioSystem, initAudioSystem } from '../systems/AudioSystem';
import { FONT_KEYS } from '../systems/FontSystem';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class GameScene extends Phaser.Scene {
  // Game dimensions (pixel-perfect)
  static readonly GAME_WIDTH = 180;
  static readonly GAME_HEIGHT = 320;

  // Game state
  player!: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  cardSystem!: CardSystem;
  upgradeSystem!: UpgradeSystem;

  // Graphics objects
  playerGraphics!: Phaser.GameObjects.Graphics;
  enemyGraphics!: Phaser.GameObjects.Graphics;
  bulletGraphics!: Phaser.GameObjects.Graphics;
  particleGraphics!: Phaser.GameObjects.Graphics;
  uiGraphics!: Phaser.GameObjects.Graphics;
  cardOverlay!: Phaser.GameObjects.Graphics;

  // HUD text objects (BitmapText for pixel-perfect rendering)
  timeText!: Phaser.GameObjects.BitmapText;
  scoreText!: Phaser.GameObjects.BitmapText;
  cardTimerText!: Phaser.GameObjects.BitmapText;
  humidityText!: Phaser.GameObjects.BitmapText;

  // Card selection text objects (3 cards max)
  cardNameTexts: Phaser.GameObjects.BitmapText[] = [];
  cardDescTexts: Phaser.GameObjects.BitmapText[] = [];
  cardLevelTexts: Phaser.GameObjects.BitmapText[] = [];

  // Timing
  gameTime: number = 0;
  survivalTime: number = 0;
  cardTimer: number = 0;
  humidity: number = 1;
  score: number = 0;
  isPracticeGame: boolean = false;

  // Screen shake
  shakeIntensity: number = 0;
  shakeX: number = 0;
  shakeY: number = 0;

  // Touch/input
  joystickActive: boolean = false;
  joystickStartX: number = 0;
  joystickStartY: number = 0;
  joystickX: number = 0;
  joystickY: number = 0;
  touchId: number | null = null;

  // Constants
  CARD_INTERVAL = 10; // seconds between card selections
  BASE_SPEED = 55;

  // Audio
  audio!: AudioSystem;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { isPractice?: boolean; characterSeed?: number }) {
    this.isPracticeGame = data.isPractice ?? false;
    this.cardSystem = new CardSystem();
    this.upgradeSystem = new UpgradeSystem();
  }

  preload() {
    // Initialize and preload audio
    this.audio = initAudioSystem(this);
    this.audio.preload();
  }

  create() {
    // Get character seed from registry
    const characterSeed = this.registry.get('characterSeed') || Date.now();

    // Reset state
    this.gameTime = 0;
    this.survivalTime = 0;
    this.cardTimer = 0;
    this.humidity = 1;
    this.score = 0;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.shakeIntensity = 0;

    // Create player
    this.player = new Player(
      GameScene.GAME_WIDTH / 2,
      GameScene.GAME_HEIGHT / 2,
      characterSeed,
      this.upgradeSystem.getExtraHP(this.cardSystem.levels)
    );

    // Create graphics objects
    this.playerGraphics = this.add.graphics();
    this.enemyGraphics = this.add.graphics();
    this.bulletGraphics = this.add.graphics();
    this.particleGraphics = this.add.graphics();
    this.uiGraphics = this.add.graphics();
    this.cardOverlay = this.add.graphics();
    this.cardOverlay.setDepth(100);

    // Create card selection text objects (3 cards max) - BitmapText for pixel-perfect rendering
    for (let i = 0; i < 3; i++) {
      const nameText = this.add.bitmapText(0, 0, FONT_KEYS.SMALL, '')
        .setOrigin(0.5)
        .setDepth(101)
        .setVisible(false)
        .setTint(0xffffff);
      this.cardNameTexts.push(nameText);

      const descText = this.add.bitmapText(0, 0, FONT_KEYS.SMALL, '')
        .setOrigin(0.5)
        .setDepth(101)
        .setVisible(false)
        .setTint(0xcccccc)
        .setMaxWidth(46)
        .setCenterAlign();
      this.cardDescTexts.push(descText);

      const levelText = this.add.bitmapText(0, 0, FONT_KEYS.SMALL, '')
        .setOrigin(0.5)
        .setDepth(101)
        .setVisible(false)
        .setTint(0xffcc00);
      this.cardLevelTexts.push(levelText);
    }

    // Create HUD text objects
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;

    this.timeText = this.add.bitmapText(w - 23, 5, FONT_KEYS.SMALL, '0.0s')
      .setOrigin(0.5, 0)
      .setDepth(50)
      .setTint(0x4dccff);

    this.scoreText = this.add.bitmapText(w - 23, 15, FONT_KEYS.SMALL, '0')
      .setOrigin(0.5, 0)
      .setDepth(50)
      .setTint(0xffcc00);

    this.cardTimerText = this.add.bitmapText(w / 2, h - 6, FONT_KEYS.SMALL, '')
      .setOrigin(0.5)
      .setDepth(50)
      .setTint(0x4dccff);

    // Humidity indicator (shows multiplier when >= 1.5)
    this.humidityText = this.add.bitmapText(w - 22, 30, FONT_KEYS.SMALL, '1.0x')
      .setOrigin(0.5)
      .setDepth(50)
      .setVisible(false)
      .setTint(0xff6666);

    // Set up input
    this.setupInput();

    // Initial enemies
    for (let i = 0; i < 2; i++) {
      this.spawnEnemy();
    }

    // Emit state change (use registry.events for game-wide events)
    this.registry.set('gameState', 'game');
    this.registry.events.emit('gameStateChanged', 'game');
  }

  setupInput() {
    // Touch/pointer input for joystick and card selection
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Card selection mode - check for card clicks
      if (this.cardSystem.isActive()) {
        const cardIndex = this.getClickedCardIndex(pointer.x, pointer.y);
        if (cardIndex >= 0) {
          this.handleCardSelect(cardIndex);
        }
        return;
      }

      // Normal mode - joystick
      if (!this.joystickActive) {
        this.joystickActive = true;
        this.joystickStartX = pointer.x;
        this.joystickStartY = pointer.y;
        this.joystickX = 0;
        this.joystickY = 0;
        this.touchId = pointer.id;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickActive && pointer.id === this.touchId) {
        const dx = pointer.x - this.joystickStartX;
        const dy = pointer.y - this.joystickStartY;
        const maxDist = 30;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          const normDist = Math.min(dist, maxDist);
          this.joystickX = (dx / dist) * (normDist / maxDist);
          this.joystickY = (dy / dist) * (normDist / maxDist);
        }
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id === this.touchId) {
        this.joystickActive = false;
        this.joystickX = 0;
        this.joystickY = 0;
        this.touchId = null;
      }
    });

    // Keyboard - Blink (SPACE or SHIFT)
    this.input.keyboard?.on('keydown-SPACE', () => {
      this.tryBlink();
    });
    this.input.keyboard?.on('keydown-SHIFT', () => {
      this.tryBlink();
    });

    // Card selection keyboard (1, 2, 3 keys)
    this.input.keyboard?.on('keydown-ONE', () => {
      if (this.cardSystem.isActive()) this.handleCardSelect(0);
    });
    this.input.keyboard?.on('keydown-TWO', () => {
      if (this.cardSystem.isActive()) this.handleCardSelect(1);
    });
    this.input.keyboard?.on('keydown-THREE', () => {
      if (this.cardSystem.isActive()) this.handleCardSelect(2);
    });
  }

  // Helper to determine which card was clicked
  getClickedCardIndex(pointerX: number, pointerY: number): number {
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;
    const cardWidth = 50;
    const cardHeight = 70;
    const spacing = 8;
    const choices = this.cardSystem.choices;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * spacing;
    const startX = (w - totalWidth) / 2;
    const cardY = h / 2 - cardHeight / 2;

    for (let i = 0; i < choices.length; i++) {
      const cardX = startX + i * (cardWidth + spacing);
      if (
        pointerX >= cardX &&
        pointerX <= cardX + cardWidth &&
        pointerY >= cardY &&
        pointerY <= cardY + cardHeight
      ) {
        return i;
      }
    }
    return -1;
  }

  update(_time: number, delta: number) {
    const dt = delta / 1000;
    this.gameTime += dt;

    // Card selection mode
    if (this.cardSystem.isActive()) {
      this.cardSystem.update(dt);
      this.drawCardOverlay();
      return;
    }

    this.survivalTime += dt;
    this.cardTimer += dt;

    // Check for card selection
    if (this.cardTimer >= this.CARD_INTERVAL) {
      this.cardTimer = 0;
      if (this.cardSystem.showSelection()) {
        return;
      }
    }

    // Increase difficulty
    this.humidity = 1 + Math.floor(this.survivalTime / 15) * 0.15;

    // Update screen shake
    this.updateShake();

    // Get keyboard input
    let dx = this.joystickX;
    let dy = this.joystickY;

    const cursors = this.input.keyboard?.createCursorKeys();
    const wasd = this.input.keyboard?.addKeys('W,A,S,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    if (cursors?.left.isDown || wasd?.A.isDown) dx = -1;
    if (cursors?.right.isDown || wasd?.D.isDown) dx = 1;
    if (cursors?.up.isDown || wasd?.W.isDown) dy = -1;
    if (cursors?.down.isDown || wasd?.S.isDown) dy = 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    // Update player
    const speedMult = this.upgradeSystem.getSpeedMultiplier(this.cardSystem.levels);
    const speed = this.BASE_SPEED * speedMult;
    this.player.update(dt, dx, dy, speed, GameScene.GAME_WIDTH, GameScene.GAME_HEIGHT);

    // Calculate visual scale for TINY effect
    this.player.visualScale = this.upgradeSystem.getHitboxMultiplier(this.cardSystem.levels, false);

    // Update upgrade effects
    const isMoving = dx !== 0 || dy !== 0;
    const moveSpeed = Math.sqrt(dx * dx + dy * dy);
    this.upgradeSystem.update(dt, this.player.x, this.player.y, isMoving, moveSpeed, this.cardSystem.levels);

    // Update enemies
    this.updateEnemies(dt);

    // Update bullets
    this.updateBullets(dt);

    // Update particles
    this.updateParticles(dt);

    // Spawn enemies
    const spawnRate = 0.002 + this.humidity * 0.001;
    if (Math.random() < spawnRate) {
      this.spawnEnemy();
    }

    // Check collisions
    this.checkCollisions();

    // Draw everything
    this.draw();
  }

  updateShake() {
    if (this.shakeIntensity > 0) {
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.9;
      if (this.shakeIntensity <= 0.3) this.shakeIntensity = 0;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  updateEnemies(dt: number) {
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;
    const topQuarter = h * 0.25;
    const fireRateMult = this.upgradeSystem.getEnemyFireRateMultiplier(this.cardSystem.levels);
    const chaosSpread = this.upgradeSystem.getChaosSpread(this.cardSystem.levels);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (!e.alive) {
        this.enemies.splice(i, 1);
        continue;
      }

      e.update(dt);

      // Random movement
      e.moveTimer += dt;
      if (e.moveTimer > 2 || e.moveDx === 0) {
        e.moveTimer = 0;
        e.moveDx = (Math.random() - 0.5) * 2;
        e.moveDy = (Math.random() - 0.5) * 2;
      }

      const speed = e.speed * 0.3 * (1 + (this.humidity - 1) * 0.1);
      e.x += e.moveDx * speed * dt;
      e.y += e.moveDy * speed * dt;

      // Keep in bounds (top quarter)
      if (e.x < 10) { e.x = 10; e.moveDx = Math.abs(e.moveDx); }
      if (e.x > w - 10) { e.x = w - 10; e.moveDx = -Math.abs(e.moveDx); }
      if (e.y < 10) { e.y = 10; e.moveDy = Math.abs(e.moveDy); }
      if (e.y > topQuarter) { e.y = topQuarter; e.moveDy = -Math.abs(e.moveDy); }

      e.facingLeft = e.moveDx < 0;

      // Shooting
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = (e.shootRate / this.humidity) * fireRateMult;
        this.enemyShoot(e, chaosSpread);
      }

      // Remove if off screen
      if (e.x < -30 || e.x > w + 30 || e.y < -30 || e.y > h + 30) {
        this.enemies.splice(i, 1);
      }
    }
  }

  enemyShoot(enemy: Enemy, chaosSpread: number) {
    const bulletSpeed = 35 + this.humidity * 3;
    const bulletRadius = 3;

    // Calculate aim toward player
    let baseDx = this.player.x - enemy.x;
    let baseDy = this.player.y - enemy.y;
    const dist = Math.sqrt(baseDx * baseDx + baseDy * baseDy);
    if (dist > 0) {
      baseDx /= dist;
      baseDy /= dist;
    }
    let baseAngle = Math.atan2(baseDy, baseDx);

    // Apply chaos
    if (chaosSpread > 0) {
      baseAngle += (Math.random() - 0.5) * chaosSpread * 2;
    }

    const bulletsToSpawn: { angle: number; speed: number }[] = [];
    const pattern = enemy.bulletPattern;

    switch (pattern) {
      case 'spread3':
        for (let i = -1; i <= 1; i++) {
          bulletsToSpawn.push({ angle: baseAngle + i * 0.3, speed: bulletSpeed });
        }
        break;
      case 'spread5':
        for (let i = -2; i <= 2; i++) {
          bulletsToSpawn.push({ angle: baseAngle + i * 0.25, speed: bulletSpeed * 0.9 });
        }
        break;
      case 'ring':
        const numBullets = Math.min(10, 8 + Math.floor(this.humidity));
        for (let i = 0; i < numBullets; i++) {
          bulletsToSpawn.push({ angle: (i / numBullets) * Math.PI * 2, speed: bulletSpeed * 0.7 });
        }
        break;
      case 'spiral':
        enemy.spiralOffset += 0.5;
        for (let i = 0; i < 3; i++) {
          const angle = enemy.spiralOffset + (i / 3) * Math.PI * 2;
          bulletsToSpawn.push({ angle, speed: bulletSpeed * 0.8 });
        }
        break;
      case 'burst':
        for (let i = 0; i < 3; i++) {
          bulletsToSpawn.push({ angle: baseAngle, speed: bulletSpeed * (1 - i * 0.1) });
        }
        break;
      case 'wave':
        const waveOffset = Math.sin(enemy.animTime * 3) * 0.5;
        bulletsToSpawn.push({ angle: baseAngle + waveOffset, speed: bulletSpeed });
        bulletsToSpawn.push({ angle: baseAngle - waveOffset, speed: bulletSpeed });
        break;
      case 'random_spread':
        const count = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          bulletsToSpawn.push({
            angle: baseAngle + (Math.random() - 0.5) * 1.2,
            speed: bulletSpeed * (0.8 + Math.random() * 0.4),
          });
        }
        break;
      case 'aimed_double':
        bulletsToSpawn.push({ angle: baseAngle - 0.15, speed: bulletSpeed });
        bulletsToSpawn.push({ angle: baseAngle + 0.15, speed: bulletSpeed });
        break;
      default:
        bulletsToSpawn.push({ angle: baseAngle, speed: bulletSpeed });
    }

    // Create bullets
    for (const data of bulletsToSpawn) {
      this.bullets.push(new Bullet({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(data.angle) * data.speed,
        vy: Math.sin(data.angle) * data.speed,
        radius: bulletRadius,
        fromEnemy: true,
      }));
    }

    // Play shoot sound (only for some patterns to avoid spam)
    if (bulletsToSpawn.length <= 3) {
      this.audio?.playVaried('shoot', 0.3);
    }
  }

  updateBullets(dt: number) {
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;

    const repelStrength = this.upgradeSystem.getRepelStrength(this.cardSystem.levels);
    const repelRange = 30 + this.cardSystem.levels.repel * 5;
    const freezeRange = this.upgradeSystem.getFreezeRange(this.cardSystem.levels);
    const freezeStrength = this.upgradeSystem.getFreezeStrength(this.cardSystem.levels);
    const shrinkRange = this.upgradeSystem.getShrinkRange(this.cardSystem.levels);
    const shrinkAmount = this.upgradeSystem.getShrinkAmount(this.cardSystem.levels);

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      // Apply effects
      b.applyRepel(this.player.x, this.player.y, repelStrength, repelRange, dt);
      const speedMult = b.applyFreeze(this.player.x, this.player.y, freezeRange, freezeStrength);
      b.applyShrink(this.player.x, this.player.y, shrinkRange, shrinkAmount);

      // Move (with freeze slowdown)
      b.x += b.vx * speedMult * dt;
      b.y += b.vy * speedMult * dt;
      b.life -= dt;

      // Trail particles
      b.trailTimer += dt;
      if (b.trailTimer > 0.05) {
        b.trailTimer = 0;
        const color = b.getColor();
        this.spawnParticle(b.x, b.y, 0, 0, color, 0.4, 0.15);
      }

      // Bounce
      if (b.checkWallBounce(w, h)) {
        this.shakeIntensity = Math.min(this.shakeIntensity + 0.5, 3);
        this.audio?.playVaried('bounce', 0.5);
        // Bounce particles
        for (let p = 0; p < 4; p++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 20;
          this.spawnParticle(b.x, b.y, Math.cos(angle) * speed, Math.sin(angle) * speed, { r: 1, g: 0.9, b: 0.4 }, 1, 0.3);
        }
      }

      // Check if bounced bullet hits enemies
      if (b.bounces > 0) {
        for (const e of this.enemies) {
          if (e.alive && b.collidesWith(e.x, e.y, 6)) {
            const dmgMult = this.upgradeSystem.getBulletDamageMultiplier(this.cardSystem.levels, true);
            const damage = Math.ceil(b.damage * dmgMult * b.bounces);
            if (e.takeDamage(damage)) {
              this.killEnemy(e);
            } else {
              // Hit particles
              for (let p = 0; p < 3; p++) {
                const angle = Math.random() * Math.PI * 2;
                this.spawnParticle(e.x, e.y, Math.cos(angle) * 40, Math.sin(angle) * 40, { r: 1, g: 0.8, b: 0.3 }, 1, 0.3);
              }
              this.shakeIntensity = Math.min(this.shakeIntensity + 1, 4);
            }
            b.life = 0;
            break;
          }
        }
      }

      // Remove expired bullets
      if (b.isExpired()) {
        this.bullets.splice(i, 1);
      }
    }
  }

  updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt; // Gravity

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  spawnParticle(x: number, y: number, vx: number, vy: number, color: { r: number; g: number; b: number }, alpha: number, life: number) {
    this.particles.push({
      x,
      y,
      vx,
      vy,
      color: Phaser.Display.Color.GetColor(
        Math.floor(color.r * 255),
        Math.floor(color.g * 255),
        Math.floor(color.b * 255)
      ),
      alpha,
      life,
      maxLife: life,
    });
  }

  spawnEnemy() {
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;
    const topQuarter = h * 0.25;

    // Spawn from edges
    const edge = Math.floor(Math.random() * 3);
    let x: number, y: number;

    if (edge === 0) {
      x = Math.random() * w;
      y = -10;
    } else if (edge === 1) {
      x = w + 10;
      y = Math.random() * topQuarter;
    } else {
      x = -10;
      y = Math.random() * topQuarter;
    }

    const type = getRandomEnemyType(this.humidity);
    const enemy = new Enemy(x, y, type);
    enemy.shootRate = getShootRate(type) * (1.5 / this.humidity);
    this.enemies.push(enemy);

    // Spawn particles
    for (let p = 0; p < 6; p++) {
      const angle = (p / 6) * Math.PI * 2;
      this.spawnParticle(x, y, Math.cos(angle) * 25, Math.sin(angle) * 25, { r: 0.6, g: 0.3, b: 0.9 }, 0.8, 0.4);
    }
  }

  killEnemy(enemy: Enemy) {
    enemy.alive = false;
    this.score += enemy.points;

    // Death particles
    const mainColor = this.player.character.getMainColor();
    for (let p = 0; p < 8; p++) {
      const angle = (p / 8) * Math.PI * 2;
      this.spawnParticle(
        enemy.x,
        enemy.y,
        Math.cos(angle) * 50,
        Math.sin(angle) * 50,
        { r: mainColor[0] / 255, g: mainColor[1] / 255, b: mainColor[2] / 255 },
        1,
        0.5
      );
    }

    // Split if slime
    if (enemy.splits) {
      for (let s = 0; s < 2; s++) {
        const newEnemy = new Enemy(
          enemy.x + (s === 0 ? -8 : 8),
          enemy.y,
          'slime'
        );
        newEnemy.health = 1;
        newEnemy.maxHealth = 1;
        newEnemy.speed *= 1.5;
        newEnemy.shootRate = 3;
        newEnemy.points = 5;
        this.enemies.push(newEnemy);
      }
    }

    this.shakeIntensity = 3;
  }

  checkCollisions() {
    if (!this.player) return;

    const isMovingSlow = Math.sqrt(this.player.lastDx ** 2 + this.player.lastDy ** 2) < 0.5;
    const hitboxRadius = this.player.getHitboxRadius(this.cardSystem.levels, isMovingSlow);

    // Check invincibility
    if (this.upgradeSystem.isInvincible()) return;

    // Bullet-player collision
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.collidesWith(this.player.x, this.player.y, hitboxRadius)) {
        // Try shield
        if (this.upgradeSystem.tryAbsorbBullet(this.cardSystem.levels)) {
          this.spawnParticle(b.x, b.y, 0, 0, { r: 0.3, g: 0.7, b: 1 }, 1, 0.3);
          this.bullets.splice(i, 1);
        } else {
          this.bullets.splice(i, 1);
          this.playerHit();
          if (!this.player) return;
        }
      }
    }

    // Enemy-player collision
    for (const e of this.enemies) {
      if (e.alive) {
        const dx = this.player.x - e.x;
        const dy = this.player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < hitboxRadius + 5) {
          if (this.upgradeSystem.tryAbsorbBullet(this.cardSystem.levels)) {
            this.spawnParticle(this.player.x, this.player.y, 0, 0, { r: 0.3, g: 0.7, b: 1 }, 1, 0.3);
          } else {
            this.playerHit();
            if (!this.player) return;
          }
        }
      }
    }
  }

  playerHit() {
    this.shakeIntensity = 5;
    this.upgradeSystem.triggerIFrames(this.cardSystem.levels);
    this.audio?.play('hit');

    // Hit particles
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.spawnParticle(this.player.x, this.player.y, Math.cos(angle) * 50, Math.sin(angle) * 50, { r: 1, g: 0.3, b: 0.3 }, 1, 0.4);
    }

    if (this.player.takeDamage()) {
      this.playerDeath();
    }
  }

  playerDeath() {
    this.shakeIntensity = 10;
    this.audio?.play('death');

    // Death explosion
    const mainColor = this.player.character.getMainColor();
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2;
      this.spawnParticle(
        this.player.x,
        this.player.y,
        Math.cos(angle) * 70 + (Math.random() - 0.5) * 40,
        Math.sin(angle) * 70 + (Math.random() - 0.5) * 40,
        { r: mainColor[0] / 255, g: mainColor[1] / 255, b: mainColor[2] / 255 },
        1,
        1.2
      );
    }

    // Submit score if not practice
    if (!this.isPracticeGame) {
      this.registry.events.emit('scoreSubmit', Math.floor(this.survivalTime * 1000));
    }

    // Transition to death scene
    this.scene.start('DeathScene', {
      survivalTime: this.survivalTime,
      score: this.score,
      isPractice: this.isPracticeGame,
    });
  }

  tryBlink() {
    const result = this.upgradeSystem.tryBlink(
      this.cardSystem.levels,
      this.player.lastDx,
      this.player.lastDy,
      this.player.x,
      this.player.y,
      GameScene.GAME_WIDTH,
      GameScene.GAME_HEIGHT
    );

    if (result.blinked) {
      // Blink particles at old position
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        this.spawnParticle(this.player.x, this.player.y, Math.cos(angle) * 30, Math.sin(angle) * 30, { r: 1, g: 0.7, b: 0.3 }, 1, 0.3);
      }
      this.player.x = result.newX;
      this.player.y = result.newY;
      // Blink particles at new position
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        this.spawnParticle(this.player.x, this.player.y, Math.cos(angle) * 20, Math.sin(angle) * 20, { r: 1, g: 0.7, b: 0.3 }, 0.5, 0.2);
      }
    }
  }

  // Card selection
  handleCardSelect(index: number) {
    const card = this.cardSystem.selectCard(index);
    if (card) {
      this.audio?.play('pickup');
      // Apply heart effect specially
      if (card.id === 'heart') {
        this.player.setMaxHp(3 + this.cardSystem.levels.heart);
      }
      this.cardOverlay.clear();
      this.hideCardTexts();
    }
  }

  drawCardOverlay() {
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;

    this.cardOverlay.clear();

    // Dim background
    this.cardOverlay.fillStyle(0x000000, 0.7);
    this.cardOverlay.fillRect(0, 0, w, h);

    // Title
    this.cardOverlay.fillStyle(0x4dccff);
    // (would draw "CHOOSE" text here but Graphics doesn't support text)

    const cardWidth = 50;
    const cardHeight = 70;
    const spacing = 8;
    const choices = this.cardSystem.choices;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * spacing;
    const startX = (w - totalWidth) / 2;
    const cardY = h / 2 - cardHeight / 2;

    for (let i = 0; i < choices.length; i++) {
      const card = choices[i];
      const cardX = startX + i * (cardWidth + spacing);
      const cardCenterX = cardX + cardWidth / 2;
      const selected = i === this.cardSystem.selectedIndex;

      // Bounce animation
      const bounce = selected ? Math.sin(this.cardSystem.animTimer * 8) * 2 : 0;

      // Selection highlight
      if (selected) {
        this.cardOverlay.fillStyle(0xffffff);
        this.cardOverlay.fillRect(cardX - 2, cardY - 2 + bounce, cardWidth + 4, cardHeight + 4);
      }

      // Card background
      this.cardOverlay.fillStyle(0x262633);
      this.cardOverlay.fillRect(cardX, cardY + bounce, cardWidth, cardHeight);

      // Card border
      this.cardOverlay.lineStyle(2, card.color);
      this.cardOverlay.strokeRect(cardX, cardY + bounce, cardWidth, cardHeight);

      // Card icon area (colored bar at top)
      this.cardOverlay.fillStyle(card.color, 0.3);
      this.cardOverlay.fillRect(cardX + 2, cardY + 2 + bounce, cardWidth - 4, 14);

      // Draw card icon in the icon area
      this.cardOverlay.fillStyle(0xffffff, 0.9);
      // Simple icon representation using the card's first character
      const iconX = cardCenterX;
      const iconY = cardY + 9 + bounce;
      // Draw a small shape based on card category
      if (card.icon) {
        // Draw a small indicator based on card type
        this.cardOverlay.fillStyle(card.color, 0.9);
        this.cardOverlay.fillCircle(iconX, iconY, 4);
        this.cardOverlay.fillStyle(0xffffff, 0.8);
        this.cardOverlay.fillCircle(iconX, iconY, 2);
      }

      // Update text objects
      const currentLevel = this.cardSystem.getLevel(card.id);

      // Card name (moved below icon area)
      this.cardNameTexts[i].setText(card.name);
      this.cardNameTexts[i].setPosition(cardCenterX, cardY + 22 + bounce);
      this.cardNameTexts[i].setTint(card.color);
      this.cardNameTexts[i].setVisible(true);

      // Card description
      this.cardDescTexts[i].setText(card.desc);
      this.cardDescTexts[i].setPosition(cardCenterX, cardY + 40 + bounce);
      this.cardDescTexts[i].setVisible(true);

      // Card level
      const levelStr = currentLevel > 0 ? `Lv.${currentLevel}` : 'NEW';
      this.cardLevelTexts[i].setText(levelStr);
      this.cardLevelTexts[i].setPosition(cardCenterX, cardY + 60 + bounce);
      this.cardLevelTexts[i].setTint(currentLevel > 0 ? 0xffcc00 : 0x66ff66);
      this.cardLevelTexts[i].setVisible(true);
    }

    // Hide unused text objects
    for (let i = choices.length; i < 3; i++) {
      this.cardNameTexts[i]?.setVisible(false);
      this.cardDescTexts[i]?.setVisible(false);
      this.cardLevelTexts[i]?.setVisible(false);
    }
  }

  hideCardTexts() {
    for (let i = 0; i < 3; i++) {
      this.cardNameTexts[i]?.setVisible(false);
      this.cardDescTexts[i]?.setVisible(false);
      this.cardLevelTexts[i]?.setVisible(false);
    }
  }

  draw() {
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;

    // Apply shake
    this.cameras.main.setScroll(-this.shakeX, -this.shakeY);

    // Draw background
    this.uiGraphics.clear();
    const dangerTint = Math.min(0.15, (this.humidity - 1) * 0.03);
    for (let y = 0; y < h; y += 8) {
      const gradAlpha = (y / h) * 0.1 + dangerTint;
      this.uiGraphics.fillStyle(
        Phaser.Display.Color.GetColor(
          Math.floor((0.1 + dangerTint) * 255),
          0,
          Math.floor((0.05 + dangerTint * 0.5) * 255)
        ),
        gradAlpha
      );
      this.uiGraphics.fillRect(0, y, w, 8);
    }

    // Grid
    this.uiGraphics.lineStyle(1, 0x2b1a33, 0.1);
    for (let x = 0; x < w; x += 16) {
      this.uiGraphics.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += 16) {
      this.uiGraphics.lineBetween(0, y, w, y);
    }

    // Draw particles
    this.particleGraphics.clear();
    for (const p of this.particles) {
      const alpha = (p.life / p.maxLife) * p.alpha;
      this.particleGraphics.fillStyle(p.color, alpha);
      this.particleGraphics.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, 2, 2);
    }

    // Draw enemies
    this.enemyGraphics.clear();
    for (const e of this.enemies) {
      if (e.alive) {
        // Spawn effect glow
        if (e.spawnEffect > 0) {
          const glow = e.spawnEffect / 0.5;
          this.enemyGraphics.fillStyle(0x9933ff, 0.3 + glow * 0.5);
          this.enemyGraphics.fillCircle(e.x, e.y, 8 + glow * 6);
        }
        e.draw(this.enemyGraphics);

        // Health bar (only show when damaged)
        if (e.health < e.maxHealth) {
          const barWidth = 10;
          const hpPct = e.health / e.maxHealth;
          // Background
          this.enemyGraphics.fillStyle(0x000000, 0.6);
          this.enemyGraphics.fillRect(e.x - barWidth / 2, e.y - 14, barWidth, 3);
          // Health fill
          this.enemyGraphics.fillStyle(0xff3333);
          this.enemyGraphics.fillRect(e.x - barWidth / 2, e.y - 14, barWidth * hpPct, 3);
        }
      }
    }

    // Draw bullets
    this.bulletGraphics.clear();
    for (const b of this.bullets) {
      b.draw(this.bulletGraphics);
    }

    // Draw player
    if (this.player) {
      this.playerGraphics.clear();

      // Draw upgrade effect auras (behind player)
      this.drawUpgradeEffects();

      // Invincibility flash
      if (this.upgradeSystem.isInvincible()) {
        const alpha = 0.4 + Math.sin(this.gameTime * 15) * 0.3;
        this.playerGraphics.setAlpha(alpha);
      } else {
        this.playerGraphics.setAlpha(1);
      }

      this.player.draw(this.playerGraphics);
    }

    // Draw HUD
    this.drawHUD();
  }

  drawUpgradeEffects() {
    const px = this.player.x;
    const py = this.player.y;
    const levels = this.cardSystem.levels;

    // FREEZE effect - blue range circle
    if (levels.freeze > 0) {
      const freezeRange = this.upgradeSystem.getFreezeRange(levels);
      const pulse = 0.15 + Math.sin(this.gameTime * 2) * 0.05;
      this.playerGraphics.fillStyle(0x66ccff, pulse);
      this.playerGraphics.fillCircle(px, py, freezeRange);
      this.playerGraphics.lineStyle(1, 0x66ccff, 0.4);
      this.playerGraphics.strokeCircle(px, py, freezeRange);
    }

    // REPEL effect - pulsing ring
    if (levels.repel > 0) {
      const repelRange = 30 + levels.repel * 5;
      const pulsePhase = this.upgradeSystem.repelPulse;
      const ringRadius = repelRange + Math.sin(pulsePhase) * 3;
      const alpha = 0.3 + Math.sin(pulsePhase * 2) * 0.15;
      this.playerGraphics.lineStyle(2, 0xff9933, alpha);
      this.playerGraphics.strokeCircle(px, py, ringRadius);
      // Inner pulse ring
      const innerRadius = ringRadius * 0.6 + Math.sin(pulsePhase * 1.5) * 2;
      this.playerGraphics.lineStyle(1, 0xff9933, alpha * 0.5);
      this.playerGraphics.strokeCircle(px, py, innerRadius);
    }

    // SHIELD effect - glow when ready, dim when recharging
    if (levels.shield > 0) {
      if (this.upgradeSystem.shieldReady) {
        // Ready - cyan glow
        const glowPulse = 0.4 + Math.sin(this.gameTime * 4) * 0.2;
        this.playerGraphics.fillStyle(0x00ffff, glowPulse);
        this.playerGraphics.fillCircle(px, py, 12);
        this.playerGraphics.lineStyle(2, 0x00ffff, 0.8);
        this.playerGraphics.strokeCircle(px, py, 14);
      } else if (this.upgradeSystem.shieldFlash > 0) {
        // Just absorbed - bright flash
        const flashAlpha = this.upgradeSystem.shieldFlash / 0.3;
        this.playerGraphics.fillStyle(0x00ffff, flashAlpha * 0.6);
        this.playerGraphics.fillCircle(px, py, 20 + (1 - flashAlpha) * 10);
      } else {
        // Recharging - dim gray indicator
        const shieldCooldown = 10 - levels.shield * 2;
        const rechargePct = Math.min(1, this.upgradeSystem.shieldTimer / shieldCooldown);
        this.playerGraphics.lineStyle(1, 0x666666, 0.3);
        this.playerGraphics.strokeCircle(px, py, 12);
        // Progress arc
        if (rechargePct > 0) {
          this.playerGraphics.lineStyle(2, 0x00cccc, 0.5);
          this.playerGraphics.beginPath();
          this.playerGraphics.arc(px, py, 12, -Math.PI / 2, -Math.PI / 2 + rechargePct * Math.PI * 2);
          this.playerGraphics.strokePath();
        }
      }
    }
  }

  drawHUD() {
    const w = GameScene.GAME_WIDTH;
    const h = GameScene.GAME_HEIGHT;

    // Update HUD text values
    this.timeText.setText(this.survivalTime.toFixed(1) + 's');
    this.scoreText.setText(this.score.toString());

    // Time and score (top right)
    this.uiGraphics.fillStyle(0x000000, 0.5);
    this.uiGraphics.fillRoundedRect(w - 45, 2, 43, 24, 3);
    this.uiGraphics.lineStyle(1, 0x4dccff, 0.4);
    this.uiGraphics.strokeRoundedRect(w - 45, 2, 43, 24, 3);

    // HP hearts (bottom left)
    for (let i = 0; i < this.player.maxHp; i++) {
      const hx = 4 + i * 12;
      const hy = h - 14;
      const lowHpFlash = this.player.hp <= 1 ? (0.7 + Math.sin(this.gameTime * 8) * 0.3) : 1;

      // Shadow
      this.uiGraphics.fillStyle(0x000000, 0.3);
      this.uiGraphics.fillCircle(hx + 4.5, hy + 6, 5);

      if (i < this.player.hp) {
        // Filled heart
        this.uiGraphics.fillStyle(
          Phaser.Display.Color.GetColor(Math.floor(255 * lowHpFlash), 77, 77),
          1
        );
        this.uiGraphics.fillCircle(hx + 2, hy + 3, 3);
        this.uiGraphics.fillCircle(hx + 5, hy + 3, 3);
        this.uiGraphics.fillTriangle(hx, hy + 4, hx + 7, hy + 4, hx + 3.5, hy + 9);
      } else {
        // Empty heart
        this.uiGraphics.fillStyle(0x404040, 0.6);
        this.uiGraphics.fillCircle(hx + 2, hy + 3, 3);
        this.uiGraphics.fillCircle(hx + 5, hy + 3, 3);
        this.uiGraphics.fillTriangle(hx, hy + 4, hx + 7, hy + 4, hx + 3.5, hy + 9);
      }
    }

    // Card timer (bottom center)
    const cardPct = this.cardTimer / this.CARD_INTERVAL;
    this.uiGraphics.fillStyle(0x000000, 0.4);
    this.uiGraphics.fillRoundedRect(w / 2 - 28, h - 10, 56, 8, 2);

    const timerPulse = cardPct > 0.8 ? (0.8 + Math.sin(this.gameTime * 6) * 0.2) : 1;
    this.uiGraphics.fillStyle(
      Phaser.Display.Color.GetColor(
        Math.floor(0.3 * timerPulse * 255),
        Math.floor(0.85 * timerPulse * 255),
        Math.floor(timerPulse * 255)
      ),
      0.9
    );
    this.uiGraphics.fillRoundedRect(w / 2 - 27, h - 9, 54 * cardPct, 6, 2);

    this.uiGraphics.lineStyle(1, 0x66b3e6, 0.6);
    this.uiGraphics.strokeRoundedRect(w / 2 - 28, h - 10, 56, 8, 2);

    // Humidity indicator (shows value when >= 1.5)
    if (this.humidity >= 1.5) {
      const pulse = this.humidity >= 2 ? (0.6 + Math.sin(this.gameTime * 8) * 0.4) : 1;
      this.humidityText.setText(this.humidity.toFixed(1) + 'x');
      this.humidityText.setVisible(true);
      this.humidityText.setAlpha(pulse);
      // Color gradient from yellow to red based on humidity
      const danger = Math.min(1, (this.humidity - 1.5) / 1.5);
      this.humidityText.setTint(Phaser.Display.Color.GetColor(
        255,
        Math.floor(200 - danger * 150),
        Math.floor(100 - danger * 100)
      ));
    } else {
      this.humidityText.setVisible(false);
    }
  }
}
