import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Direction = 'up' | 'down' | 'left' | 'right';

export interface AttackEffect {
  id: string;
  type: 'melee' | 'ranged' | 'explosion';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  facing: Direction;
  createdAt: number;
  duration: number;
}

export interface Trap {
  id: string;
  x: number;
  y: number;
  ownerId: string;
  ownerColor: string;
  placedAt: number;
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
  kills: number;
  deaths: number;
  lastDamageAt: number;
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
  traps: Trap[];

  move: (dx: number, dy: number) => void;
  consumeEnergy: (amount: number) => boolean;
  takeDamage: (amount: number) => void;
  updateWorldTile: (x: number, y: number, type: number) => void;
  updateOtherPlayer: (id: string, data: OtherPlayer) => void;
  removeOtherPlayer: (id: string) => void;
  addAttackEffect: (effect: Omit<AttackEffect, 'id' | 'createdAt'>) => void;
  cleanupEffects: () => void;
  placeTrap: () => Trap | null;
  addRemoteTrap: (trap: Trap) => void;
  removeTrap: (trapId: string) => void;
  incrementKills: () => void;
  incrementDeaths: () => void;
  checkTraps: () => Trap | null; // returns trap stepped on, if any
}

const generateRandomColor = () => {
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#facc15', '#14b8a6', '#f97316', '#06b6d4'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const SESSION_ID = crypto.randomUUID();
const SESSION_COLOR = generateRandomColor();

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
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
        kills: 0,
        deaths: 0,
        lastDamageAt: 0,
      },
      inventory: [],
      worldData: {},
      otherPlayers: {},
      attackEffects: [],
      traps: [],

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
            // Death → respawn
            return {
              player: {
                ...state.player,
                health: state.player.maxHealth,
                energy: state.player.maxEnergy,
                x: Math.floor(Math.random() * 10) + 5,
                y: Math.floor(Math.random() * 10) + 5,
                deaths: state.player.deaths + 1,
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
        set((state) => {
          const remaining = state.attackEffects.filter((e) => now - e.createdAt < e.duration);
          // Only update if something actually changed
          if (remaining.length === state.attackEffects.length) return state;
          return { attackEffects: remaining };
        });
      },

      placeTrap: () => {
        const state = get();
        if (state.player.energy < 20) return null;
        // Don't stack traps on same tile
        const existing = state.traps.find(
          (t) => t.x === state.player.x && t.y === state.player.y
        );
        if (existing) return null;

        const trap: Trap = {
          id: crypto.randomUUID(),
          x: state.player.x,
          y: state.player.y,
          ownerId: state.player.id,
          ownerColor: state.player.color,
          placedAt: Date.now(),
        };

        set((s) => ({
          player: { ...s.player, energy: s.player.energy - 20 },
          traps: [...s.traps, trap],
        }));

        return trap;
      },

      addRemoteTrap: (trap) => {
        set((state) => ({
          traps: [...state.traps, trap],
        }));
      },

      removeTrap: (trapId) => {
        set((state) => ({
          traps: state.traps.filter((t) => t.id !== trapId),
        }));
      },

      incrementKills: () => {
        set((state) => ({
          player: { ...state.player, kills: state.player.kills + 1 },
        }));
      },

      incrementDeaths: () => {
        set((state) => ({
          player: { ...state.player, deaths: state.player.deaths + 1 },
        }));
      },

      checkTraps: () => {
        const state = get();
        const trap = state.traps.find(
          (t) => t.x === state.player.x && t.y === state.player.y && t.ownerId !== state.player.id
        );
        return trap ?? null;
      },
    }),
    {
      name: 'retro-game-storage',
      partialize: (state) => ({
        inventory: state.inventory,
        worldData: state.worldData,
      }),
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
