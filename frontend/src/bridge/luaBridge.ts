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

class LuaBridge {
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private loveModuleRef: any = null;

  constructor() {
    // Set up global receiver for Lua events
    (window as any).receiveFromLua = this.receiveFromLua.bind(this);
  }

  // Initialize with Love.js module reference
  init(module: any) {
    this.loveModuleRef = module;
  }

  // Get the Love.js module (for future use)
  getModule() {
    return this.loveModuleRef;
  }

  // Send data to Lua
  sendToLua(event: string, data: any) {
    if ((window as any).luaBridge) {
      const bridge = (window as any).luaBridge;

      switch (event) {
        case 'walletState':
          bridge.setWalletState(data.connected, data.address || '');
          break;
        case 'gameData':
          bridge.setGameData(data.characterSeed, data.roundId, data.ticketId || '');
          break;
        case 'poolData':
          bridge.setPoolData(data.balance, data.endTimestamp);
          break;
        case 'chatMessage':
          bridge.addChatMessage(data.sender, data.message, data.timestamp);
          break;
        case 'leaderboard':
          if (bridge.setLeaderboard) {
            bridge.setLeaderboard(JSON.stringify(data));
          }
          break;
        case 'playerStats':
          if (bridge.setPlayerStats) {
            bridge.setPlayerStats(data.gamesPlayed, data.bestTime, data.totalSpent);
          }
          break;
        case 'pastRounds':
          if (bridge.setPastRounds) {
            bridge.setPastRounds(JSON.stringify(data));
          }
          break;
        case 'onlinePlayers':
          if (bridge.setOnlinePlayers) {
            bridge.setOnlinePlayers(JSON.stringify(data));
          }
          break;
        case 'startGame':
          bridge.startGame();
          break;
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
