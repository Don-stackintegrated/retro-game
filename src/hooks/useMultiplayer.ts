import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore, type Trap } from '../store/gameStore';

export function useMultiplayer() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');

  const playerRef = useRef(useGameStore.getState().player);

  // Keep ref in sync
  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      playerRef.current = state.player;
    });
    return unsub;
  }, []);

  // ── 1. Channel setup ──
  useEffect(() => {
    const player = playerRef.current;
    const channel = supabase.channel('game_room', {
      config: {
        presence: { key: player.id },
        broadcast: { ack: false },
      },
    });

    channelRef.current = channel;

    // ── Presence: player discovery ──
    channel.on('presence', { event: 'sync' }, () => {
      try {
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
      } catch (e) { console.error('Presence sync error:', e); }
    });

    channel.on('presence', { event: 'leave' }, ({ key }) => {
      try {
        useGameStore.getState().removeOtherPlayer(key);
      } catch (e) { console.error('Presence leave error:', e); }
    });

    // ── Broadcast: movement ──
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      try {
        const myId = playerRef.current.id;
        if (payload.id === myId) return;
        useGameStore.getState().updateOtherPlayer(payload.id, {
          x: payload.x,
          y: payload.y,
          facing: payload.facing,
          health: payload.health,
          color: payload.color,
        });
      } catch (e) { console.error('Move broadcast error:', e); }
    });

    // ── Broadcast: targeted damage ──
    channel.on('broadcast', { event: 'damage' }, ({ payload }) => {
      try {
        const myId = playerRef.current.id;
        if (payload.targetId === myId) {
          const prevHealth = useGameStore.getState().player.health;
          useGameStore.getState().takeDamage(payload.amount);
          // If we died, broadcast kill credit
          const newHealth = useGameStore.getState().player.health;
          if (prevHealth > 0 && prevHealth <= payload.amount) {
            channel.send({
              type: 'broadcast',
              event: 'kill_credit',
              payload: { killerId: payload.attackerId },
            });
          }
          // Also broadcast our new position/health
          const p = playerRef.current;
          channel.send({
            type: 'broadcast',
            event: 'move',
            payload: { id: p.id, x: p.x, y: p.y, facing: p.facing, health: newHealth >= payload.amount ? newHealth : p.health, color: p.color },
          });
        }
      } catch (e) { console.error('Damage broadcast error:', e); }
    });

    // ── Broadcast: kill credit ──
    channel.on('broadcast', { event: 'kill_credit' }, ({ payload }) => {
      try {
        if (payload.killerId === playerRef.current.id) {
          useGameStore.getState().incrementKills();
        }
      } catch (e) { console.error('Kill credit error:', e); }
    });

    // ── Broadcast: trap placed ──
    channel.on('broadcast', { event: 'trap_place' }, ({ payload }) => {
      try {
        if (payload.ownerId !== playerRef.current.id) {
          useGameStore.getState().addRemoteTrap(payload as Trap);
        }
      } catch (e) { console.error('Trap place error:', e); }
    });

    // ── Broadcast: trap triggered ──
    channel.on('broadcast', { event: 'trap_trigger' }, ({ payload }) => {
      try {
        useGameStore.getState().removeTrap(payload.trapId);
        // Add explosion effect for everyone
        useGameStore.getState().addAttackEffect({
          type: 'explosion',
          startX: payload.x,
          startY: payload.y,
          endX: payload.x,
          endY: payload.y,
          facing: 'down',
          duration: 500,
        });
      } catch (e) { console.error('Trap trigger error:', e); }
    });

    // ── Subscribe ──
    channel.subscribe(async (status) => {
      console.log('🎮 Realtime status:', status);
      setConnectionStatus(status);
      if (status === 'SUBSCRIBED') {
        const p = playerRef.current;
        await channel.track({
          x: p.x, y: p.y, facing: p.facing, health: p.health, color: p.color,
        });
      }
    });

    // ── Heartbeat ──
    const heartbeat = setInterval(async () => {
      try {
        const p = playerRef.current;
        await channel.track({
          x: p.x, y: p.y, facing: p.facing, health: p.health, color: p.color,
        });
      } catch (e) { console.error('Heartbeat error:', e); }
    }, 2000);

    return () => {
      clearInterval(heartbeat);
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, []);

  // ── 2. Broadcast movement changes ──
  const prevPosRef = useRef({ x: 0, y: 0, facing: 'down', health: 100 });

  useEffect(() => {
    const unsub = useGameStore.subscribe((state) => {
      const p = state.player;
      const prev = prevPosRef.current;
      if (p.x !== prev.x || p.y !== prev.y || p.facing !== prev.facing || p.health !== prev.health) {
        prevPosRef.current = { x: p.x, y: p.y, facing: p.facing, health: p.health };
        try {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'move',
            payload: { id: p.id, x: p.x, y: p.y, facing: p.facing, health: p.health, color: p.color },
          });
        } catch (e) { console.error('Move send error:', e); }
      }
    });
    return unsub;
  }, []);

  // ── 3. API ──
  const sendDamage = useCallback((targetId: string, amount: number) => {
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'damage',
        payload: { targetId, amount, attackerId: playerRef.current.id },
      });
    } catch (e) { console.error('Damage send error:', e); }
  }, []);

  const sendTrap = useCallback((trap: Trap) => {
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'trap_place',
        payload: trap,
      });
    } catch (e) { console.error('Trap send error:', e); }
  }, []);

  const sendTrapTrigger = useCallback((trapId: string, x: number, y: number) => {
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'trap_trigger',
        payload: { trapId, x, y },
      });
    } catch (e) { console.error('Trap trigger send error:', e); }
  }, []);

  return { sendDamage, sendTrap, sendTrapTrigger, connectionStatus };
}
