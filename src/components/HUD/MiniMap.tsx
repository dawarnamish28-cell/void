import { useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { socketClient } from '../../socket/socketClient';
import { GAME, PLAYER_COLORS } from '@shared/constants';
import { TileType } from '@shared/types';
import { ROOM_DEFS } from '@shared/map';

export default function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapData = useGameStore(s => s.mapData);
  const players = useGameStore(s => s.players);
  const myId = socketClient.id || '';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const ctx = canvas.getContext('2d')!;
    const scale = 1.5;
    canvas.width = mapData.width * scale;
    canvas.height = mapData.height * scale;

    // Draw map
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const tile = mapData.tiles[y][x];
        if (tile === TileType.FLOOR || tile === TileType.VENT || tile === TileType.TASK) {
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(x * scale, y * scale, scale, scale);
        } else if (tile === TileType.WALL) {
          ctx.fillStyle = '#2d2d4e';
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }

    // Draw room labels
    ctx.font = `${scale * 1.5}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    for (const room of ROOM_DEFS) {
      const rx = (room.x + room.width / 2) * scale;
      const ry = (room.y + room.height / 2) * scale + scale;
      ctx.fillText(room.name.slice(0, 4).toUpperCase(), rx, ry);
    }

    // Draw player dots
    for (const player of players) {
      if (!player.isAlive) continue;
      const color = PLAYER_COLORS[player.color] || '#888';
      const px = player.position.x * scale;
      const py = player.position.y * scale;
      
      ctx.fillStyle = player.id === myId ? '#ffffff' : color;
      ctx.beginPath();
      ctx.arc(px, py, player.id === myId ? scale : scale * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [mapData, players]);

  return (
    <div className="h-full flex flex-col p-3 bg-void-panel/50">
      <h3 className="text-xs font-mono text-void-muted uppercase tracking-wider mb-3">
        🗺️ Admin Map
      </h3>
      <div className="flex-1 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full border border-void-border rounded"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="mt-2 text-[10px] text-void-muted font-mono text-center">
        Press M to toggle
      </div>
    </div>
  );
}
