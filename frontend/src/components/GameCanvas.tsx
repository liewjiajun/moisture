import { useEffect, useRef } from 'react';
import { luaBridge } from '../bridge/luaBridge';

interface GameCanvasProps {
  onLoad: () => void;
}

declare global {
  interface Window {
    Module: any;
    Love: any;
    INITIAL_WALLET_STATE?: {
      connected: boolean;
      address: string | null;
      characterSeed: number;
    };
  }
}

function GameCanvas({ onLoad }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    // Global error handlers to catch JavaScript-level errors
    window.onerror = (msg, source, lineno, colno, error) => {
      console.error('[GLOBAL ERROR]', msg, 'at', source, ':', lineno, ':', colno);
      if (error?.stack) {
        console.error('[GLOBAL ERROR STACK]', error.stack);
      }
      return false;
    };

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
    });

    // v25: Override window.alert to catch Love.js/Emscripten errors
    // Love.js uses alert() internally for errors, which creates ugly popups on mobile
    window.alert = (message: string) => {
      console.error('[ALERT INTERCEPTED]', message);

      // Gather diagnostic info
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      const webglInfo = gl ? {
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
      } : null;

      const diagnostics = `
        WebGL: ${webglInfo ? 'Available' : 'NOT AVAILABLE'}
        ${webglInfo ? `Version: ${webglInfo.version}` : ''}
        ${webglInfo ? `Renderer: ${webglInfo.renderer}` : ''}
        User Agent: ${navigator.userAgent.substring(0, 100)}...
      `.trim();

      // Show as styled error instead of popup
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="color: #ff6b6b; padding: 20px; text-align: center; font-family: monospace;">
            <h3 style="margin-bottom: 10px;">Game Error</h3>
            <p style="margin-bottom: 8px; font-size: 12px; word-break: break-word;">${message}</p>
            <pre style="margin-top: 12px; font-size: 10px; text-align: left; background: #1a1a1a; padding: 10px; border-radius: 4px; white-space: pre-wrap; word-break: break-all;">${diagnostics}</pre>
            <p style="margin-top: 16px; font-size: 12px; opacity: 0.5;">Try using a regular browser like Chrome or Safari</p>
          </div>
        `;
      }
      // Still call onLoad to prevent infinite loading state
      onLoad();
    };

    // v25: Helper to show error message in container
    const showError = (title: string, message: string, details?: string) => {
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div style="color: #ff6b6b; padding: 20px; text-align: center; font-family: monospace;">
            <h3 style="margin-bottom: 10px;">${title}</h3>
            <p style="margin-bottom: 8px;">${message}</p>
            ${details ? `<p style="font-size: 11px; opacity: 0.6; word-break: break-all;">${details}</p>` : ''}
            <p style="margin-top: 16px; font-size: 12px; opacity: 0.5;">Try refreshing or use a different browser</p>
          </div>
        `;
      }
    };

    const loadLoveJS = async () => {
      try {
        console.log('[GameCanvas v25] Starting initialization...');

        // v25: Check WebGL availability - ABORT if not available
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (gl) {
          console.log('[WebGL] Available:', gl.getParameter(gl.VERSION));
          console.log('[WebGL] Vendor:', gl.getParameter(gl.VENDOR));
          console.log('[WebGL] Renderer:', gl.getParameter(gl.RENDERER));
        } else {
          console.error('[WebGL] NOT available - cannot run game');
          showError('WebGL Not Supported', 'Your browser does not support WebGL graphics.', 'This game requires WebGL to run.');
          onLoad();
          return; // v25: Don't proceed without WebGL
        }

        // Create canvas element with explicit dimensions
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas';

        // Set explicit pixel dimensions (will be scaled by CSS)
        // Love2D game is 450x800 (portrait)
        canvas.width = 450;
        canvas.height = 800;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
        canvas.style.display = 'block';
        canvas.oncontextmenu = (e) => e.preventDefault();

        // Handle WebGL context loss
        canvas.addEventListener('webglcontextlost', (e) => {
          console.error('WebGL context lost');
          e.preventDefault();
        }, false);

        if (containerRef.current) {
          containerRef.current.appendChild(canvas);
        }

        // v25: Build Module.arguments with wallet state (safer validation)
        // This is passed to Lua's `arg` table at Emscripten C level (no JS FFI needed!)
        const walletState = window.INITIAL_WALLET_STATE || {
          connected: false,
          address: null,
          characterSeed: Date.now() % 999999999,
        };

        console.log('[GameCanvas v26] Wallet state:', walletState);

        // v26: Don't pass wallet info via arguments - it breaks on iOS
        // Just pass minimal args, Lua will use Bridge.characterSeed default
        const args: string[] = ['./'];

        // Only pass seed (short number), not address (long string that breaks iOS)
        if (walletState.characterSeed && typeof walletState.characterSeed === 'number') {
          args.push('--seed');
          args.push(String(Math.floor(walletState.characterSeed)));
        }

        console.log('[GameCanvas v26] Module.arguments:', args);

        // Configure Love.js Module
        window.Module = {
          canvas,
          arguments: args,  // v23: Pass wallet state via args!
          INITIAL_MEMORY: 67108864,

          // Tell Emscripten where to find game files (game.data, love.wasm)
          locateFile: (path: string) => {
            return '/game/' + path;
          },
          printErr: (text: string) => {
            console.error('Love.js error:', text);
          },
          print: (text: string) => {
            console.log('Love.js:', text);
          },

          setStatus: (text: string) => {
            console.log('Love.js status:', text);
            // When status is empty or indicates running, game is loaded
            if (!text || text === '' || text.includes('Running')) {
              console.log('Game loaded, calling onLoad');
              setTimeout(() => {
                luaBridge.init(window.Module);
                onLoad();
              }, 500);
            }
          },

          totalDependencies: 0,
          remainingDependencies: 0,
          monitorRunDependencies: function(left: number) {
            this.remainingDependencies = left;
            this.totalDependencies = Math.max(this.totalDependencies, left);
            console.log(`Dependencies: ${this.totalDependencies - left}/${this.totalDependencies}`);
            if (left === 0 && this.totalDependencies > 0) {
              window.Module.setStatus('');
            }
          },

          onRuntimeInitialized: () => {
            console.log('[GameCanvas v25] Love.js runtime initialized');
            // v25: Wallet state passed via Module.arguments - Lua reads from arg table
            try {
              (window as any).Module.calledRun = true;
            } catch (e) {
              console.error('[GameCanvas v25] Error in onRuntimeInitialized:', e);
            }
          },

          // v25: Enhanced error handlers to catch WASM/Emscripten errors
          onAbort: (what: any) => {
            console.error('[LOVE.JS ABORT]', what);
            showError('Game Engine Aborted', 'The game engine encountered a fatal error.', String(what));
          },

          quit: (status: number, toThrow: any) => {
            console.error('[LOVE.JS QUIT] status:', status, 'error:', toThrow);
            if (status !== 0) {
              showError('Game Quit Unexpectedly', `Exit status: ${status}`, String(toThrow));
            }
          },
        };

        // Load game.js first (sets up data file loader)
        // Add cache-busting to ensure fresh files are loaded
        const cacheBuster = Date.now();
        console.log('[GameCanvas v25] Loading game.js...');
        const gameScript = document.createElement('script');
        gameScript.src = `/game/game.js?v=${cacheBuster}`;

        gameScript.onerror = (e) => {
          console.error('Failed to load game.js:', e);
          showError('Failed to Load Game', 'Could not load game.js file.', 'Check network connection.');
          onLoad();
        };

        // Load love.js after game.js
        gameScript.onload = () => {
          console.log('game.js loaded, now loading love.js...');

          const loveScript = document.createElement('script');
          loveScript.src = `/game/love.js?v=${cacheBuster}`;

          loveScript.onload = () => {
            console.log('[GameCanvas v25] love.js loaded');
            if (typeof window.Love === 'function') {
              console.log('[GameCanvas v25] Calling Love(Module)...');
              try {
                window.Love(window.Module);
              } catch (e) {
                console.error('[GameCanvas v25] Error calling Love():', e);
                // v25: Show user-visible error
                const existingCanvas = document.getElementById('canvas');
                if (existingCanvas) existingCanvas.remove();
                showError('Game Engine Error', 'Failed to start game engine.', String(e));
                onLoad();
              }
            } else {
              console.error('[GameCanvas v25] Love is not a function:', typeof window.Love);
              showError('Game Engine Error', 'Love.js not loaded properly.', `Type: ${typeof window.Love}`);
              onLoad();
            }
          };

          loveScript.onerror = (e) => {
            console.error('[GameCanvas v25] Failed to load love.js:', e);
            showError('Failed to Load Game', 'Could not load love.js file.', 'Check network connection.');
            onLoad();
          };

          document.body.appendChild(loveScript);
        };

        document.body.appendChild(gameScript);
      } catch (error) {
        console.error('[GameCanvas v25] Failed to load Love.js:', error);
        showError('Initialization Error', 'Failed to initialize game.', String(error));
        onLoad();
      }
    };

    loadLoveJS();
  }, [onLoad]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
      }}
    />
  );
}

export default GameCanvas;
