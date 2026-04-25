import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PlayerState {
  id: string; // Unique session/user ID
  x: number;
  y: number;
  energy: number;
  maxEnergy: number;
  health: number;
  maxHealth: number;
  color: string; // unique color for multiplayer identification
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface OtherPlayer {
  x: number;
  y: number;
  health: number;
  color: string;
}

export interface GameState {
  player: PlayerState;
  inventory: InventoryItem[];
  worldData: Record<string, number>; 
  otherPlayers: Record<string, OtherPlayer>;
  
  // Actions
  move: (dx: number, dy: number) => void;
  consumeEnergy: (amount: number) => boolean;
  takeDamage: (amount: number) => void;
  updateWorldTile: (x: number, y: number, type: number) => void;
  
  // Multiplayer triggers (mostly for external listeners)
  triggerAttack: () => void;
  updateOtherPlayer: (id: string, data: OtherPlayer) => void;
  removeOtherPlayer: (id: string) => void;
}

const generateRandomColor = () => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#facc15', '#14b8a6'];
    return colors[Math.floor(Math.random() * colors.length)];
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      player: {
        id: crypto.randomUUID(),
        x: 10,
        y: 10,
        energy: 100,
        maxEnergy: 100,
        health: 100,
        maxHealth: 100,
        color: generateRandomColor(),
      },
      inventory: [],
      worldData: {},
      otherPlayers: {},
      
      move: (dx, dy) => {
        set((state) => {
          const newX = state.player.x + dx;
          const newY = state.player.y + dy;
          // Normally includes collision detection with worldData here
          return {
            player: {
              ...state.player,
              x: newX,
              y: newY,
            },
          };
        });
      },

      consumeEnergy: (amount) => {
        let success = false;
        set((state) => {
          if (state.player.energy >= amount) {
            success = true;
            return {
              player: {
                ...state.player,
                energy: state.player.energy - amount,
              },
            };
          }
          return state;
        });
        return success;
      },

      takeDamage: (amount) => {
         set((state) => {
            const newHealth = Math.max(0, state.player.health - amount);
            // Handling death (e.g., respawn at 10,10)
            if (newHealth === 0) {
              return {
                 player: {
                    ...state.player,
                    health: state.player.maxHealth,
                    x: 10,
                    y: 10,
                 }
              }
            }
            return {
               player: {
                  ...state.player,
                  health: newHealth
               }
            }
         });
      },

      triggerAttack: () => {
         // This mostly tells the system an attack was processed for the external sync listener
         // The actual broadcast is handled in the UI mapping or a listener hook.
         get().consumeEnergy(2);
      },

      updateWorldTile: (x, y, type) => {
        set((state) => ({
          worldData: {
            ...state.worldData,
            [`${x},${y}`]: type,
          },
        }));
      },

      updateOtherPlayer: (id, data) => {
        set((state) => ({
          otherPlayers: {
             ...state.otherPlayers,
             [id]: data
          }
        }))
      },

      removeOtherPlayer: (id) => {
        set((state) => {
           const newPlayers = { ...state.otherPlayers };
           delete newPlayers[id];
           return { otherPlayers: newPlayers };
        })
      }
    }),
    {
      name: 'retro-game-storage',
      // We purposefully don't persist 'otherPlayers' to avoid ghost players on reload
      partialize: (state) => ({ 
          player: state.player, 
          inventory: state.inventory, 
          worldData: state.worldData 
      }),
    }
  )
);
