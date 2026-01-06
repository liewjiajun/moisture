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

    const loadLoveJS = async () => {
      try {
        // Check WebGL availability first
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (gl) {
          console.log('[WebGL] Available:', gl.getParameter(gl.VERSION));
          console.log('[WebGL] Vendor:', gl.getParameter(gl.VENDOR));
          console.log('[WebGL] Renderer:', gl.getParameter(gl.RENDERER));
        } else {
          console.error('[WebGL] NOT available - game will fail!');
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

        // Configure Love.js Module
        window.Module = {
          canvas,
          arguments: ['./'],
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
            console.log('[GameCanvas v21] Love.js runtime initialized');

            // v21: Try multiple ways to access FS with retry logic
            const writeInitState = () => {
              // Try multiple ways to access Emscripten FS
              let fs: any = null;

              // Check global FS (Emscripten default export)
              if (typeof (window as any).FS !== 'undefined') {
                fs = (window as any).FS;
                console.log('[GameCanvas v21] Found global window.FS');
              }
              // Check Module.FS
              else if ((window as any).Module?.FS) {
                fs = (window as any).Module.FS;
                console.log('[GameCanvas v21] Found Module.FS');
              }

              if (!fs) {
                console.log('[GameCanvas v21] FS not ready, retrying in 100ms...');
                setTimeout(writeInitState, 100);
                return;
              }

              const initialState = window.INITIAL_WALLET_STATE || {
                connected: false,
                address: null,
                characterSeed: Date.now() % 999999999,
              };

              console.log('[GameCanvas v21] Writing initial state to FS:', initialState);

              try {
                const stateJson = JSON.stringify(initialState);
                fs.writeFile('/bridge_init.json', stateJson);
                console.log('[GameCanvas v21] Successfully wrote /bridge_init.json');
              } catch (e) {
                console.error('[GameCanvas v21] Write failed, retrying:', e);
                setTimeout(writeInitState, 100);
              }
            };

            // Start attempting to write
            writeInitState();

            // Mark that Love.js is ready
            (window as any).Module.calledRun = true;
          },

          // Error handlers to catch WASM/Emscripten errors
          onAbort: (what: any) => {
            console.error('[LOVE.JS ABORT]', what);
          },

          quit: (status: number, toThrow: any) => {
            console.error('[LOVE.JS QUIT] status:', status, 'error:', toThrow);
          },
        };

        // Load game.js first (sets up data file loader)
        // Add cache-busting to ensure fresh files are loaded
        const cacheBuster = Date.now();
        console.log('[v19] Loading game.js...');
        const gameScript = document.createElement('script');
        gameScript.src = `/game/game.js?v=${cacheBuster}`;

        gameScript.onerror = (e) => {
          console.error('Failed to load game.js:', e);
          setTimeout(onLoad, 1000);
        };

        // Load love.js after game.js
        gameScript.onload = () => {
          console.log('game.js loaded, now loading love.js...');

          const loveScript = document.createElement('script');
          loveScript.src = `/game/love.js?v=${cacheBuster}`;

          loveScript.onload = () => {
            console.log('love.js loaded');
            if (typeof window.Love === 'function') {
              console.log('Calling Love(Module)...');
              try {
                window.Love(window.Module);
              } catch (e) {
                console.error('Error calling Love():', e);
                setTimeout(onLoad, 1000);
              }
            } else {
              console.error('Love is not a function:', typeof window.Love);
              setTimeout(onLoad, 1000);
            }
          };

          loveScript.onerror = (e) => {
            console.error('Failed to load love.js:', e);
            setTimeout(onLoad, 1000);
          };

          document.body.appendChild(loveScript);
        };

        document.body.appendChild(gameScript);
      } catch (error) {
        console.error('Failed to load Love.js:', error);
        setTimeout(onLoad, 1000);
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
