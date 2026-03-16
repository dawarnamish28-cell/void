import { useState, useEffect } from 'react';
import { TaskType } from '@shared/constants';

interface Props {
  onComplete: () => void;
  taskType: TaskType;
  label: string;
}

export default function GenericTask({ onComplete, taskType, label }: Props) {
  const [progress, setProgress] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [sliderVal, setSliderVal] = useState(50);
  const [code, setCode] = useState('');
  const [targetCode] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));

  const handleAction = () => {
    switch (taskType) {
      case TaskType.SCAN_MEDBAY:
      case TaskType.CALIBRATE_SHIELDS:
        setClicks(prev => prev + 1);
        break;
      case TaskType.ENTER_ID:
        // Handled by code input
        break;
      case TaskType.ALIGN_NAV:
        // Handled by slider
        break;
      case TaskType.EMPTY_GARBAGE:
        setProgress(prev => Math.min(100, prev + 15));
        break;
      default:
        setProgress(prev => Math.min(100, prev + 20));
    }
  };

  // Timer-based tasks
  useEffect(() => {
    if (taskType === TaskType.SCAN_MEDBAY && clicks > 0) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(onComplete, 300);
            return 100;
          }
          return prev + 1.5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [clicks, taskType, onComplete]);

  // Click-based completion
  useEffect(() => {
    if (taskType === TaskType.CALIBRATE_SHIELDS && clicks >= 5) {
      onComplete();
    }
    if (taskType === TaskType.EMPTY_GARBAGE && progress >= 100) {
      setTimeout(onComplete, 300);
    }
  }, [clicks, progress, taskType, onComplete]);

  // Code match
  useEffect(() => {
    if (taskType === TaskType.ENTER_ID && code === targetCode) {
      setTimeout(onComplete, 300);
    }
  }, [code, targetCode, taskType, onComplete]);

  // Slider alignment
  useEffect(() => {
    if (taskType === TaskType.ALIGN_NAV && sliderVal >= 48 && sliderVal <= 52) {
      setTimeout(onComplete, 500);
    }
  }, [sliderVal, taskType, onComplete]);

  const renderTaskContent = () => {
    switch (taskType) {
      case TaskType.SCAN_MEDBAY:
        return (
          <div className="text-center">
            <div className="text-6xl mb-4">{progress >= 100 ? '✅' : '🩺'}</div>
            <div className="w-full bg-void-panel rounded-full h-3 mb-4">
              <div className="bg-void-accent h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-void-muted mb-4">
              {clicks === 0 ? 'Step on scanner and press button' : `Scanning... ${Math.round(progress)}%`}
            </p>
            {clicks === 0 && (
              <button onClick={handleAction} className="btn-primary px-6 py-2 font-bold">
                START SCAN
              </button>
            )}
          </div>
        );

      case TaskType.CALIBRATE_SHIELDS:
        return (
          <div className="text-center">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <button
                  key={i}
                  onClick={handleAction}
                  className={`w-16 h-16 rounded-lg transition-all ${
                    i < clicks
                      ? 'bg-void-success neon-glow-green'
                      : i === clicks
                      ? 'bg-void-accent animate-pulse-red neon-glow'
                      : 'bg-void-panel border border-void-border'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-void-muted">Click the blinking panel ({clicks}/5)</p>
          </div>
        );

      case TaskType.ENTER_ID:
        return (
          <div className="text-center">
            <p className="text-sm text-void-muted mb-2">Enter code: <span className="text-void-accent font-bold font-mono text-xl">{targetCode}</span></p>
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto mb-4">
              {[1,2,3,4,5,6,7,8,9,null,0,'⌫'].map((n, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (n === '⌫') setCode(prev => prev.slice(0, -1));
                    else if (n !== null && code.length < 4) setCode(prev => prev + n);
                  }}
                  className={`w-14 h-14 rounded-lg font-bold text-lg transition-all ${
                    n === null ? 'invisible' :
                    'bg-void-panel border border-void-border hover:border-void-accent hover:bg-void-border'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="text-2xl font-mono tracking-[0.5em] text-void-accent">
              {code.padEnd(4, '_')}
            </div>
          </div>
        );

      case TaskType.ALIGN_NAV:
        return (
          <div className="text-center">
            <div className="relative w-full h-32 bg-void-panel rounded-lg mb-4 overflow-hidden">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-void-success/30" />
              {/* Needle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-void-accent transition-all"
                style={{ left: `${sliderVal}%` }}
              />
              {/* Target zone */}
              <div className="absolute top-0 bottom-0 bg-void-success/10" style={{ left: '46%', width: '8%' }} />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderVal}
              onChange={(e) => setSliderVal(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-sm text-void-muted mt-2">Align the needle to the center</p>
          </div>
        );

      case TaskType.EMPTY_GARBAGE:
        return (
          <div className="text-center">
            <div className="text-6xl mb-4">🗑️</div>
            <div className="w-full bg-void-panel rounded-full h-3 mb-4">
              <div className="bg-void-warning h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <button
              onClick={handleAction}
              className="btn-void px-6 py-3 font-bold text-lg active:scale-95 transition-transform"
            >
              🗑️ PULL LEVER ({Math.round(progress)}%)
            </button>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <button onClick={onComplete} className="btn-primary px-6 py-3 font-bold">
              Complete Task
            </button>
          </div>
        );
    }
  };

  return (
    <div className="bg-void-bg rounded-xl p-6">
      {renderTaskContent()}
    </div>
  );
}
