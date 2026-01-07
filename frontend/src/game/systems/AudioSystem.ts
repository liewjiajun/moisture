// AudioSystem - Sound effects manager for Phaser 3
// Wraps Phaser's audio manager with graceful fallbacks

export type SoundName =
  | 'shoot'
  | 'bounce'
  | 'hit'
  | 'death'
  | 'pickup'
  | 'countdown'
  | 'go'
  | 'click'
  | 'door'
  | 'chat';

interface SoundConfig {
  key: string;
  path: string;
  defaultVolume: number;
}

const SOUNDS: Record<SoundName, SoundConfig> = {
  shoot: { key: 'shoot', path: 'assets/sounds/shoot.wav', defaultVolume: 0.3 },
  bounce: { key: 'bounce', path: 'assets/sounds/bounce.wav', defaultVolume: 0.5 },
  hit: { key: 'hit', path: 'assets/sounds/hit.wav', defaultVolume: 0.8 },
  death: { key: 'death', path: 'assets/sounds/death.wav', defaultVolume: 1.0 },
  pickup: { key: 'pickup', path: 'assets/sounds/pickup.wav', defaultVolume: 0.6 },
  countdown: { key: 'countdown', path: 'assets/sounds/countdown.wav', defaultVolume: 0.7 },
  go: { key: 'go', path: 'assets/sounds/go.wav', defaultVolume: 0.8 },
  click: { key: 'click', path: 'assets/sounds/click.wav', defaultVolume: 0.4 },
  door: { key: 'door', path: 'assets/sounds/door.wav', defaultVolume: 0.5 },
  chat: { key: 'chat', path: 'assets/sounds/chat.wav', defaultVolume: 0.3 },
};

export class AudioSystem {
  private scene: Phaser.Scene;
  private loaded: Set<string> = new Set();
  private masterVolume: number = 1.0;
  private muted: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // Preload all sounds - call in scene.preload()
  preload(): void {
    for (const [name, config] of Object.entries(SOUNDS)) {
      try {
        this.scene.load.audio(config.key, config.path);
        this.loaded.add(name);
      } catch (e) {
        console.warn(`[AudioSystem] Failed to queue ${name}:`, e);
      }
    }
  }

  // Play a sound by name
  play(name: SoundName, volumeMultiplier: number = 1.0): void {
    if (this.muted) return;

    const config = SOUNDS[name];
    if (!config) {
      console.warn(`[AudioSystem] Unknown sound: ${name}`);
      return;
    }

    try {
      const volume = config.defaultVolume * volumeMultiplier * this.masterVolume;
      this.scene.sound.play(config.key, { volume });
    } catch (e) {
      // Graceful fallback - sound file might not exist
      // This is expected if sound files haven't been added yet
    }
  }

  // Play with random pitch variation (for variety)
  playVaried(name: SoundName, volumeMultiplier: number = 1.0): void {
    if (this.muted) return;

    const config = SOUNDS[name];
    if (!config) return;

    try {
      const volume = config.defaultVolume * volumeMultiplier * this.masterVolume;
      const rate = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
      this.scene.sound.play(config.key, { volume, rate });
    } catch (e) {
      // Graceful fallback
    }
  }

  // Play with specific pitch (rate: 0.5 = half speed/lower, 2.0 = double speed/higher)
  playWithPitch(name: SoundName, pitch: number, volumeMultiplier: number = 1.0): void {
    if (this.muted) return;

    const config = SOUNDS[name];
    if (!config) return;

    try {
      const volume = config.defaultVolume * volumeMultiplier * this.masterVolume;
      this.scene.sound.play(config.key, { volume, rate: pitch });
    } catch (e) {
      // Graceful fallback
    }
  }

  // Set master volume (0.0 to 1.0)
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  // Toggle mute
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  // Check if a sound was loaded
  isLoaded(name: SoundName): boolean {
    return this.loaded.has(name);
  }
}

// Singleton instance for global access
let globalAudioSystem: AudioSystem | null = null;

export function initAudioSystem(scene: Phaser.Scene): AudioSystem {
  globalAudioSystem = new AudioSystem(scene);
  return globalAudioSystem;
}

export function getAudioSystem(): AudioSystem | null {
  return globalAudioSystem;
}
