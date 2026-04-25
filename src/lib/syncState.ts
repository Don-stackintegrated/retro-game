import { supabase } from './supabase';
import { useGameStore } from '../store/gameStore';

/**
 * A throttled background sync function to save delta changes (energy, inventory, position) 
 * to Supabase. This should be called periodically by the game loop or on explicit save actions.
 */
export async function syncStateToSupabase(userId: string) {
  const state = useGameStore.getState();

  try {
    // 1. Sync Profile (position, energy)
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        pos_x: state.player.x,
        pos_y: state.player.y,
        energy: state.player.energy,
        max_energy: state.player.maxEnergy,
      })
      .eq('id', userId);

    if (profileError) console.error("Profile Sync Error", profileError);

    // 2. Sync World Data Deltas (Optional for proto: could just push everything)
    // In a real app, track "dirty" tiles.
    const worldUpdates = Object.entries(state.worldData).map(([key, type]) => ({
      tile_key: key,
      tile_type: type,
      placed_by: userId,
      updated_at: new Date().toISOString()
    }));

    if (worldUpdates.length > 0) {
      const { error: worldError } = await supabase
        .from('world_state')
        .upsert(worldUpdates);
        
      if (worldError) console.error("World Sync Error", worldError);
    }
    
    // Inventory sync would go here similarly

  } catch (error) {
    console.error("Sync failed", error);
  }
}

// Optionally, setup an interval here or inside a React useEffect
