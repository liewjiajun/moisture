// FontSystem.ts - Bitmap font loading and management

import Phaser from 'phaser';

export const FONT_KEYS = {
  SMALL: 'pixel-8',
  MEDIUM: 'pixel-12',
  LARGE: 'pixel-16',
} as const;

export type FontKey = typeof FONT_KEYS[keyof typeof FONT_KEYS];

/**
 * Preload all bitmap fonts in a scene
 * Call this in the preload() method of your first scene (e.g., BootScene)
 */
export function preloadFonts(scene: Phaser.Scene): void {
  scene.load.bitmapFont(
    FONT_KEYS.SMALL,
    '/assets/fonts/pixel-8.png',
    '/assets/fonts/pixel-8.xml'
  );
  scene.load.bitmapFont(
    FONT_KEYS.MEDIUM,
    '/assets/fonts/pixel-12.png',
    '/assets/fonts/pixel-12.xml'
  );
  scene.load.bitmapFont(
    FONT_KEYS.LARGE,
    '/assets/fonts/pixel-16.png',
    '/assets/fonts/pixel-16.xml'
  );
}

/**
 * Get the appropriate font key for a given pixel size
 */
export function getFontKey(size: number): FontKey {
  if (size <= 8) return FONT_KEYS.SMALL;
  if (size <= 12) return FONT_KEYS.MEDIUM;
  return FONT_KEYS.LARGE;
}
