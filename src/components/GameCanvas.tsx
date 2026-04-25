"use client";

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

const TILE_SIZE = 32;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const player = useGameStore((state) => state.player);
  const worldData = useGameStore((state) => state.worldData);
  const otherPlayers = useGameStore((state) => state.otherPlayers);
  const move = useGameStore((state) => state.move);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let dx = 0;
      let dy = 0;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          dy = -1;
          break;
        case 's':
        case 'arrowdown':
          dy = 1;
          break;
        case 'a':
        case 'arrowleft':
          dx = -1;
          break;
        case 'd':
        case 'arrowright':
          dx = 1;
          break;
        default:
          return;
      }
      move(dx, dy);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Camera center offset
      const offsetX = width / 2 - player.x * TILE_SIZE;
      const offsetY = height / 2 - player.y * TILE_SIZE;

      ctx.save();
      ctx.translate(offsetX, offsetY);

      // Draw simple grass background/grid around player
      const startX = player.x - 15;
      const endX = player.x + 15;
      const startY = player.y - 10;
      const endY = player.y + 10;

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const tileKey = `${x},${y}`;
          const type = worldData[tileKey];
          
          if (type) {
             // Custom tile (e.g. 1 = wall, 2 = tree)
             ctx.fillStyle = type === 1 ? '#8b4513' : '#228b22';
          } else {
             // Default grass with alternating pattern
             const isEven = (Math.abs(x) + Math.abs(y)) % 2 === 0;
             ctx.fillStyle = isEven ? '#7cfc00' : '#32cd32';
          }

          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          
          // Debug Grid lines
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }

      // Draw Player
      ctx.fillStyle = player.color || '#ff4500'; 
      ctx.fillRect(player.x * TILE_SIZE, player.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      // Add a simple face for character orientation
      ctx.fillStyle = '#000';
      ctx.fillRect(player.x * TILE_SIZE + 20, player.y * TILE_SIZE + 8, 4, 4); // eye
      ctx.fillRect(player.x * TILE_SIZE + 20, player.y * TILE_SIZE + 20, 4, 4); // eye

      // Draw Local Player Health Bar
      ctx.fillStyle = 'red';
      ctx.fillRect(player.x * TILE_SIZE, player.y * TILE_SIZE - 6, TILE_SIZE, 4);
      ctx.fillStyle = '#32cd32';
      ctx.fillRect(player.x * TILE_SIZE, player.y * TILE_SIZE - 6, TILE_SIZE * (player.health / player.maxHealth), 4);

      // Draw Other Players
      Object.values(otherPlayers).forEach(p => {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          
          // Face
          ctx.fillStyle = '#000';
          ctx.fillRect(p.x * TILE_SIZE + 20, p.y * TILE_SIZE + 8, 4, 4);
          ctx.fillRect(p.x * TILE_SIZE + 20, p.y * TILE_SIZE + 20, 4, 4);

          // Health bar
          ctx.fillStyle = 'red';
          ctx.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE - 6, TILE_SIZE, 4);
          ctx.fillStyle = '#32cd32';
          ctx.fillRect(p.x * TILE_SIZE, p.y * TILE_SIZE - 6, TILE_SIZE * ((p.health || 100) / 100), 4);
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.x, player.y, player.health, player.maxHealth, player.color, worldData, otherPlayers]);

  return (
    <div className="w-full h-full flex justify-center items-center bg-gray-900 border-4 border-gray-700 shadow-xl overflow-hidden rounded-md relative select-none">
       {/* Use a fixed aspect ratio for retro feel */}
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        className="w-full h-full max-w-[800px] max-h-[600px] object-contain origin-center"
        style={{ imageRendering: 'pixelated' }}
        onContextMenu={(e) => e.preventDefault()} // prevent right click
      />
      <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded text-xs">
        Coord: ({player.x}, {player.y})
      </div>
    </div>
  );
}
