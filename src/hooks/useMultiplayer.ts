import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';

/**
 * useMultiplayer — connects to Supabase Realtime for cross-device multiplayer.
 *
 * Uses TWO mechanisms:
 * 1. **Presence** — for player discovery. When you join, you see everyone already in the room.
 *    Updated every 2s via heartbeat.
 * 2. **Broadcast** — for high-frequency position updates (every movement tick).
 *    Also used for targeted damage events.
 */
export function useMultiplayer() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');

  // Use a ref so channel callbacks always read the LATEST player state
  const playerRef = useRef(useGameStore.getState().player);

  // Keep the ref in sync with zustand
  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      playerRef.current = state.player;
    });
    return unsub;
  }, []);

  // ── 1. Connect to channel (mount only once) ──────────────────────────
  useEffect(() => {
    const player = playerRef.current;
    const channel = supabase.channel('game_room', {
      config: {
        presence: { key: player.id },
        broadcast: { ack: false },
      },
    });

    channelRef.current = channel;

    // ── Presence: full player discovery ──
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const store = useGameStore.getState();
      const myId = playerRef.current.id;

      Object.entries(presenceState).forEach(([key, values]) => {
        if (key === myId) return;
        const latest = values[values.length - 1] as Record<string, unknown>;
        if (latest) {
          store.updateOtherPlayer(key, {
            x: latest.x as number,
            y: latest.y as number,
            facing: (latest.facing as 'up' | 'down' | 'left' | 'right') || 'down',
            health: latest.health as number,
            color: latest.color as string,
          });
        }
      });
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      useGameStore.getState().removeOtherPlayer(key);
    });

    // ── Broadcast: high-frequency movement sync ──
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      const myId = playerRef.current.id;
      if (payload.id === myId) return;
      useGameStore.getState().updateOtherPlayer(payload.id, {
        x: payload.x,
        y: payload.y,
        facing: payload.facing,
        health: payload.health,
        color: payload.color,
      });
    });

    // ── Broadcast: targeted damage ──
    channel.on('broadcast', { event: 'damage' }, ({ payload }) => {
      const myId = playerRef.current.id;
      if (payload.targetId === myId) {
        useGameStore.getState().takeDamage(payload.amount);
      }
    });

    // ── Subscribe and track presence ──
    channel.subscribe(async (status) => {
      console.log('🎮 Realtime status:', status);
      setConnectionStatus(status);
      if (status === 'SUBSCRIBED') {
        const p = playerRef.current;
        await channel.track({
          x: p.x,
          y: p.y,
          facing: p.facing,
          health: p.health,
          color: p.color,
        });
      }
    });

    // ── Heartbeat: re-track presence every 2s ──
    const heartbeat = setInterval(async () => {
      if (channel) {
        const p = playerRef.current;
        await channel.track({
          x: p.x,
          y: p.y,
          facing: p.facing,
          health: p.health,
          color: p.color,
        });
      }
    }, 2000);

    return () => {
      clearInterval(heartbeat);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, []);

  // ── 2. Broadcast movement on every position/health change ──
  const prevPosRef = useRef({ x: 0, y: 0, facing: 'down', health: 100 });

  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      const p = state.player;
      const prev = prevPosRef.current;
      if (p.x !== prev.x || p.y !== prev.y || p.facing !== prev.facing || p.health !== prev.health) {
        prevPosRef.current = { x: p.x, y: p.y, facing: p.facing, health: p.health };
        channelRef.current?.send({
          type: 'broadcast',
          event: 'move',
          payload: {
            id: p.id,
            x: p.x,
            y: p.y,
            facing: p.facing,
            health: p.health,
            color: p.color,
          },
        });
      }
    });
    return unsub;
  }, []);

  // ── 3. Send targeted damage ──
  const sendDamage = useCallback((targetId: string, amount: number) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'damage',
      payload: { targetId, amount },
    });
  }, []);

  return { sendDamage, connectionStatus };
}
