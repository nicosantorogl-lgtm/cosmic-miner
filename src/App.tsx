import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Pickaxe, Cpu, Rocket, Zap, Database, Clock, TrendingUp } from 'lucide-react';

// --- Types ---
interface Upgrade {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  baseValue: number;
  type: 'click' | 'auto' | 'multiplier';
  icon: React.ReactNode;
}

interface GameState {
  minerals: number;
  totalMineralsEarned: number;
  upgrades: Record<string, number>;
  lastSaveTime: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  value: string;
}

// --- Constants ---
const UPGRADES: Upgrade[] = [
  {
    id: 'power_drill',
    name: 'Power Drill',
    description: 'Increases minerals per click.',
    baseCost: 15,
    baseValue: 1,
    type: 'click',
    icon: <Pickaxe className="w-5 h-5" />,
  },
  {
    id: 'mining_drone',
    name: 'Mining Drone',
    description: 'Automatically mines minerals.',
    baseCost: 100,
    baseValue: 1,
    type: 'auto',
    icon: <Cpu className="w-5 h-5" />,
  },
  {
    id: 'lunar_station',
    name: 'Lunar Station',
    description: 'Advanced mining facility.',
    baseCost: 1100,
    baseValue: 8,
    type: 'auto',
    icon: <Rocket className="w-5 h-5" />,
  },
  {
    id: 'black_hole_tech',
    name: 'Black Hole Tech',
    description: 'Multiplies all mineral production.',
    baseCost: 5000,
    baseValue: 0.1, // 10% increase per level
    type: 'multiplier',
    icon: <Zap className="w-5 h-5" />,
  },
];

const COST_EXPONENT = 1.15;
const SAVE_KEY = 'cosmic_miner_save_v1';
const MAX_OFFLINE_SECONDS = 2 * 60 * 60; // 2 hours

