import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Direction = 'up' | 'down' | 'left' | 'right';

export interface AttackEffect {
  id: string;
  type: 'melee' | 'ranged';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  facing: Direction;
  createdAt: number; // Date.now()
  duration: number;  // ms
}

export interface PlayerState {
  id: string;
  x: number;
  y: number;
  facing: Direction;
  energy: number;
  maxEnergy: number;
  health: number;
  maxHealth: number;
  color: string;
  lastDamageAt: number; // for damage flash
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface OtherPlayer {
  x: number;
  y: number;
  facing: Direction;
  health: number;
  color: string;
}

export interface GameState {
  player: PlayerState;
  inventory: InventoryItem[];
  worldData: Record<string, number>;
  otherPlayers: Record<string, OtherPlayer>;
  attackEffects: AttackEffect[];

  move: (dx: number, dy: number) => void;
  consumeEnergy: (amount: number) => boolean;
  takeDamage: (amount: number) => void;
  updateWorldTile: (x: number, y: number, type: number) => void;
  updateOtherPlayer: (id: string, data: OtherPlayer) => void;
  removeOtherPlayer: (id: string) => void;
  addAttackEffect: (effect: Omit<AttackEffect, 'id' | 'createdAt'>) => void;
  cleanupEffects: () => void;
}

const generateRandomColor = () => {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#facc15', '#14b8a6', '#f97316', '#06b6d4'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Generate a stable session ID that persists across the tab lifetime
// but is unique per tab. We do NOT persist this to localStorage.
const SESSION_ID = crypto.randomUUID();
const SESSION_COLOR = generateRandomColor();

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      player: {
        id: SESSION_ID,
        x: Math.floor(Math.random() * 6) + 8,
        y: Math.floor(Math.random() * 6) + 8,
        facing: 'down' as Direction,
        energy: 100,
        maxEnergy: 100,
        health: 100,
        maxHealth: 100,
        color: SESSION_COLOR,
        lastDamageAt: 0,
      },
      inventory: [],
      worldData: {},
      otherPlayers: {},
      attackEffects: [],

      move: (dx, dy) => {
        set((state) => {
          const newX = state.player.x + dx;
          const newY = state.player.y + dy;
          let newFacing = state.player.facing;
          if (dx === 1) newFacing = 'right';
          if (dx === -1) newFacing = 'left';
          if (dy === 1) newFacing = 'down';
          if (dy === -1) newFacing = 'up';
          return {
            player: { ...state.player, x: newX, y: newY, facing: newFacing },
          };
        });
      },

      consumeEnergy: (amount) => {
        let success = false;
        set((state) => {
          if (state.player.energy >= amount) {
            success = true;
            return { player: { ...state.player, energy: state.player.energy - amount } };
          }
          return state;
        });
        return success;
      },

      takeDamage: (amount) => {
        set((state) => {
          const newHealth = Math.max(0, state.player.health - amount);
          if (newHealth === 0) {
            return {
              player: {
                ...state.player,
                health: state.player.maxHealth,
                x: Math.floor(Math.random() * 5) + 8,
                y: Math.floor(Math.random() * 5) + 8,
                lastDamageAt: Date.now(),
              },
            };
          }
          return { player: { ...state.player, health: newHealth, lastDamageAt: Date.now() } };
        });
      },

      updateWorldTile: (x, y, type) => {
        set((state) => ({
          worldData: { ...state.worldData, [`${x},${y}`]: type },
        }));
      },

      updateOtherPlayer: (id, data) => {
        set((state) => ({
          otherPlayers: { ...state.otherPlayers, [id]: data },
        }));
      },

      removeOtherPlayer: (id) => {
        set((state) => {
          const next = { ...state.otherPlayers };
          delete next[id];
          return { otherPlayers: next };
        });
      },

      addAttackEffect: (effect) => {
        set((state) => ({
          attackEffects: [
            ...state.attackEffects,
            { ...effect, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        }));
      },

      cleanupEffects: () => {
        const now = Date.now();
        set((state) => ({
          attackEffects: state.attackEffects.filter(
            (e) => now - e.createdAt < e.duration
          ),
        }));
      },
    }),
    {
      name: 'retro-game-storage',
      // Only persist world data and inventory. Player identity is session-scoped.
      partialize: (state) => ({
        inventory: state.inventory,
        worldData: state.worldData,
      }),
      // On rehydrate, always use the fresh session ID/color
      merge: (persisted, current) => {
        const p = persisted as Partial<GameState> | undefined;
        return {
          ...current,
          inventory: p?.inventory ?? current.inventory,
          worldData: p?.worldData ?? current.worldData,
        };
      },
    }
  )
);
