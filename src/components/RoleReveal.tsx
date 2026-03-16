import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { PlayerRole, GAME } from '@shared/constants';

export default function RoleReveal() {
  const myRole = useGameStore(s => s.myRole);
  const impostorNames = useGameStore(s => s.impostorNames);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 200);
  }, []);

  const isImpostor = myRole === PlayerRole.IMPOSTOR;

  return (
    <div className="w-full h-full flex items-center justify-center" style={{
      background: isImpostor
        ? 'radial-gradient(ellipse at center, #2a0a0a 0%, #0a0a12 70%)'
        : 'radial-gradient(ellipse at center, #0a1a2a 0%, #0a0a12 70%)',
    }}>
      <div className={`text-center transition-all duration-1000 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        <div className={`glass-panel rounded-2xl p-12 ${isImpostor ? 'neon-glow-red' : 'neon-glow'}`}>
          <p className="text-lg text-void-muted mb-2 font-mono tracking-widest uppercase">You are {isImpostor ? 'an' : 'a'}</p>
          <h1 className={`text-6xl font-bold mb-4 ${isImpostor ? 'text-void-danger' : 'text-void-accent'}`}
            style={{ fontFamily: 'Courier Prime, monospace' }}>
            {isImpostor ? '😈 IMPOSTOR' : '🧑‍🚀 CREWMATE'}
          </h1>
          
          {isImpostor ? (
            <div>
              <p className="text-void-muted mt-4">Eliminate the crew. Trust no one.</p>
              {impostorNames.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-void-danger/70">Fellow Impostors:</p>
                  <p className="text-void-danger font-bold">{impostorNames.join(', ')}</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-void-muted mt-4">Complete your tasks. Trust no one.</p>
            </div>
          )}

          <div className="mt-6 w-full bg-void-bg rounded-full h-1">
            <div className="bg-void-accent h-1 rounded-full transition-all duration-1000" style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
