// Phaser Game Entry Point
// React bridge for Moisture game

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LoungeScene } from './scenes/LoungeScene';
import { CountdownScene } from './scenes/CountdownScene';
import { GameScene } from './scenes/GameScene';
import { DeathScene } from './scenes/DeathScene';
import { GameState, WalletState } from './types';

// Game dimensions (pixel-perfect portrait)
export const GAME_WIDTH = 180;
export const GAME_HEIGHT = 320;
export const DISPLAY_WIDTH = 450;
export const DISPLAY_HEIGHT = 800;

export interface GameBridgeCallbacks {
  onGameStateChanged?: (state: GameState) => void;
  onScoreSubmit?: (score: number) => void;
  onRequestWalletConnect?: () => void;
  onRequestEnterGame?: () => void;
}

export class MoistureGame {
  private game: Phaser.Game | null = null;
  private callbacks: GameBridgeCallbacks = {};

  constructor(parentElement: HTMLElement, callbacks?: GameBridgeCallbacks) {
    this.callbacks = callbacks || {};
    this.initialize(parentElement);
  }

  private initialize(parent: HTMLElement) {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      parent,
      backgroundColor: '#000000',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        zoom: 2, // Explicit 2x zoom for crisp pixels
      },
      scene: [BootScene, MenuScene, LoungeScene, CountdownScene, GameScene, DeathScene],
      input: {
        touch: {
          capture: true,
        },
      },
      render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true,
      },
    };

    this.game = new Phaser.Game(config);

    // Set up event listeners from game
    this.game.events.on('ready', () => {
      this.setupEventListeners();
    });
  }

  private setupEventListeners() {
    if (!this.game) return;

    // Listen to registry events
    this.game.registry.events.on('gameStateChanged', (state: GameState) => {
      if (this.callbacks.onGameStateChanged) {
        this.callbacks.onGameStateChanged(state);
      }
    });

    this.game.registry.events.on('scoreSubmit', (score: number) => {
      if (this.callbacks.onScoreSubmit) {
        this.callbacks.onScoreSubmit(score);
      }
    });

    this.game.registry.events.on('requestWalletConnect', () => {
      if (this.callbacks.onRequestWalletConnect) {
        this.callbacks.onRequestWalletConnect();
      }
    });

    this.game.registry.events.on('requestEnterGame', () => {
      if (this.callbacks.onRequestEnterGame) {
        this.callbacks.onRequestEnterGame();
      }
    });
  }

  // React can call these methods to update game state
  setWalletState(state: WalletState): void {
    if (!this.game) return;

    this.game.registry.set('walletConnected', state.connected);
    this.game.registry.set('walletAddress', state.address);

    // Update character seed if we have an address
    if (state.connected && state.address) {
      // Generate seed from address
      let seed = 0;
      for (let i = 0; i < state.address.length; i++) {
        seed = ((seed * 33) + state.address.charCodeAt(i)) % 2147483648;
      }
      this.game.registry.set('characterSeed', seed);
    } else if (state.characterSeed) {
      this.game.registry.set('characterSeed', state.characterSeed);
    }
  }

  // Allow external trigger to enter game (after blockchain transaction)
  enterGame(isPractice: boolean = false): void {
    if (!this.game) return;

    // Get the current scene and switch to countdown
    const currentScene = this.game.scene.getScenes(true)[0];
    if (currentScene) {
      currentScene.scene.start('CountdownScene', { isPractice });
    }
  }

  // Get current game state
  getGameState(): GameState | null {
    if (!this.game) return null;
    return this.game.registry.get('gameState') as GameState;
  }

  // Clean up
  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }
}

// Export for use in React
export type { GameState, WalletState };
export { Character } from './entities/Character';
export { CARD_DEFINITIONS } from './systems/CardSystem';
