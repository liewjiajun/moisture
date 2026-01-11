import { useEffect, useRef, useCallback } from 'react';
import { MoistureGame, GameState, WalletState } from '../game';
import { ChatMessage, LeaderboardEntry } from '../game/types';

interface GameCanvasProps {
  onLoad: () => void;
  walletState?: WalletState;
  chatMessages?: ChatMessage[];
  leaderboard?: LeaderboardEntry[];
  roundInfo?: { timeRemaining: number; prizePool: number; onlineCount: number };
  onGameStateChanged?: (state: GameState) => void;
  onScoreSubmit?: (score: number) => void;
  onRequestWalletConnect?: () => void;
  onRequestEnterGame?: () => void;
  onSendChatMessage?: (message: string) => void;
}

function GameCanvas({
  onLoad,
  walletState,
  chatMessages,
  leaderboard,
  roundInfo,
  onGameStateChanged,
  onScoreSubmit,
  onRequestWalletConnect,
  onRequestEnterGame,
  onSendChatMessage,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<MoistureGame | null>(null);
  const loadedRef = useRef(false);

  // Initialize game
  useEffect(() => {
    if (loadedRef.current || !containerRef.current) return;
    loadedRef.current = true;

    console.log('[GameCanvas] Initializing Phaser game...');

    try {
      gameRef.current = new MoistureGame(containerRef.current, {
        onGameStateChanged: (state) => {
          console.log('[GameCanvas] Game state changed:', state);
          onGameStateChanged?.(state);
        },
        onScoreSubmit: (score) => {
          console.log('[GameCanvas] Score submit:', score);
          onScoreSubmit?.(score);
        },
        onRequestWalletConnect: () => {
          console.log('[GameCanvas] Wallet connect requested');
          onRequestWalletConnect?.();
        },
        onRequestEnterGame: () => {
          console.log('[GameCanvas] Enter game requested');
          onRequestEnterGame?.();
        },
      });

      // Expose game globally for debugging
      (window as unknown as { __MOISTURE_GAME__: MoistureGame }).__MOISTURE_GAME__ = gameRef.current;

      // Game is loaded once Phaser is ready
      setTimeout(() => {
        console.log('[GameCanvas] Game loaded');
        onLoad();
      }, 100);
    } catch (error) {
      console.error('[GameCanvas] Failed to initialize game:', error);
      onLoad(); // Still call onLoad to prevent infinite loading
    }

    // Cleanup
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy();
        gameRef.current = null;
      }
      loadedRef.current = false; // Reset for StrictMode remount
    };
  }, [onLoad, onGameStateChanged, onScoreSubmit, onRequestWalletConnect, onRequestEnterGame]);

  // Update wallet state when it changes
  useEffect(() => {
    if (gameRef.current && walletState) {
      console.log('[GameCanvas] Updating wallet state:', walletState);
      gameRef.current.setWalletState(walletState);
    }
  }, [walletState]);

  // Update chat messages when they change
  useEffect(() => {
    if (gameRef.current && chatMessages) {
      gameRef.current.setChatMessages(chatMessages);
    }
  }, [chatMessages]);

  // Update leaderboard when it changes
  useEffect(() => {
    if (gameRef.current && leaderboard) {
      gameRef.current.setLeaderboard(leaderboard);
    }
  }, [leaderboard]);

  // Update round info when it changes
  useEffect(() => {
    if (gameRef.current && roundInfo) {
      gameRef.current.setRoundInfo(roundInfo);
    }
  }, [roundInfo]);

  // Store sendChatMessage callback for Phaser to call
  useEffect(() => {
    if (onSendChatMessage) {
      (window as any).__MOISTURE_SEND_CHAT__ = onSendChatMessage;
    }
    return () => {
      delete (window as any).__MOISTURE_SEND_CHAT__;
    };
  }, [onSendChatMessage]);

  // Expose method to enter game (called after blockchain transaction)
  const enterGame = useCallback((isPractice: boolean = false) => {
    if (gameRef.current) {
      gameRef.current.enterGame(isPractice);
    }
  }, []);

  // Expose on window for external access if needed
  useEffect(() => {
    (window as any).enterMoistureGame = enterGame;
    return () => {
      delete (window as any).enterMoistureGame;
    };
  }, [enterGame]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
      }}
    />
  );
}

export default GameCanvas;
