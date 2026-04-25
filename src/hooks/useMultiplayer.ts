import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';

export function useMultiplayer() {
  const player = useGameStore((state) => state.player);
  const updateOtherPlayer = useGameStore((state) => state.updateOtherPlayer);
  const takeDamage = useGameStore((state) => state.takeDamage);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 1. Initialize Subscription
  useEffect(() => {
    const channel = supabase.channel('game_room', {
      config: {
        broadcast: { ack: false }
      }
    });

    channelRef.current = channel;

    // Listen to movement/stats of others
    channel.on('broadcast', { event: 'player_sync' }, ({ payload }) => {
       if (payload.id !== player.id) {
          updateOtherPlayer(payload.id, {
             x: payload.x,
             y: payload.y,
             facing: payload.facing,
             health: payload.health,
             color: payload.color
          });
       }
    });

    // Listen to explicit targeted damage events (lag-compensated locally)
    channel.on('broadcast', { event: 'damage' }, ({ payload }) => {
        if (payload.targetId === player.id) {
            console.log("Got hit!", payload.amount);
            takeDamage(payload.amount);
        }
    });

    channel.subscribe((status) => {
      console.log("Realtime Channel Status:", status);
      if (status === 'SUBSCRIBED') {
         channel.send({
            type: 'broadcast',
            event: 'player_sync',
            payload: player,
         });
      }
    });

    return () => {
       supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount only once

  // 2. Broadcast Local Player changes
  useEffect(() => {
     if (channelRef.current) {
        channelRef.current.send({
           type: 'broadcast',
           event: 'player_sync',
           payload: player,
        });
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.x, player.y, player.facing, player.health]); // Re-sync when stat or position changes

  // 3. Expose targeted damage logic
  const sendDamage = (targetId: string, amount: number) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'damage',
        payload: { targetId, amount },
      });
    }
  };

  return { sendDamage };
}
