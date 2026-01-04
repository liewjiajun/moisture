import { useEffect, useRef } from 'react';
import { luaBridge } from '../bridge/luaBridge';

interface GameCanvasProps {
  onLoad: () => void;
}

declare global {
  interface Window {
    Module: any;
    Love: any;
  }
}

function GameCanvas({ onLoad }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadLoveJS = async () => {
      try {
        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.oncontextmenu = (e) => e.preventDefault();

        if (containerRef.current) {
          containerRef.current.appendChild(canvas);
        }

        // Configure Love.js Module
        window.Module = {
          canvas,
          arguments: ['./'],
          INITIAL_MEMORY: 67108864,
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
            console.log('Love.js runtime initialized');
          },
        };

        // Load game.js first (sets up data file loader)
        console.log('Loading game.js...');
        const gameScript = document.createElement('script');
        gameScript.src = '/game.js';

        gameScript.onerror = (e) => {
          console.error('Failed to load game.js:', e);
          // Still call onLoad so the UI doesn't hang
          setTimeout(onLoad, 1000);
        };

        // Load love.js after game.js
        gameScript.onload = () => {
          console.log('game.js loaded, now loading love.js...');

          const loveScript = document.createElement('script');
          loveScript.src = '/love.js';

          loveScript.onload = () => {
            console.log('love.js loaded');
            // Call Love() to initialize the engine
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

  return <div ref={containerRef} className="game-canvas" />;
}

export default GameCanvas;
