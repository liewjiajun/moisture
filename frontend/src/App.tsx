import { useEffect, useState, useCallback } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

// Oracle verification disabled for testnet MVP
// import { verifyRun, ReplayData } from './bridge/oracle';
import { useFirebaseChat } from './hooks/useFirebaseChat';
import { useFirebaseLeaderboard } from './hooks/useFirebaseLeaderboard';
import { useFirebaseStats } from './hooks/useFirebaseStats';
import { useFirebaseRounds } from './hooks/useFirebaseRounds';
import { useFirebasePresence } from './hooks/useFirebasePresence';
import GameCanvas from './components/GameCanvas';
import { GameState, WalletState } from './game/types';

// Contract addresses (update after deployment)
const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x0';
const GAME_POOL_ID = import.meta.env.VITE_GAME_POOL_ID || '0x0';
const ORACLE_CAP_ID = import.meta.env.VITE_ORACLE_CAP_ID || '0x0';

// Entry fee in MIST (0.1 SUI = 100,000,000 MIST)
const ENTRY_FEE = 100_000_000n;

// Generate deterministic character seed from wallet address
function generateSeedFromAddress(address: string): number {
  // Use first 16 hex chars after 0x prefix
  const hexPart = address.slice(2, 18);
  return parseInt(hexPart, 16) % 999999999;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  const [gameState, setGameState] = useState<GameState>('menu');

  // Wallet state for Phaser
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    address: null,
    characterSeed: Date.now() + Math.floor(Math.random() * 999999),
  });

  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Firebase hooks
  const { messages: chatMessages, sendMessage: sendChatMessage } = useFirebaseChat();
  const { leaderboard, submitScore: submitLeaderboardScore } = useFirebaseLeaderboard();
  const { recordGameStart, recordGameEnd } = useFirebaseStats(account?.address || null);
  const { roundInfo } = useFirebaseRounds();
  const { onlineCount } = useFirebasePresence(account?.address || null);

  // Toast helper
  const showToast = useCallback((message: string, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Update wallet state when account changes
  useEffect(() => {
    if (account) {
      setWalletState({
        connected: true,
        address: account.address,
        characterSeed: generateSeedFromAddress(account.address),
      });
    } else {
      setWalletState((prev) => ({
        ...prev,
        connected: false,
        address: null,
      }));
    }
  }, [account]);

  // Prevent browser gestures (pinch zoom, pull-to-refresh, edge swipes)
  useEffect(() => {
    const preventPinchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventPullToRefresh = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'CANVAS' && window.scrollY === 0 && e.touches.length === 1) {
        e.preventDefault();
      }
    };

    let lastTap = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
      }
      lastTap = now;
    };

    const preventEdgeSwipe = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'CANVAS') return;
      const touch = e.touches[0];
      const edgeThreshold = 30;
      if (touch.clientX < edgeThreshold || touch.clientX > window.innerWidth - edgeThreshold) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchmove', preventPinchZoom, { passive: false });
    document.addEventListener('touchstart', preventPullToRefresh, { passive: false });
    document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
    document.addEventListener('touchstart', preventEdgeSwipe, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventPinchZoom);
      document.removeEventListener('touchstart', preventPullToRefresh);
      document.removeEventListener('touchend', preventDoubleTapZoom);
      document.removeEventListener('touchstart', preventEdgeSwipe);
    };
  }, []);

  // Handle game state changes from Phaser
  const handleGameStateChanged = useCallback((state: GameState) => {
    console.log('[App] Game state changed:', state);
    setGameState(state);

    if (state === 'game') {
      setIsPlaying(true);
    } else if (state === 'death' || state === 'lounge' || state === 'menu') {
      setIsPlaying(false);
    }
  }, []);

  // Handle score submission from Phaser
  const handleScoreSubmit = useCallback(async (survivalTimeMs: number) => {
    console.log('[App] Score submit:', survivalTimeMs);

    if (!account || !pendingTicketId) {
      console.log('[App] Score submitted (Firebase only - no wallet transaction)');
      // Still submit to Firebase leaderboard
      if (account) {
        submitLeaderboardScore(
          account.address,
          survivalTimeMs,
          Math.floor(survivalTimeMs / 10),
          1 // Round ID
        );
        recordGameEnd(survivalTimeMs);
      }
      return;
    }

    // Submit to Firebase leaderboard
    submitLeaderboardScore(
      account.address,
      survivalTimeMs,
      Math.floor(survivalTimeMs / 10),
      1
    );
    recordGameEnd(survivalTimeMs);

    // Submit to blockchain (testnet MVP - no oracle verification)
    try {
      const tx = new Transaction();

      tx.moveCall({
        target: `${PACKAGE_ID}::game_core::submit_score`,
        arguments: [
          tx.object(GAME_POOL_ID),
          tx.object(ORACLE_CAP_ID),
          tx.object(pendingTicketId),
          tx.pure.u64(survivalTimeMs),
        ],
      });

      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: () => {
            showToast(`Score submitted: ${(survivalTimeMs / 1000).toFixed(2)}s`, 'success');
            setPendingTicketId(null);
          },
          onError: (error: any) => {
            showToast(`Failed to submit score: ${error.message}`, 'error');
          },
        }
      );
    } catch (error) {
      showToast(`Transaction error: ${error}`, 'error');
    }
  }, [account, pendingTicketId, signAndExecute, showToast, submitLeaderboardScore, recordGameEnd]);

  // Handle wallet connect request from Phaser
  const handleRequestWalletConnect = useCallback(() => {
    console.log('[App] Wallet connect requested by game');
    // The ConnectButton is always available in the UI
    showToast('Please connect your wallet using the button above', 'info');
  }, [showToast]);

  // Handle enter game request from Phaser (blockchain transaction)
  const handleRequestEnterGame = useCallback(async () => {
    console.log('[App] Enter game requested');

    if (!account) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      const tx = new Transaction();

      const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(ENTRY_FEE)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::game_core::enter_game`,
        arguments: [
          tx.object(GAME_POOL_ID),
          coin,
          tx.object('0x6'),
        ],
      });

      signAndExecute(
        { transaction: tx as any },
        {
          onSuccess: async (result: any) => {
            showToast('Entered the game!', 'success');

            const createdObjects = result.effects?.created || [];
            const ticketObj = createdObjects.find((obj: any) => obj.owner && 'AddressOwner' in obj.owner);

            if (ticketObj) {
              setPendingTicketId(ticketObj.reference.objectId);
              recordGameStart();

              // Trigger game start in Phaser
              if ((window as any).enterMoistureGame) {
                (window as any).enterMoistureGame(false);
              }
            }
          },
          onError: (error: any) => {
            showToast(`Failed to enter game: ${error.message}`, 'error');
          },
        }
      );
    } catch (error) {
      showToast(`Transaction error: ${error}`, 'error');
    }
  }, [account, signAndExecute, showToast, recordGameStart]);

  // Dismiss toast
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Handle game loaded
  const handleGameLoaded = useCallback(() => {
    console.log('[App] Game loaded');
    setIsLoading(false);
    setLoadError(null);
  }, []);

  // Retry loading
  const handleRetry = useCallback(() => {
    setLoadError(null);
    setIsLoading(true);
    window.location.reload();
  }, []);

  return (
    <div className="game-container">
      {/* Loading screen */}
      {isLoading && (
        <div className="loading-screen">
          <h1 className="loading-title">MOISTURE</h1>
          <p className="loading-text">Loading game...</p>
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
        </div>
      )}

      {/* Error screen */}
      {loadError && (
        <div className="loading-screen error-screen">
          <h1 className="loading-title error">ERROR</h1>
          <p className="loading-text">{loadError}</p>
          <button className="retry-button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      )}

      {/* Game canvas */}
      <GameCanvas
        onLoad={handleGameLoaded}
        walletState={walletState}
        chatMessages={chatMessages}
        leaderboard={leaderboard}
        roundInfo={roundInfo ? {
          timeRemaining: roundInfo.timeRemaining || 0,
          prizePool: roundInfo.prizePool || 0,
          onlineCount: onlineCount || 0,
        } : undefined}
        onGameStateChanged={handleGameStateChanged}
        onScoreSubmit={handleScoreSubmit}
        onRequestWalletConnect={handleRequestWalletConnect}
        onRequestEnterGame={handleRequestEnterGame}
        onSendChatMessage={(msg) => sendChatMessage(account?.address || 'Guest', msg)}
      />

      {/* Connect wallet button - visible on menu */}
      {gameState === 'menu' && !account && (
        <div className="overlay wallet-overlay">
          <ConnectButton />
        </div>
      )}

      {/* Connected wallet indicator */}
      {account && !isPlaying && (
        <div className="overlay wallet-indicator">
          <span className="wallet-address">
            {account.address.slice(0, 6)}...{account.address.slice(-4)}
          </span>
        </div>
      )}

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.slice(0, 3).map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
            <button className="toast-dismiss" onClick={() => dismissToast(toast.id)}>
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