export default function App() {
  // --- State ---
  const [minerals, setMinerals] = useState<number>(0);
  const [totalMineralsEarned, setTotalMineralsEarned] = useState<number>(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState<Record<string, number>>({});
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [offlineMinerals, setOfflineMinerals] = useState<number | null>(null);
  const [isPlanetPressed, setIsPlanetPressed] = useState(false);

  // --- Refs ---
  const nextTextId = useRef(0);
  const lastTickTime = useRef(Date.now());

  // --- Calculations ---
  const getUpgradeCost = (upgrade: Upgrade) => {
    const count = ownedUpgrades[upgrade.id] || 0;
    return Math.floor(upgrade.baseCost * Math.pow(COST_EXPONENT, count));
  };

  const getClickValue = () => {
    const drillLevel = ownedUpgrades['power_drill'] || 0;
    const base = 1 + (drillLevel * UPGRADES[0].baseValue);
    const multiplier = 1 + (ownedUpgrades['black_hole_tech'] || 0) * 0.1;
    return base * multiplier;
  };

  const getMineralsPerSecond = () => {
    let mps = 0;
    UPGRADES.forEach(u => {
      if (u.type === 'auto') {
        mps += (ownedUpgrades[u.id] || 0) * u.baseValue;
      }
    });
    const multiplier = 1 + (ownedUpgrades['black_hole_tech'] || 0) * 0.1;
    return mps * multiplier;
  };

  // --- Persistence ---
  const saveGame = useCallback(() => {
    const state: GameState = {
      minerals,
      totalMineralsEarned,
      upgrades: ownedUpgrades,
      lastSaveTime: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }, [minerals, totalMineralsEarned, ownedUpgrades]);

  const loadGame = () => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const state: GameState = JSON.parse(saved);
        setMinerals(state.minerals);
        setTotalMineralsEarned(state.totalMineralsEarned);
        setOwnedUpgrades(state.upgrades);

        // Offline Progress
        const now = Date.now();
        const secondsOffline = Math.min((now - state.lastSaveTime) / 1000, MAX_OFFLINE_SECONDS);
        
        // We need to calculate MPS based on loaded upgrades
        let mps = 0;
        UPGRADES.forEach(u => {
          if (u.type === 'auto') {
            mps += (state.upgrades[u.id] || 0) * u.baseValue;
          }
        });
        const multiplier = 1 + (state.upgrades['black_hole_tech'] || 0) * 0.1;
        const earned = Math.floor(mps * multiplier * secondsOffline);
        
        if (earned > 0) {
          setMinerals(prev => prev + earned);
          setTotalMineralsEarned(prev => prev + earned);
          setOfflineMinerals(earned);
        }
      } catch (e) {
        console.error("Failed to load save", e);
      }
    }
  };

  // --- Initialization ---
  useEffect(() => {
    loadGame();
  }, []);

  // --- Game Loop ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickTime.current) / 1000;
      lastTickTime.current = now;

      const mps = getMineralsPerSecond();
      if (mps > 0) {
        const gained = mps * delta;
        setMinerals(prev => prev + gained);
        setTotalMineralsEarned(prev => prev + gained);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [ownedUpgrades]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(saveGame, 30000);
    return () => clearInterval(interval);
  }, [saveGame]);

  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  // --- Actions ---
  const createParticles = (x: number, y: number, color: string) => {
    const newParticles = Array.from({ length: 12 }).map((_, i) => ({
      id: Math.random(),
      x,
      y,
      color
    }));
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);
  };

  const handlePlanetClick = (e: React.MouseEvent | React.TouchEvent) => {
    const value = getClickValue();
    setMinerals(prev => prev + value);
    setTotalMineralsEarned(prev => prev + value);

    // Visual feedback
    setIsPlanetPressed(true);
    setTimeout(() => setIsPlanetPressed(false), 100);

    // Floating text
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const id = nextTextId.current++;
    setFloatingTexts(prev => [
      ...prev,
      { id, x: clientX, y: clientY, value: `+${value.toFixed(1)}` }
    ]);

    // Cleanup floating text
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id));
    }, 1000);
  };

  const buyUpgrade = (upgrade: Upgrade, e: React.MouseEvent) => {
    const cost = getUpgradeCost(upgrade);
    if (minerals >= cost) {
      setMinerals(prev => prev - cost);
      setOwnedUpgrades(prev => ({
        ...prev,
        [upgrade.id]: (prev[upgrade.id] || 0) + 1
      }));
      
      // Level up particles
      createParticles(e.clientX, e.clientY, '#22d3ee');
    }
  };

  // --- Render Helpers ---
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return Math.floor(num).toString();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col select-none">
      {/* Background Stars/Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Header / Stats */}
      <header className="relative z-10 p-6 flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400">
            <Database className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Minerals</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter">
            {formatNumber(minerals)}
          </h1>
          <div className="flex items-center gap-2 text-white/40 text-xs font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>{formatNumber(getMineralsPerSecond())}/s</span>
          </div>
        </div>

        <button 
          onClick={saveGame}
          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Clock className="w-5 h-5 text-violet-400" />
        </button>
      </header>

      {/* Main Gameplay Area */}
      <main className="flex-1 relative flex items-center justify-center">
        {/* The Planet */}
        <motion.div
          animate={{
            scale: isPlanetPressed ? 0.92 : 1,
            rotate: 360,
          }}
          transition={{
            rotate: { duration: 60, repeat: Infinity, ease: "linear" },
            scale: { type: "spring", stiffness: 400, damping: 10 }
          }}
          onPointerDown={handlePlanetClick}
          className="relative w-64 h-64 md:w-80 md:h-80 cursor-pointer group"
        >
          {/* Planet Atmosphere/Glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 blur-2xl group-hover:blur-3xl transition-all duration-500" />
          
          {/* Planet Body */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-violet-600 to-indigo-900 shadow-[inset_-20px_-20px_50px_rgba(0,0,0,0.8),0_0_40px_rgba(34,211,238,0.3)] border border-white/10 overflow-hidden">
            {/* Texture/Craters */}
            <div className="absolute top-10 left-10 w-12 h-12 rounded-full bg-black/20 blur-sm" />
            <div className="absolute bottom-20 right-12 w-20 h-20 rounded-full bg-black/10 blur-md" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-30 mix-blend-overlay bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-white" />
          </div>

          {/* Pulse Effect */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-2 border-cyan-500/30"
          />
        </motion.div>

        {/* Particles */}
        {particles.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
            animate={{ 
              x: p.x + (Math.random() - 0.5) * 200, 
              y: p.y + (Math.random() - 0.5) * 200, 
              opacity: 0,
              scale: 0
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="fixed w-2 h-2 rounded-full z-50 pointer-events-none"
            style={{ backgroundColor: p.color, boxShadow: `0 0 10px ${p.color}` }}
          />
        ))}

        {/* Floating Texts */}
        <AnimatePresence>
          {floatingTexts.map(text => (
            <motion.div
              key={text.id}
              initial={{ opacity: 1, y: text.y - 20, x: text.x }}
              animate={{ opacity: 0, y: text.y - 120 }}
              exit={{ opacity: 0 }}
              className="fixed pointer-events-none text-cyan-400 font-black text-xl z-50 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
              style={{ left: 0, top: 0 }}
            >
              {text.value}
            </motion.div>
          ))}
        </AnimatePresence>
      </main>

      {/* Upgrade Shop */}
      <section className="relative z-10 p-6 bg-white/5 backdrop-blur-xl border-t border-white/10 rounded-t-[2.5rem] max-h-[45vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/50">Upgrade Tech</h2>
          <div className="text-[10px] font-mono text-cyan-400/60">LVL {Object.values(ownedUpgrades).reduce((a, b) => a + b, 0)}</div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {UPGRADES.map(upgrade => {
            const cost = getUpgradeCost(upgrade);
            const count = ownedUpgrades[upgrade.id] || 0;
            const canAfford = minerals >= cost;

            return (
              <button
                key={upgrade.id}
                onClick={(e) => buyUpgrade(upgrade, e)}
                disabled={!canAfford}
                className={`group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                  canAfford 
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-cyan-500/50' 
                    : 'bg-black/20 border-white/5 opacity-50 grayscale cursor-not-allowed'
                }`}
              >
                <div className={`p-3 rounded-xl ${canAfford ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-white/20'}`}>
                  {upgrade.icon}
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">{upgrade.name}</h3>
                    <span className="text-xs font-mono text-white/40">x{count}</span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-0.5">{upgrade.description}</p>
                </div>

                <div className="text-right">
                  <div className={`text-sm font-black ${canAfford ? 'text-cyan-400' : 'text-white/20'}`}>
                    {formatNumber(cost)}
                  </div>
                  <div className="text-[9px] uppercase tracking-tighter text-white/30">Minerals</div>
                </div>

                {/* Progress bar for affordability */}
                {canAfford && (
                  <div className="absolute bottom-0 left-0 h-0.5 bg-cyan-500/30 rounded-full transition-all duration-300" style={{ width: '100%' }} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Offline Progress Modal */}
      <AnimatePresence>
        {offlineMinerals !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0f0f0f] border border-white/10 p-8 rounded-[2rem] max-w-xs w-full text-center space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-8 h-8 text-violet-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black">Welcome Back!</h2>
                <p className="text-sm text-white/50">Your automated systems mined while you were away.</p>
              </div>
              <div className="py-4 px-6 bg-white/5 rounded-2xl border border-white/10">
                <div className="text-3xl font-black text-cyan-400">+{formatNumber(offlineMinerals)}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 mt-1">Minerals Earned</div>
              </div>
              <button
                onClick={() => setOfflineMinerals(null)}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Collect Minerals
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Styles for Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}} />
    </div>
  );
}
