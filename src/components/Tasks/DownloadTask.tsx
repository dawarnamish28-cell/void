import { useState, useEffect } from 'react';

interface Props {
  onComplete: () => void;
}

export default function DownloadTask({ onComplete }: Props) {
  const [progress, setProgress] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 2;
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [started, onComplete]);

  return (
    <div className="bg-void-bg rounded-xl p-6 text-center">
      <div className="mb-6">
        <div className="text-4xl mb-2">
          {progress >= 100 ? '✅' : '📥'}
        </div>
        <p className="text-sm text-void-muted font-mono">
          {!started ? 'Click to start download' : progress >= 100 ? 'Download complete!' : 'Downloading...'}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-void-panel rounded-full h-4 border border-void-border mb-4">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #6c5ce7, #a29bfe)',
          }}
        />
      </div>

      <div className="text-sm font-mono text-void-muted mb-4">
        {progress}% • {started ? `${Math.round((100 - progress) / 20)}s remaining` : 'Ready'}
      </div>

      {/* File list animation */}
      <div className="bg-void-panel rounded-lg p-3 text-left text-xs font-mono space-y-1 max-h-32 overflow-hidden">
        {started && Array.from({ length: Math.floor(progress / 10) }).map((_, i) => (
          <div key={i} className="text-void-success/70 animate-fade-in">
            ✓ data_block_{String(i + 1).padStart(3, '0')}.bin
          </div>
        ))}
        {started && progress < 100 && (
          <div className="text-void-accent animate-pulse-red">
            ↓ downloading data_block_{String(Math.floor(progress / 10) + 1).padStart(3, '0')}.bin...
          </div>
        )}
      </div>

      {!started && (
        <button
          onClick={() => setStarted(true)}
          className="mt-4 btn-primary px-8 py-2 font-bold"
        >
          START DOWNLOAD
        </button>
      )}
    </div>
  );
}
