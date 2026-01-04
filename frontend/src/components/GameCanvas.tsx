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
          printErr: console.error,
          print: console.log,

          setStatus: (text: string) => {
            console.log('Love.js status:', text);
            if (!text) {
              // All loading complete
              setTimeout(() => {
                luaBridge.init(window.Module);
                onLoad();
              }, 100);
            }
          },

          totalDependencies: 0,
          remainingDependencies: 0,
          monitorRunDependencies: function(left: number) {
            this.remainingDependencies = left;
            this.totalDependencies = Math.max(this.totalDependencies, left);
            if (left === 0) {
              window.Module.setStatus('');
            } else {
              window.Module.setStatus(`Loading... (${this.totalDependencies - left}/${this.totalDependencies})`);
            }
          },
        };

        // Load game.js first (sets up data file loader)
        const gameScript = document.createElement('script');
        gameScript.src = '/game.js';
        gameScript.async = false;

        gameScript.onerror = () => {
          console.warn('game.js not found');
          setTimeout(onLoad, 1000);
        };

        // Load love.js after game.js
        gameScript.onload = () => {
          console.log('game.js loaded');

          const loveScript = document.createElement('script');
          loveScript.src = '/love.js';
          loveScript.async = true;

          loveScript.onload = () => {
            console.log('love.js loaded, starting Love...');
            // Call Love() to initialize the engine
            if (window.Love) {
              window.Love(window.Module);
            }
          };

          loveScript.onerror = () => {
            console.warn('love.js not found');
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
