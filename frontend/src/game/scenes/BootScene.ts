// BootScene - Asset preloading before game starts

import Phaser from 'phaser';
import { preloadFonts } from '../systems/FontSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Preload bitmap fonts
    preloadFonts(this);

    // Show loading progress (optional)
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Simple loading text
    this.add.text(width / 2, height / 2, 'Loading...', {
      fontSize: '8px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  create() {
    // Transition to menu scene
    this.scene.start('MenuScene');
  }
}
