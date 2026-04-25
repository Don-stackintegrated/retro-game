"use client";

import React, { useEffect, useRef } from 'react';
import { useGameStore, type OtherPlayer, type AttackEffect, type Trap } from '../store/gameStore';

const TILE_SIZE = 32;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const move = useGameStore((state) => state.move);

  // Refs for render-loop data (read-only in render, never call set() here)
  const playerRef = useRef(useGameStore.getState().player);
  const worldRef = useRef(useGameStore.getState().worldData);
  const othersRef = useRef<Record<string, OtherPlayer>>(useGameStore.getState().otherPlayers);
  const effectsRef = useRef<AttackEffect[]>(useGameStore.getState().attackEffects);
  const trapsRef = useRef<Trap[]>(useGameStore.getState().traps);

  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      playerRef.current = state.player;
      worldRef.current = state.worldData;
      othersRef.current = state.otherPlayers;
      effectsRef.current = state.attackEffects;
      trapsRef.current = state.traps;
    });
    return unsub;
  }, []);

  // Effect cleanup on a separate interval — NEVER inside render loop
  useEffect(() => {
    const interval = setInterval(() => {
      useGameStore.getState().cleanupEffects();
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let dx = 0, dy = 0;
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup':    dy = -1; break;
        case 's': case 'arrowdown':  dy = 1; break;
        case 'a': case 'arrowleft':  dx = -1; break;
        case 'd': case 'arrowright': dx = 1; break;
        default: return;
      }
      move(dx, dy);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  // Persistent render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const player = playerRef.current;
      const worldData = worldRef.current;
      const otherPlayers = othersRef.current;
      const effects = effectsRef.current;
      const traps = trapsRef.current;
      const now = Date.now();

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const offsetX = W / 2 - player.x * TILE_SIZE;
      const offsetY = H / 2 - player.y * TILE_SIZE;
      ctx.save();
      ctx.translate(offsetX, offsetY);

      // ── Tilemap ──
      const sx = player.x - 15, ex = player.x + 15;
      const sy = player.y - 10, ey = player.y + 10;
      for (let y = sy; y <= ey; y++) {
        for (let x = sx; x <= ex; x++) {
          const type = worldData[`${x},${y}`];
          if (type) {
            ctx.fillStyle = type === 1 ? '#8b4513' : '#228b22';
          } else {
            ctx.fillStyle = (Math.abs(x) + Math.abs(y)) % 2 === 0 ? '#7cfc00' : '#32cd32';
          }
          ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = 'rgba(0,0,0,0.1)';
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }

      // ── Draw traps ──
      traps.forEach((trap) => {
        const px = trap.x * TILE_SIZE;
        const py = trap.y * TILE_SIZE;
        const pulse = 0.5 + 0.5 * Math.sin(now / 200);

        // Danger tile background
        ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + pulse * 0.15})`;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Bomb body
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 2, 8, 0, Math.PI * 2);
        ctx.fill();

        // Fuse
        ctx.strokeStyle = trap.ownerColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + TILE_SIZE / 2 + 4, py + TILE_SIZE / 2 - 6);
        ctx.lineTo(px + TILE_SIZE / 2 + 8, py + TILE_SIZE / 2 - 10);
        ctx.stroke();
        ctx.lineWidth = 1;

        // Fuse spark
        ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
        ctx.beginPath();
        ctx.arc(px + TILE_SIZE / 2 + 8, py + TILE_SIZE / 2 - 10, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Helper: draw character ──
      const drawChar = (
        x: number, y: number,
        facing: 'up' | 'down' | 'left' | 'right',
        color: string,
        hp: number, maxHp: number,
        isLocal: boolean
      ) => {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        ctx.fillStyle = color;
        ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

        if (isLocal) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          ctx.lineWidth = 1;
        }

        // Eyes
        ctx.fillStyle = '#000';
        if (facing === 'down') {
          ctx.fillRect(px + 8, py + 20, 4, 4);
          ctx.fillRect(px + 20, py + 20, 4, 4);
        } else if (facing === 'up') {
          ctx.fillRect(px + 8, py + 6, 4, 4);
          ctx.fillRect(px + 20, py + 6, 4, 4);
        } else if (facing === 'left') {
          ctx.fillRect(px + 4, py + 8, 4, 4);
          ctx.fillRect(px + 4, py + 20, 4, 4);
        } else {
          ctx.fillRect(px + 24, py + 8, 4, 4);
          ctx.fillRect(px + 24, py + 20, 4, 4);
        }

        // Health bar
        ctx.fillStyle = '#333';
        ctx.fillRect(px, py - 7, TILE_SIZE, 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(px, py - 7, TILE_SIZE, 5);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(px, py - 7, TILE_SIZE * (hp / maxHp), 5);

        // Facing arrow (local only)
        if (isLocal) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          const cx = px + TILE_SIZE / 2;
          const cy = py + TILE_SIZE / 2;
          ctx.beginPath();
          if (facing === 'up') {
            ctx.moveTo(cx, py - 12); ctx.lineTo(cx - 4, py - 8); ctx.lineTo(cx + 4, py - 8);
          } else if (facing === 'down') {
            ctx.moveTo(cx, py + TILE_SIZE + 12); ctx.lineTo(cx - 4, py + TILE_SIZE + 8); ctx.lineTo(cx + 4, py + TILE_SIZE + 8);
          } else if (facing === 'left') {
            ctx.moveTo(px - 12, cy); ctx.lineTo(px - 8, cy - 4); ctx.lineTo(px - 8, cy + 4);
          } else {
            ctx.moveTo(px + TILE_SIZE + 12, cy); ctx.lineTo(px + TILE_SIZE + 8, cy - 4); ctx.lineTo(px + TILE_SIZE + 8, cy + 4);
          }
          ctx.closePath();
          ctx.fill();
        }
      };

      // ── Other players ──
      Object.values(otherPlayers).forEach((p) => {
        drawChar(p.x, p.y, p.facing || 'down', p.color, p.health ?? 100, 100, false);
      });

      // ── Local player ──
      drawChar(player.x, player.y, player.facing, player.color, player.health, player.maxHealth, true);

      // ── Attack effects ──
      effects.forEach((e) => {
        const elapsed = now - e.createdAt;
        const progress = Math.min(elapsed / e.duration, 1);
        const alpha = 1 - progress;

        if (e.type === 'melee') {
          ctx.globalAlpha = alpha;
          const tx = e.endX * TILE_SIZE;
          const ty = e.endY * TILE_SIZE;
          ctx.lineWidth = 3;
          ctx.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(tx + 4, ty + 4);
          ctx.lineTo(tx + TILE_SIZE - 4, ty + TILE_SIZE - 4);
          ctx.moveTo(tx + TILE_SIZE - 4, ty + 4);
          ctx.lineTo(tx + 4, ty + TILE_SIZE - 4);
          ctx.stroke();
          ctx.lineWidth = 1;
          ctx.globalAlpha = 1;
        } else if (e.type === 'ranged') {
          const cx = e.startX + (e.endX - e.startX) * progress;
          const cy = e.startY + (e.endY - e.startY) * progress;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(cx * TILE_SIZE + TILE_SIZE / 2, cy * TILE_SIZE + TILE_SIZE / 2, 4, 0, Math.PI * 2);
          ctx.fill();
          // Trail
          ctx.fillStyle = `rgba(249, 115, 22, ${alpha * 0.4})`;
          const tx2 = e.startX + (e.endX - e.startX) * Math.max(0, progress - 0.15);
          const ty2 = e.startY + (e.endY - e.startY) * Math.max(0, progress - 0.15);
          ctx.beginPath();
          ctx.arc(tx2 * TILE_SIZE + TILE_SIZE / 2, ty2 * TILE_SIZE + TILE_SIZE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else if (e.type === 'explosion') {
          // Expanding ring explosion
          const radius = progress * TILE_SIZE * 2;
          const cx = e.endX * TILE_SIZE + TILE_SIZE / 2;
          const cy = e.endY * TILE_SIZE + TILE_SIZE / 2;

          // Outer shockwave
          ctx.globalAlpha = alpha * 0.6;
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();

          // Inner fireball
          ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.5})`;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
          ctx.fill();

          // Bright center flash
          ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.lineWidth = 1;
          ctx.globalAlpha = 1;
        }
      });

      ctx.restore();

      // ── Damage flash ──
      if (now - player.lastDamageAt < 300) {
        const flashAlpha = 1 - (now - player.lastDamageAt) / 300;
        ctx.fillStyle = `rgba(255, 0, 0, ${flashAlpha * 0.3})`;
        ctx.fillRect(0, 0, W, H);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []); // Never restarts

  const coordX = useGameStore((s) => s.player.x);
  const coordY = useGameStore((s) => s.player.y);

  return (
    <div className="w-full h-full flex justify-center items-center bg-gray-900 overflow-hidden relative select-none">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full max-w-[800px] max-h-[600px] object-contain"
        style={{ imageRendering: 'pixelated' }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-[10px]">
        ({coordX}, {coordY})
      </div>
    </div>
  );
}
