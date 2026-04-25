"use client";

import React, { useEffect } from 'react';
import GameCanvas from './GameCanvas';
import { useGameStore } from '../store/gameStore';
import { Pickaxe, Heart, Sword, Crosshair, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useMultiplayer } from '../hooks/useMultiplayer';

export default function BentoUI() {
  const { energy, maxEnergy, health, maxHealth } = useGameStore((state) => state.player);
  const inventory = useGameStore((state) => state.inventory);
  const consumeEnergy = useGameStore((state) => state.consumeEnergy);
  const updateWorldTile = useGameStore((state) => state.updateWorldTile);
  const player = useGameStore((state) => state.player);
  const move = useGameStore((state) => state.move);
  
  // Hook up multiplayer bindings
  const { sendDamage } = useMultiplayer();

  // Passive Energy Regen
  useEffect(() => {
     const interval = setInterval(() => {
        useGameStore.setState(state => {
           if (state.player.energy < state.player.maxEnergy) {
               return { player: { ...state.player, energy: Math.min(state.player.maxEnergy, state.player.energy + 5) } };
           }
           return state;
        });
     }, 1000);
     return () => clearInterval(interval);
  }, []);

  const handleDig = () => {
    if (consumeEnergy(5)) {
       updateWorldTile(player.x, player.y, 1);
    }
  };

  const handleCombat = (type: 'melee' | 'ranged') => {
    const cost = type === 'melee' ? 10 : 15;
    const damage = type === 'melee' ? 25 : 15;
    const range = type === 'melee' ? 1 : 5;

    if (!consumeEnergy(cost)) return;

    let dx = 0; let dy = 0;
    if (player.facing === 'up') dy = -1;
    if (player.facing === 'down') dy = 1;
    if (player.facing === 'left') dx = -1;
    if (player.facing === 'right') dx = 1;

    let hitTargetId: string | null = null;
    const otherPlayers = useGameStore.getState().otherPlayers;

    for (let i = 1; i <= range; i++) {
        const cx = player.x + (dx * i);
        const cy = player.y + (dy * i);
        
        // Find if anyone is on this tile
        const targetId = Object.keys(otherPlayers).find(id => {
            const p = otherPlayers[id];
            return p.x === cx && p.y === cy && p.health > 0;
        });
        if (targetId) {
            hitTargetId = targetId;
            break;
        }
    }

    if (hitTargetId) {
       sendDamage(hitTargetId, damage);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black flex flex-col p-2 md:p-8 font-sans gap-4 selection:bg-none">
      <header className="flex justify-between items-center bg-gray-900 border-4 border-gray-700 p-4 text-white uppercase shadow-[4px_4px_0_0_#374151]">
         <h1 className="text-xl md:text-2xl text-yellow-400">Retro Quest</h1>
         <div className="flex gap-4 items-center">
            <span className="text-sm">Lvl. 1</span>
         </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6 lg:min-h-[600px]">
        {/* Left Side: Stats and Actions */}
        <aside className="col-span-1 flex flex-col gap-4">
           {/* Energy Box */}
           <div className="bg-gray-900 border-4 border-gray-700 p-4 text-white flex flex-col justify-center shadow-[4px_4px_0_0_#374151]">
              <h2 className="text-sm text-gray-400 mb-2">Energy</h2>
              <div className="flex items-center gap-2">
                 <div className="text-xl flex-1">{energy} / {maxEnergy}</div>
              </div>
              <div className="w-full bg-gray-950 h-3 mt-2 border-2 border-gray-800">
                 <div 
                   className="bg-yellow-500 h-full transition-all duration-300"
                   style={{ width: `${(energy / maxEnergy) * 100}%` }}
                 />
              </div>

              <h2 className="text-sm text-gray-400 mb-2 mt-4">Health</h2>
              <div className="flex items-center gap-2">
                 <Heart className="text-red-500 fill-red-500 w-5 h-5" />
                 <div className="text-xl flex-1">{health} / {maxHealth}</div>
              </div>
              <div className="w-full bg-gray-950 h-3 mt-2 border-2 border-gray-800">
                 <div 
                   className="bg-red-500 h-full transition-all duration-300"
                   style={{ width: `${(health / maxHealth) * 100}%` }}
                 />
              </div>
           </div>

           {/* Desktop Actions Box (hidden on mobile, moved to overlay) */}
           <div className="hidden lg:flex bg-gray-900 border-4 border-gray-700 p-4 text-white flex-col flex-1 shadow-[4px_4px_0_0_#374151]">
              <h2 className="text-sm text-gray-400 mb-4">Actions</h2>
              <div className="grid grid-cols-1 gap-4">
                 <button 
                   onClick={() => handleCombat('melee')}
                   disabled={energy < 10}
                   className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border-2 border-gray-600 p-3 flex flex-col items-center gap-1 transition-colors active:translate-y-1"
                 >
                    <Sword className="text-gray-300 w-6 h-6" />
                    <span className="text-xs">Melee (-10e)</span>
                 </button>
                 <button 
                   onClick={() => handleCombat('ranged')}
                   disabled={energy < 15}
                   className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border-2 border-gray-600 p-3 flex flex-col items-center gap-1 transition-colors active:translate-y-1"
                 >
                    <Crosshair className="text-gray-300 w-6 h-6" />
                    <span className="text-xs">Ranged (-15e)</span>
                 </button>
                 <button 
                   onClick={handleDig}
                   disabled={energy < 5}
                   className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border-2 border-gray-600 p-3 flex flex-col items-center gap-1 transition-colors active:translate-y-1 mt-4"
                 >
                    <Pickaxe className="text-gray-300 w-6 h-6" />
                    <span className="text-xs">Dig (-5e)</span>
                 </button>
              </div>
           </div>
        </aside>

        {/* Center: The Game View */}
        <section className="col-span-1 lg:col-span-2 relative border-4 border-gray-700 shadow-[8px_8px_0_0_#374151] bg-black p-1 flex flex-col">
           <div className="relative flex-1 min-h-[300px]">
             <GameCanvas />
             
             {/* Mobile D-PAD Overlay */}
             <div className="absolute bottom-4 left-4 lg:hidden opacity-80 grid gap-1 grid-cols-3 grid-rows-3 touch-manipulation">
                <div />
                <button onTouchStart={(e) => { e.preventDefault(); move(0, -1); }} onClick={() => move(0, -1)} className="bg-gray-800 border-2 border-gray-500 p-3 active:bg-yellow-600 text-white"><ArrowUp/></button>
                <div />
                <button onTouchStart={(e) => { e.preventDefault(); move(-1, 0); }} onClick={() => move(-1, 0)} className="bg-gray-800 border-2 border-gray-500 p-3 active:bg-yellow-600 text-white"><ArrowLeft/></button>
                <button onTouchStart={(e) => { e.preventDefault(); move(0, 1); }} onClick={() => move(0, 1)} className="bg-gray-800 border-2 border-gray-500 p-3 active:bg-yellow-600 text-white"><ArrowDown/></button>
                <button onTouchStart={(e) => { e.preventDefault(); move(1, 0); }} onClick={() => move(1, 0)} className="bg-gray-800 border-2 border-gray-500 p-3 active:bg-yellow-600 text-white"><ArrowRight/></button>
             </div>

             {/* Mobile Actions Overlay */}
             <div className="absolute bottom-4 right-4 lg:hidden opacity-90 flex flex-col gap-2">
                 <button onClick={() => handleCombat('ranged')} disabled={energy < 15} className="bg-blue-800 border-2 border-gray-500 p-3 rounded-full active:bg-blue-600 shadow-xl disabled:opacity-50 touch-manipulation">
                    <Crosshair className="text-white w-5 h-5" />
                 </button>
                 <button onClick={() => handleCombat('melee')} disabled={energy < 10} className="bg-red-800 border-2 border-gray-500 p-4 rounded-full active:bg-red-600 shadow-xl disabled:opacity-50 touch-manipulation">
                    <Sword className="text-white w-6 h-6" />
                 </button>
             </div>
           </div>
        </section>

        {/* Right Side: Inventory */}
        <aside className="col-span-1 bg-gray-900 border-4 border-gray-700 p-4 text-white shadow-[4px_4px_0_0_#374151] flex flex-col h-48 lg:h-auto">
           <h2 className="text-sm text-gray-400 mb-4">Inventory</h2>
           <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-3 gap-2 flex-1 content-start">
             {Array.from({ length: 12 }).map((_, i) => {
               const item = inventory[i];
               return (
                 <div key={i} className="aspect-square bg-gray-950 border-2 border-gray-800 p-2 flex items-center justify-center relative hover:border-gray-600 cursor-pointer">
                    {item ? (
                      <div>
                        <div className="w-8 h-8 bg-amber-600 block" />
                        <span className="absolute bottom-1 right-1 text-[8px] bg-black px-1 border border-gray-700">x{item.quantity}</span>
                      </div>
                    ) : (
                      <span className="text-gray-800 text-[10px]">E</span>
                    )}
                 </div>
               )
             })}
           </div>
           
           <div className="hidden lg:block mt-4 p-4 bg-gray-950 border-2 border-gray-800 min-h-24">
             <p className="text-xs text-gray-500">Move: WASD</p>
             <p className="text-xs text-gray-500 mt-2">Combat checks tiles you face.</p>
           </div>
        </aside>
      </main>
    </div>
  );
}
