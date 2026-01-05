import { useEffect, useState, useCallback } from 'react';
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

import { luaBridge } from './bridge/luaBridge';
import { verifyRun, ReplayData } from './bridge/oracle';
import { useFirebaseChat } from './hooks/useFirebaseChat';
import { useFirebaseLeaderboard } from './hooks/useFirebaseLeaderboard';
import { useFirebaseStats } from './hooks/useFirebaseStats';
import { useFirebaseRounds } from './hooks/useFirebaseRounds';
import { useFirebasePresence } from './hooks/useFirebasePresence';
import GameCanvas from './components/GameCanvas';

// Contract addresses (update after deployment)
const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '0x0';
const GAME_POOL_ID = import.meta.env.VITE_GAME_POOL_ID || '0x0';
const ORACLE_CAP_ID = import.meta.env.VITE_ORACLE_CAP_ID || '0x0';

// Entry fee in MIST (0.1 SUI = 100,000,000 MIST)
const ENTRY_FEE = 100_000_000n;

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  const [gameState, setGameState] = useState<string>('menu'); // Track Lua game state

  // Loading timeout (45 seconds - WASM files are large)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        setLoadError('Game engine failed to load. Please refresh the page.');
        setIsLoading(false);
      }
    }, 45000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // Firebase hooks
  const { messages, sendMessage } = useFirebaseChat();
  const { leaderboard, submitScore: submitLeaderboardScore } = useFirebaseLeaderboard();
  const { stats, recordGameStart, recordGameEnd } = useFirebaseStats(account?.address || null);
  const { pastRounds } = useFirebaseRounds();
  const { onlinePlayers } = useFirebasePresence(account?.address || null);

  // Toast helper
  const showToast = useCallback((message: string, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Update Lua bridge with wallet state
  useEffect(() => {
    luaBridge.setWalletState({
      connected: !!account,
      address: account?.address || null,
    });
  }, [account]);

  // Sync chat messages to Lua
  useEffect(() => {
    messages.forEach((msg) => {
      luaBridge.sendChatMessage(msg);
    });
  }, [messages]);

  // Sync leaderboard to Lua
  useEffect(() => {
    if (leaderboard.length > 0) {
      luaBridge.setLeaderboard(leaderboard.map(entry => ({
        rank: entry.rank || 0,
        address: entry.address,
        survivalTime: entry.survivalTime,
        score: entry.score,
      })));
    }
  }, [leaderboard]);

  // Sync player stats to Lua
  useEffect(() => {
    luaBridge.setPlayerStats({
      gamesPlayed: stats.gamesPlayed,
      bestTime: stats.bestTime,
      totalSpent: stats.totalSpent,
    });
  }, [stats]);

  // Sync past rounds to Lua
  useEffect(() => {
    if (pastRounds.length > 0) {
      luaBridge.setPastRounds(pastRounds.map(round => ({
        roundId: round.roundId,
        endTime: round.endTime,
        winners: round.winners.map(w => ({
          rank: w.rank,
          address: w.address,
          survivalTime: w.survivalTime,
        })),
      })));
    }
  }, [pastRounds]);

  // Sync online players to Lua
  useEffect(() => {
    luaBridge.setOnlinePlayers(onlinePlayers.map(player => ({
      id: player.id,
      address: player.address,
      characterSeed: player.characterSeed,
      x: player.x,
      y: player.y,
    })));
  }, [onlinePlayers]);

  // Prevent browser gestures (pinch zoom, pull-to-refresh, edge swipes)
  useEffect(() => {
    // Prevent pinch-to-zoom
    const preventPinchZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Prevent pull-to-refresh (only on canvas, not UI elements)
    const preventPullToRefresh = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Only prevent on canvas, allow clicks on buttons and other UI
      if (target.tagName === 'CANVAS' && window.scrollY === 0 && e.touches.length === 1) {
        e.preventDefault();
      }
    };

    // Prevent double-tap zoom
    let lastTap = 0;
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
      }
      lastTap = now;
    };

    // Prevent edge swipe navigation (iOS Safari) - only on canvas
    const preventEdgeSwipe = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'CANVAS') return; // Allow UI elements
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

  // Fetch pool data periodically
  useEffect(() => {
    const fetchPoolData = async () => {
      if (GAME_POOL_ID === '0x0') return;

      try {
        const pool = await client.getObject({
          id: GAME_POOL_ID,
          options: { showContent: true },
        });

        if (pool.data?.content && 'fields' in pool.data.content) {
          const fields = pool.data.content.fields as any;
          luaBridge.setPoolData({
            balance: Number(fields.balance) || 0,
            endTimestamp: Number(fields.end_timestamp) || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch pool data:', error);
      }
    };

    fetchPoolData();
    const interval = setInterval(fetchPoolData, 10000);
    return () => clearInterval(interval);
  }, [client]);

  // Handle enter game request from Lua
  useEffect(() => {
    const unsubscribe = luaBridge.on('requestEnterGame', async () => {
      if (!account) {
        showToast('Please connect your wallet first', 'error');
        return;
      }

      try {
        const tx = new Transaction();

        // Split coin for entry fee
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(ENTRY_FEE)]);

        // Call enter_game
        tx.moveCall({
          target: `${PACKAGE_ID}::game_core::enter_game`,
          arguments: [
            tx.object(GAME_POOL_ID),
            coin,
            tx.object('0x6'), // Clock object
          ],
        });

        signAndExecute(
          { transaction: tx as any },
          {
            onSuccess: async (result: any) => {
              showToast('Entered the game!', 'success');

              // Find the created PlayerTicket
              const createdObjects = result.effects?.created || [];
              const ticketObj = createdObjects.find((obj: any) => obj.owner && 'AddressOwner' in obj.owner);

              if (ticketObj) {
                setPendingTicketId(ticketObj.reference.objectId);

                // Generate character seed from address
                const seed = parseInt(account.address.slice(2, 18), 16);

                luaBridge.setGameData({
                  characterSeed: seed,
                  roundId: 1, // Would come from pool data
                  ticketId: ticketObj.reference.objectId,
                });

                // Record game start in Firebase stats
                recordGameStart();

                luaBridge.startGame();
                setIsPlaying(true);
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
    });

    return unsubscribe;
  }, [account, signAndExecute, showToast, recordGameStart]);

  // Note: Wallet connect is now handled by showing the real ConnectButton on menu screen
  // The Lua game no longer draws its own CONNECT WALLET button

  // Handle score submission from Lua
  useEffect(() => {
    const unsubscribe = luaBridge.on('submitScore', async (data: any) => {
      if (!account || !pendingTicketId) {
        console.error('Cannot submit score: missing account or ticket');
        return;
      }

      setIsPlaying(false);

      // Submit to Firebase leaderboard (always, regardless of blockchain success)
      submitLeaderboardScore(
        account.address,
        data.survivalTime,
        Math.floor(data.survivalTime / 10), // Simple score calculation
        data.roundId
      );

      // Record game end (update best time if applicable)
      recordGameEnd(data.survivalTime);

      // Create replay data for oracle verification
      const replayData: ReplayData = {
        playerId: account.address,
        roundId: data.roundId,
        survivalTime: data.survivalTime,
        events: [{ timestamp: data.survivalTime, type: 'death', data: {} }],
        checksum: '', // Would be computed from actual game data
      };

      try {
        const verification = await verifyRun(replayData);

        if (verification.valid && verification.signature) {
          const tx = new Transaction();

          tx.moveCall({
            target: `${PACKAGE_ID}::game_core::submit_score`,
            arguments: [
              tx.object(GAME_POOL_ID),
              tx.object(ORACLE_CAP_ID),
              tx.object(pendingTicketId),
              tx.pure.u64(data.survivalTime),
              tx.pure.vector('u8', Array.from(verification.signature)),
            ],
          });

          signAndExecute(
            { transaction: tx as any },
            {
              onSuccess: () => {
                showToast(`Score submitted: ${(data.survivalTime / 1000).toFixed(2)}s`, 'success');
                setPendingTicketId(null);
              },
              onError: (error: any) => {
                showToast(`Failed to submit score: ${error.message}`, 'error');
              },
            }
          );
        } else {
          showToast('Score verification failed', 'error');
        }
      } catch (error) {
        showToast(`Verification error: ${error}`, 'error');
      }
    });

    return unsubscribe;
  }, [account, pendingTicketId, signAndExecute, showToast, submitLeaderboardScore, recordGameEnd]);

  // Handle chat from Lua
  useEffect(() => {
    const unsubscribe = luaBridge.on('sendChat', async (data: any) => {
      if (data.message && account) {
        await sendMessage(account.address, data.message);
      }
    });

    return unsubscribe;
  }, [account, sendMessage]);

  // Track game state from Lua
  useEffect(() => {
    const unsubscribe = luaBridge.on('gameStateChanged', (data: any) => {
      if (data.state) {
        setGameState(data.state);
      }
    });

    return unsubscribe;
  }, []);

  // Handle emergency exit
  const handleExit = useCallback(() => {
    if (isPlaying) {
      // Would trigger death in Lua
      setIsPlaying(false);
      showToast('Exited game', 'info');
    }
  }, [isPlaying, showToast]);

  // Dismiss toast
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
          <p className="loading-text">Loading game engine...</p>
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
      <GameCanvas onLoad={() => { setIsLoading(false); setLoadError(null); }} />

      {/* Wallet connect button - centered on menu screen when not connected */}
      {!account && gameState === 'menu' && !isLoading && !loadError && (
        <div className="overlay wallet-overlay menu-center">
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

      {/* Emergency exit button */}
      {isPlaying && (
        <div className="overlay exit-overlay">
          <button className="exit-button" onClick={handleExit}>
            EXIT (ESC)
          </button>
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
