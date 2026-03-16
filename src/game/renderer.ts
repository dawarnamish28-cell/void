import { GAME, PLAYER_COLORS } from '@shared/constants';
import { TileType, MapData, PlayerView, DeadBody, TaskStation, Vent, Position, RoomRegion } from '@shared/types';
import { TASK_STATIONS, VENTS, ROOM_DEFS } from '@shared/map';

const TILE = GAME.TILE_SIZE;

// ─── Colors ───
const COLORS = {
  floor: '#1a1a2e',
  floorAlt: '#16162a',
  wall: '#2d2d4e',
  wallTop: '#3a3a5e',
  empty: '#0a0a12',
  vent: '#0d3320',
  ventGrate: '#1a6640',
  task: '#1a2a4e',
  taskGlow: '#6c5ce7',
  door: '#4a3520',
  grid: 'rgba(255,255,255,0.03)',
  body: '#e74c3c',
  emergencyBtn: '#e74c3c',
};

export function renderGame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  mapData: MapData,
  players: PlayerView[],
  bodies: DeadBody[],
  myId: string,
  fovRadius: number,
  isGhost: boolean,
  sabotageType: string | null,
) {
  const me = players.find(p => p.id === myId);
  if (!me) return;

  const cw = canvas.width;
  const ch = canvas.height;

  // Camera centered on player
  const camX = me.position.x * TILE - cw / 2;
  const camY = me.position.y * TILE - ch / 2;

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = COLORS.empty;
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.translate(-camX, -camY);

  // ─── DRAW FOV CLIP (if not ghost) ───
  if (!isGhost) {
    ctx.save();
    const px = me.position.x * TILE;
    const py = me.position.y * TILE;
    
    // Cast rays for FOV
    const fovPolygon = castFovRays(px, py, fovRadius, mapData);
    
    ctx.beginPath();
    if (fovPolygon.length > 0) {
      ctx.moveTo(fovPolygon[0].x, fovPolygon[0].y);
      for (let i = 1; i < fovPolygon.length; i++) {
        ctx.lineTo(fovPolygon[i].x, fovPolygon[i].y);
      }
      ctx.closePath();
    }
    ctx.clip();
  }

  // ─── DRAW MAP ───
  const startTileX = Math.max(0, Math.floor(camX / TILE) - 1);
  const startTileY = Math.max(0, Math.floor(camY / TILE) - 1);
  const endTileX = Math.min(mapData.width, Math.ceil((camX + cw) / TILE) + 1);
  const endTileY = Math.min(mapData.height, Math.ceil((camY + ch) / TILE) + 1);

  for (let ty = startTileY; ty < endTileY; ty++) {
    for (let tx = startTileX; tx < endTileX; tx++) {
      const tile = mapData.tiles[ty]?.[tx];
      if (tile === undefined) continue;
      const x = tx * TILE;
      const y = ty * TILE;

      switch (tile) {
        case TileType.FLOOR:
          ctx.fillStyle = (tx + ty) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
          ctx.fillRect(x, y, TILE, TILE);
          // Grid lines
          ctx.strokeStyle = COLORS.grid;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, TILE, TILE);
          break;
        case TileType.WALL:
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, TILE, TILE);
          // Top face
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(x, y, TILE, TILE * 0.3);
          // Border
          ctx.strokeStyle = '#1a1a3e';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE, TILE);
          break;
        case TileType.VENT:
          ctx.fillStyle = COLORS.floor;
          ctx.fillRect(x, y, TILE, TILE);
          // Vent grate
          ctx.fillStyle = COLORS.vent;
          ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
          ctx.strokeStyle = COLORS.ventGrate;
          ctx.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const ly = y + 8 + i * 7;
            ctx.beginPath();
            ctx.moveTo(x + 6, ly);
            ctx.lineTo(x + TILE - 6, ly);
            ctx.stroke();
          }
          break;
        case TileType.TASK:
          ctx.fillStyle = COLORS.floor;
          ctx.fillRect(x, y, TILE, TILE);
          // Task station
          ctx.fillStyle = COLORS.task;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = COLORS.taskGlow;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
          // Pulse effect
          ctx.fillStyle = `rgba(108, 92, 231, ${0.2 + 0.1 * Math.sin(Date.now() / 500)})`;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          break;
        case TileType.EMPTY:
          // Already drawn as background
          break;
      }
    }
  }

  // ─── DRAW ROOM LABELS ───
  ctx.font = '10px "Courier Prime", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (const room of ROOM_DEFS) {
    const rx = (room.x + room.width / 2) * TILE;
    const ry = (room.y + room.height / 2) * TILE;
    ctx.fillText(room.name.toUpperCase(), rx, ry);
  }

  // ─── DRAW EMERGENCY BUTTON ───
  const btnX = mapData.emergencyButton.x * TILE;
  const btnY = mapData.emergencyButton.y * TILE;
  ctx.fillStyle = COLORS.emergencyBtn;
  ctx.beginPath();
  ctx.arc(btnX + TILE / 2, btnY + TILE / 2, TILE / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', btnX + TILE / 2, btnY + TILE / 2 + 3);

  // ─── DRAW DEAD BODIES ───
  for (const body of bodies) {
    const bx = body.position.x * TILE;
    const by = body.position.y * TILE;
    const color = PLAYER_COLORS[body.color] || body.color;
    
    // Body (lying down bean)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(bx + TILE / 2, by + TILE / 2 + 4, TILE / 2 - 2, TILE / 3 - 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Bone (X mark)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + 6, by + 2);
    ctx.lineTo(bx + TILE - 6, by + TILE / 2);
    ctx.moveTo(bx + TILE - 6, by + 2);
    ctx.lineTo(bx + 6, by + TILE / 2);
    ctx.stroke();
  }

  // ─── DRAW PLAYERS ───
  for (const player of players) {
    if (!player.isAlive && player.id !== myId) continue;
    drawPlayer(ctx, player, player.id === myId);
  }

  if (!isGhost) {
    ctx.restore(); // restore FOV clip
  }

  // ─── DRAW FOV DARKNESS (outside clip) ───
  if (!isGhost) {
    const px = me.position.x * TILE;
    const py = me.position.y * TILE;
    const fovPolygon = castFovRays(px, py, fovRadius, mapData);

    // Draw dark overlay with FOV hole
    ctx.save();
    ctx.beginPath();
    // Full canvas rectangle
    ctx.rect(camX - 100, camY - 100, cw + 200, ch + 200);
    // FOV hole (counter-clockwise)
    if (fovPolygon.length > 0) {
      ctx.moveTo(fovPolygon[fovPolygon.length - 1].x, fovPolygon[fovPolygon.length - 1].y);
      for (let i = fovPolygon.length - 1; i >= 0; i--) {
        ctx.lineTo(fovPolygon[i].x, fovPolygon[i].y);
      }
    }
    ctx.fillStyle = 'rgba(5, 5, 12, 0.95)';
    ctx.fill('evenodd');
    ctx.restore();
  }

  ctx.restore(); // restore camera transform
}

