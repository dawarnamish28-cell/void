import { useEffect, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { PLAYER_COLORS } from '@shared/constants';

export default function EjectionScreen() {
  const ejection = useGameStore(s => s.ejection);
  const [phase, setPhase] = useState<'animating' | 'reveal'>('animating');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('reveal'), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!ejection) return null;

  const color = ejection.ejectedColor ? PLAYER_COLORS[ejection.ejectedColor] || ejection.ejectedColor : '#888';

  return (
    <div className="w-full h-full flex items-center justify-center" style={{
      background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #000005 70%)',
    }}>
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: Math.random() * 2 + 0.5 + 'px',
            height: Math.random() * 2 + 0.5 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            opacity: Math.random() * 0.6 + 0.1,
          }} />
        ))}
      </div>

      <div className="relative z-10 text-center">
        {phase === 'animating' && ejection.ejectedName && (
          <div className="relative">
            {/* Ejected bean */}
            <div className="animate-eject">
              <div className="w-16 h-20 rounded-full relative" style={{ backgroundColor: color }}>
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-8 h-4 bg-blue-200 rounded-full opacity-80" />
              </div>
            </div>
          </div>
        )}

        {phase === 'animating' && !ejection.ejectedName && (
          <div className="text-2xl text-void-muted animate-fade-in">
            No one was ejected...
          </div>
        )}

        {phase === 'reveal' && (
          <div className="animate-float-in space-y-4">
            {ejection.ejectedName ? (
              <>
                <div className="w-20 h-24 mx-auto rounded-full relative mb-4" style={{ backgroundColor: color }}>
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-10 h-5 bg-blue-200 rounded-full opacity-80" />
                </div>
                <h2 className="text-3xl font-bold font-mono">
                  <span style={{ color }}>{ejection.ejectedName}</span> was ejected.
                </h2>
                <p className={`text-xl font-mono ${ejection.wasImpostor ? 'text-void-success' : 'text-void-danger'}`}>
                  {ejection.wasImpostor
                    ? `${ejection.ejectedName} was An Impostor.`
                    : `${ejection.ejectedName} was Not An Impostor.`
                  }
                </p>
              </>
            ) : (
              <h2 className="text-3xl font-bold font-mono text-void-muted">
                No one was ejected. (Skipped)
              </h2>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
