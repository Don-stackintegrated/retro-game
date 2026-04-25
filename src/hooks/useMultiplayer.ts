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
             health: payload.health,
             color: payload.color
          });
       }
    });

    // Listen to damage events targeted at anyone
    channel.on('broadcast', { event: 'attack' }, ({ payload }) => {
        // If the attack is on our current tile, we take damage
        if (payload.targetX === player.x && payload.targetY === player.y && payload.attackerId !== player.id) {
            takeDamage(10); // Standard attack logic
        }
    });

    // Listen to player disconnects via Presence (if we move to full presence model)
    // For now we rely on a manual disconnect ping or standard timeout for a retro prototype

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
         // Perform initial sync broadcast
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
  }, [player.x, player.y, player.health]); // Re-sync when critical stats change

  // 3. Expose the attack trigger
  const broadcastAttack = (targetX: number, targetY: number) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'attack',
        payload: { targetX, targetY, attackerId: player.id },
      });
    }
  };

  return { broadcastAttack };
}