// ─── DRAW PLAYER ───
function drawPlayer(ctx: CanvasRenderingContext2D, player: PlayerView, isMe: boolean) {
  const px = player.position.x * TILE;
  const py = player.position.y * TILE;
  const color = PLAYER_COLORS[player.color] || '#888';
  const alpha = player.isAlive ? 1 : 0.4;

  ctx.globalAlpha = alpha;

  // Bean body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE / 2 + 2, TILE / 2 - 3, TILE / 2 - 1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Visor
  ctx.fillStyle = '#a8d8ea';
  const visorOffsetX = player.direction === 'left' ? -3 : player.direction === 'right' ? 3 : 0;
  const visorOffsetY = player.direction === 'up' ? -2 : player.direction === 'down' ? 2 : 0;
  ctx.beginPath();
  ctx.ellipse(
    px + TILE / 2 + visorOffsetX,
    py + TILE / 2 - 2 + visorOffsetY,
    5, 4, 0, 0, Math.PI * 2
  );
  ctx.fill();

  // Visor shine
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(
    px + TILE / 2 + visorOffsetX + 1,
    py + TILE / 2 - 3 + visorOffsetY,
    2, 1.5, 0, 0, Math.PI * 2
  );
  ctx.fill();

  // Name tag
  ctx.fillStyle = isMe ? '#fff' : 'rgba(255,255,255,0.8)';
  ctx.font = `${isMe ? 'bold ' : ''}9px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(player.name, px + TILE / 2, py - 4);

  ctx.globalAlpha = 1;
}

// ─── FOV RAYCASTING ───
function castFovRays(px: number, py: number, radius: number, mapData: MapData): Position[] {
  const points: Position[] = [];
  const rayCount = 120;

  for (let i = 0; i < rayCount; i++) {
    const angle = (2 * Math.PI * i) / rayCount;
    const point = castRay(px, py, angle, radius, mapData);
    points.push(point);
  }

  return points;
}

function castRay(ox: number, oy: number, angle: number, maxDist: number, mapData: MapData): Position {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const step = 4; // Step size in pixels
  let dist = 0;

  while (dist < maxDist) {
    dist += step;
    const x = ox + dx * dist;
    const y = oy + dy * dist;
    const tileX = Math.floor(x / TILE);
    const tileY = Math.floor(y / TILE);

    if (tileX < 0 || tileX >= mapData.width || tileY < 0 || tileY >= mapData.height) {
      return { x, y };
    }

    const tile = mapData.tiles[tileY]?.[tileX];
    if (tile === TileType.WALL || tile === TileType.EMPTY) {
      return { x: ox + dx * (dist - step), y: oy + dy * (dist - step) };
    }
  }

  return { x: ox + dx * maxDist, y: oy + dy * maxDist };
}
