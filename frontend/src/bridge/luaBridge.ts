// JavaScript Bridge for Lua <-> React communication
// This module handles bidirectional communication between the Love.js game and React

export interface WalletState {
  connected: boolean;
  address: string | null;
}

export interface GameData {
  characterSeed: number;
  roundId: number;
  ticketId: string | null;
}

export interface PoolData {
  balance: number;
  endTimestamp: number;
}

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}

export interface ScoreData {
  survivalTime: number;
  roundId: number;
  ticketId: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  survivalTime: number;
  score: number;
}

export interface HapticData {
  intensity: 'light' | 'medium' | 'heavy';
}

export interface PlayerStats {
  gamesPlayed: number;
  bestTime: number;
  totalSpent: number;
}

export interface RoundWinner {
  rank: number;
  address: string;
  survivalTime: number;
}

export interface PastRound {
  roundId: number;
  endTime: number;
  winners: RoundWinner[];
}

export interface OnlinePlayer {
  id: string;
  address: string;
  characterSeed: number;
  x: number;
  y: number;
}

type EventCallback = (data: unknown) => void;

interface PendingMessage {
  event: string;
  data: any;
}

class LuaBridge {
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private loveModuleRef: any = null;
  private pendingMessages: PendingMessage[] = [];

  constructor() {
    // Set up global receiver for Lua events
    (window as any).receiveFromLua = this.receiveFromLua.bind(this);

    // Expose polling function for Lua to retrieve pending messages
    (window as any).getPendingBridgeMessages = () => {
      const messages = this.pendingMessages;
      this.pendingMessages = [];
      return JSON.stringify(messages);
    };
  }

  // Initialize with Love.js module reference
  init(module: any) {
    this.loveModuleRef = module;
  }

  // Get the Love.js module (for future use)
  getModule() {
    return this.loveModuleRef;
  }

  // Send data to Lua via Emscripten filesystem bridge
  // The js global doesn't exist in Love.js, so we use the filesystem as a bridge
  sendToLua(event: string, data: any) {
    // Also queue for backward compatibility
    this.pendingMessages.push({ event, data });

    // Write to Emscripten filesystem for Love2D to read
    this.writeToFilesystem(event, data);
  }

  // Write message to Emscripten's virtual filesystem
  private writeToFilesystem(event: string, data: any, retryCount = 0) {
    const Module = (window as any).Module;

    // Debug: Log what's available on Module
    if (retryCount === 0 || retryCount === 10) {
      console.log('[Bridge] Module exists:', !!Module);
      if (Module) {
        console.log('[Bridge] Module keys:', Object.keys(Module).slice(0, 20));
        console.log('[Bridge] Module.FS:', Module.FS);
        console.log('[Bridge] Module.HEAPU8:', !!Module.HEAPU8);
      }
    }

    if (!Module?.FS) {
      if (retryCount < 100) {  // Retry for up to 10 seconds
        setTimeout(() => this.writeToFilesystem(event, data, retryCount + 1), 100);
      } else {
        console.error('[Bridge] Module.FS never became available after 10s');
        // Debug: Final dump of Module
        console.log('[Bridge] Final Module keys:', Module ? Object.keys(Module) : 'Module is null');
      }
      return;
    }

    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    console.log('[Bridge] Writing to filesystem:', message);

    // Love2D's save directory (from Lua logs: /home/web_user/love/moisture)
    const possiblePaths = [
      '/home/web_user/love/moisture/bridge_inbox.txt',  // Correct path from Lua
    ];

    let written = false;
    for (const path of possiblePaths) {
      try {
        // Ensure parent directory exists
        const dir = path.substring(0, path.lastIndexOf('/'));
        if (dir) {
          try {
            Module.FS.mkdirTree(dir);
          } catch (e) {
            // Directory might already exist
          }
        }

        Module.FS.writeFile(path, message);
        console.log('[Bridge] Successfully wrote to:', path);
        written = true;
        break;
      } catch (e) {
        // Try next path
        console.log('[Bridge] Failed to write to:', path, e);
      }
    }

    if (!written) {
      console.error('[Bridge] Could not write to any filesystem path');
      // Debug: List available directories
      try {
        console.log('[Bridge] FS root:', Module.FS.readdir('/'));
        if (Module.FS.analyzePath('/home').exists) {
          console.log('[Bridge] FS /home:', Module.FS.readdir('/home'));
        }
      } catch (e) {
        console.log('[Bridge] Could not list directories:', e);
      }
    }
  }

  // Receive events from Lua
  private receiveFromLua(event: string, data: any) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach((callback) => callback(data));
  }

  // Subscribe to events from Lua
  on(event: string, callback: EventCallback) {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);

    // Return unsubscribe function
    return () => {
      const current = this.eventListeners.get(event) || [];
      const index = current.indexOf(callback);
      if (index > -1) {
        current.splice(index, 1);
      }
    };
  }

  // Update wallet state in Lua
  setWalletState(state: WalletState) {
    this.sendToLua('walletState', state);
  }

  // Set game data after entering
  setGameData(data: GameData) {
    this.sendToLua('gameData', data);
  }

  // Update pool data
  setPoolData(data: PoolData) {
    this.sendToLua('poolData', data);
  }

  // Send chat message to Lua
  sendChatMessage(message: ChatMessage) {
    this.sendToLua('chatMessage', message);
  }

  // Send leaderboard to Lua
  setLeaderboard(entries: LeaderboardEntry[]) {
    this.sendToLua('leaderboard', entries);
  }

  // Send player stats to Lua
  setPlayerStats(stats: PlayerStats) {
    this.sendToLua('playerStats', stats);
  }

  // Send past rounds to Lua
  setPastRounds(rounds: PastRound[]) {
    this.sendToLua('pastRounds', rounds);
  }

  // Send online players to Lua
  setOnlinePlayers(players: OnlinePlayer[]) {
    this.sendToLua('onlinePlayers', players);
  }

  // Trigger game start
  startGame() {
    this.sendToLua('startGame', {});
  }

  // Trigger haptic feedback
  triggerHaptic(intensity: 'light' | 'medium' | 'heavy' = 'light') {
    if ('vibrate' in navigator) {
      const durations: Record<string, number> = {
        light: 10,
        medium: 25,
        heavy: 50,
      };
      navigator.vibrate(durations[intensity] || 10);
    }
  }
}

// Singleton instance
export const luaBridge = new LuaBridge();

// Listen for haptic events from Lua
luaBridge.on('haptic', (data: unknown) => {
  const hapticData = data as HapticData;
  luaBridge.triggerHaptic(hapticData?.intensity || 'light');
});
