import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  onComplete: () => void;
}

export default function FuelTask({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (holding) {
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          const wobble = (Math.random() - 0.5) * 2;
          const next = Math.min(100, prev + 1.5 + wobble);
          if (next >= 100) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTimeout(onComplete, 300);
            return 100;
          }
          return next;
        });
      }, 50);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Slowly drain if not holding
      intervalRef.current = setInterval(() => {
        setProgress(prev => Math.max(0, prev - 0.5));
      }, 50);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [holding, onComplete]);

  return (
    <div className="bg-void-bg rounded-xl p-6 text-center">
      {/* Fuel gauge */}
      <div className="w-16 mx-auto mb-6 relative" style={{ height: 160 }}>
        <div className="absolute inset-0 border-2 border-void-border rounded-lg overflow-hidden">
          <div
            className="absolute bottom-0 w-full transition-all duration-100"
            style={{
              height: `${progress}%`,
              background: progress > 80
                ? 'linear-gradient(to top, #2ecc71, #27ae60)'
                : progress > 40
                ? 'linear-gradient(to top, #f39c12, #e67e22)'
                : 'linear-gradient(to top, #e74c3c, #c0392b)',
            }}
          />
        </div>
        {/* Level markers */}
        {[25, 50, 75].map(level => (
          <div
            key={level}
            className="absolute left-0 right-0 border-t border-void-border/30"
            style={{ bottom: `${level}%` }}
          />
        ))}
        <div className="absolute -right-8 top-0 text-xs text-void-muted font-mono">100</div>
        <div className="absolute -right-4 bottom-0 text-xs text-void-muted font-mono">0</div>
      </div>

      <div className="text-sm text-void-muted mb-4 font-mono">
        {Math.round(progress)}%
      </div>

      {/* Fuel button */}
      <button
        onMouseDown={() => setHolding(true)}
        onMouseUp={() => setHolding(false)}
        onMouseLeave={() => setHolding(false)}
        className={`px-8 py-4 rounded-xl font-bold text-lg transition-all select-none ${
          holding
            ? 'bg-void-success text-white scale-95 neon-glow-green'
            : 'bg-void-panel border-2 border-void-border hover:border-void-accent'
        } ${progress >= 100 ? 'bg-void-success text-white' : ''}`}
      >
        {progress >= 100 ? '✓ FULL' : holding ? '⛽ FUELING...' : '⛽ HOLD TO FUEL'}
      </button>
    </div>
  );
}
