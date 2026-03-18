import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { PlayerRole, GAME } from '@shared/constants';

export default function RoleReveal() {
  const myRole = useGameStore(s => s.myRole);
  const impostorNames = useGameStore(s => s.impostorNames);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setTimeout(() => setVisible(true), 300);
    
    // Animate progress bar
    const duration = (GAME.ROLE_REVEAL_SECS - 1) * 1000; // leave 1s buffer
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, 50);
    
    return () => clearInterval(interval);
  }, []);

  const isImpostor = myRole === PlayerRole.IMPOSTOR;

  return (
    <div className="w-full h-full flex items-center justify-center" style={{
      background: isImpostor
        ? 'radial-gradient(ellipse at center, #2a0a0a 0%, #0a0a12 70%)'
        : 'radial-gradient(ellipse at center, #0a1a2a 0%, #0a0a12 70%)',
    }}>
      <div className={`text-center transition-all duration-1000 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        <div className={`glass-panel rounded-2xl p-12 min-w-[400px] ${isImpostor ? 'neon-glow-red' : 'neon-glow'}`}>
          <p className="text-lg text-void-muted mb-3 font-mono tracking-[0.3em] uppercase animate-pulse">
            You are {isImpostor ? 'an' : 'a'}
          </p>
          <h1 className={`text-7xl font-bold mb-6 ${isImpostor ? 'text-void-danger' : 'text-void-accent'}`}
            style={{ fontFamily: 'Courier Prime, monospace', textShadow: isImpostor ? '0 0 30px rgba(231,76,60,0.5)' : '0 0 30px rgba(52,152,219,0.5)' }}>
            {isImpostor ? '😈 IMPOSTOR' : '🧑‍🚀 CREWMATE'}
          </h1>
          
          {isImpostor ? (
            <div className="space-y-3">
              <p className="text-void-muted text-lg">Eliminate the crew. Sabotage. Deceive.</p>
              {impostorNames.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-800/30">
                  <p className="text-sm text-void-danger/70 mb-1">Fellow Impostors:</p>
                  <p className="text-void-danger font-bold text-lg">{impostorNames.join(', ')}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-void-muted text-lg">Complete your tasks. Find the impostors.</p>
              <p className="text-void-muted/60 text-sm">Trust no one.</p>
            </div>
          )}

          <div className="mt-8 w-full bg-void-bg rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-100 ${isImpostor ? 'bg-void-danger' : 'bg-void-accent'}`} 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <p className="text-void-muted/40 text-xs mt-2 font-mono">
            Game starting in {Math.max(0, Math.ceil(GAME.ROLE_REVEAL_SECS * (1 - progress / 100)))}s...
          </p>
        </div>
      </div>
    </div>
  );
}
