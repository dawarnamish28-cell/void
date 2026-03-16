import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  onComplete: () => void;
}

const WIRE_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'];

interface Wire {
  color: string;
  leftIndex: number;
  rightIndex: number;
  connected: boolean;
}

export default function WireTask({ onComplete }: Props) {
  const [wires, setWires] = useState<Wire[]>(() => {
    const shuffledLeft = [...Array(4).keys()].sort(() => Math.random() - 0.5);
    const shuffledRight = [...Array(4).keys()].sort(() => Math.random() - 0.5);
    return WIRE_COLORS.map((color, i) => ({
      color,
      leftIndex: shuffledLeft[i],
      rightIndex: shuffledRight[i],
      connected: false,
    }));
  });

  const [dragging, setDragging] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  const leftPositions = wires
    .slice()
    .sort((a, b) => a.leftIndex - b.leftIndex)
    .map((w, i) => ({ wire: w, y: 30 + i * 60 }));

  const rightPositions = wires
    .slice()
    .sort((a, b) => a.rightIndex - b.rightIndex)
    .map((w, i) => ({ wire: w, y: 30 + i * 60 }));

  const handleLeftMouseDown = (wireIndex: number) => {
    setDragging(wireIndex);
  };

  const handleRightMouseUp = (wireIndex: number) => {
    if (dragging === null) return;
    if (dragging === wireIndex) {
      // Correct connection!
      setWires(prev => {
        const updated = [...prev];
        updated[wireIndex] = { ...updated[wireIndex], connected: true };
        return updated;
      });
    }
    setDragging(null);
  };

  useEffect(() => {
    const handleUp = () => setDragging(null);
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, []);

  // Check if all connected
  useEffect(() => {
    if (wires.every(w => w.connected)) {
      setTimeout(onComplete, 500);
    }
  }, [wires, onComplete]);

  return (
    <div ref={containerRef} className="relative bg-void-bg rounded-xl p-4" style={{ height: 280 }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ padding: '16px' }}>
        {/* Connected wires */}
        {wires.map((wire, i) => {
          if (!wire.connected) return null;
          const leftY = 30 + wire.leftIndex * 60 + 15;
          const rightY = 30 + wire.rightIndex * 60 + 15;
          return (
            <line
              key={`connected-${i}`}
              x1={30}
              y1={leftY}
              x2={370}
              y2={rightY}
              stroke={wire.color}
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        })}

        {/* Dragging wire */}
        {dragging !== null && (
          <line
            x1={30}
            y1={30 + wires[dragging].leftIndex * 60 + 15}
            x2={mousePos.x - 16}
            y2={mousePos.y - 16}
            stroke={wires[dragging].color}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="8,4"
          />
        )}
      </svg>

      {/* Left nodes */}
      <div className="absolute left-4 top-4 flex flex-col gap-[30px]">
        {wires
          .slice()
          .sort((a, b) => a.leftIndex - b.leftIndex)
          .map((wire, i) => {
            const idx = wires.indexOf(wire);
            return (
              <div
                key={`left-${i}`}
                className={`w-[30px] h-[30px] rounded-full cursor-pointer transition-transform hover:scale-125 ${
                  wire.connected ? 'opacity-50' : ''
                }`}
                style={{ backgroundColor: wire.color, boxShadow: `0 0 8px ${wire.color}` }}
                onMouseDown={() => !wire.connected && handleLeftMouseDown(idx)}
              />
            );
          })}
      </div>

      {/* Right nodes */}
      <div className="absolute right-4 top-4 flex flex-col gap-[30px]">
        {wires
          .slice()
          .sort((a, b) => a.rightIndex - b.rightIndex)
          .map((wire, i) => {
            const idx = wires.indexOf(wire);
            return (
              <div
                key={`right-${i}`}
                className={`w-[30px] h-[30px] rounded-full cursor-pointer transition-transform hover:scale-125 ${
                  wire.connected ? 'opacity-50' : ''
                }`}
                style={{ backgroundColor: wire.color, boxShadow: `0 0 8px ${wire.color}` }}
                onMouseUp={() => !wire.connected && handleRightMouseUp(idx)}
              />
            );
          })}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-0 right-0 text-center text-xs text-void-muted">
        Drag from left to matching right color
      </div>
    </div>
  );
}
