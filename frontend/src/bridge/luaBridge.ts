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
    // Try multiple possible locations for FS
    const Module = (window as any).Module;
    const FS = Module?.FS || (window as any).FS;

    // Debug on first and 10th retry
    if (retryCount === 0 || retryCount === 10) {
      console.log('[Bridge v16] Looking for FS...');
      console.log('[Bridge v16] Module:', !!Module);
      console.log('[Bridge v16] Module.FS:', !!Module?.FS);
      console.log('[Bridge v16] window.FS:', !!(window as any).FS);
      if (Module) {
        const keys = Object.keys(Module);
        console.log('[Bridge v16] Module has', keys.length, 'keys');
        console.log('[Bridge v16] Module keys (first 30):', keys.slice(0, 30).join(', '));
      }
    }

    if (!FS) {
      if (retryCount < 100) {
        setTimeout(() => this.writeToFilesystem(event, data, retryCount + 1), 100);
      } else {
        console.error('[Bridge v16] FS never became available after 10s');
        if (Module) {
          console.log('[Bridge v16] Final Module keys:', Object.keys(Module).join(', '));
        }
      }
      return;
    }

    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    console.log('[Bridge v16] FS found! Writing:', message);

    try {
      // Create directory if needed
      try { FS.mkdir('/home'); } catch (e) {}
      try { FS.mkdir('/home/web_user'); } catch (e) {}
      try { FS.mkdir('/home/web_user/love'); } catch (e) {}
      try { FS.mkdir('/home/web_user/love/moisture'); } catch (e) {}

      FS.writeFile('/home/web_user/love/moisture/bridge_inbox.txt', message);
      console.log('[Bridge v16] Successfully wrote to filesystem!');
    } catch (e) {
      console.error('[Bridge v16] Failed to write:', e);
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
