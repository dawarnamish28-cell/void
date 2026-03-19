import { GAME, PLAYER_COLORS } from '@shared/constants';
import { TileType, MapData, PlayerView, DeadBody, Position, RoomRegion } from '@shared/types';
import { TASK_STATIONS, VENTS, ROOM_DEFS } from '@shared/map';

const TILE = GAME.TILE_SIZE;

// ─── Color palette (Among Us industrial spaceship style) ───
const C = {
  floorA:     '#2a3a3a',
  floorB:     '#263535',
  floorGrid:  'rgba(255,255,255,0.04)',
  wall:       '#1a2626',
  wallFace:   '#233030',
  wallTop:    '#3a4a4a',
  wallLine:   '#0f1a1a',
  empty:      '#050808',
  ventBase:   '#0a2818',
  ventGrate:  '#1a5a38',
  taskPanel:  '#1a2a3a',
  taskGlow:   '#4fc3f7',
  taskBorder: '#2196f3',
  emergency:  '#d32f2f',
  shadow:     'rgba(0,0,0,0.35)',
};

// ─── Interpolation state for smooth movement ───
const interpState = new Map<string, { x: number; y: number; targetX: number; targetY: number }>();

export function updateInterpolationTargets(players: PlayerView[]) {
  for (const p of players) {
    const s = interpState.get(p.id);
    if (s) {
      s.targetX = p.position.x;
      s.targetY = p.position.y;
    } else {
      interpState.set(p.id, { x: p.position.x, y: p.position.y, targetX: p.position.x, targetY: p.position.y });
    }
  }
  // Clean up disconnected players
  for (const id of interpState.keys()) {
    if (!players.find(p => p.id === id)) interpState.delete(id);
  }
}

function getInterpolatedPos(id: string, fallback: Position): Position {
  const s = interpState.get(id);
  if (!s) return fallback;
  // Lerp towards target
  const lerpFactor = 0.25;
  s.x += (s.targetX - s.x) * lerpFactor;
  s.y += (s.targetY - s.y) * lerpFactor;
  return { x: s.x, y: s.y };
}

// ─── MAIN RENDER ───
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

  // Get interpolated position for camera (smooth tracking)
  const myPos = getInterpolatedPos(myId, me.position);
  const playerPx = myPos.x * TILE + TILE / 2;
  const playerPy = myPos.y * TILE + TILE / 2;
  const camX = playerPx - cw / 2;
  const camY = playerPy - ch / 2;

  // Clear
  ctx.fillStyle = C.empty;
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.translate(-camX, -camY);

  // ─── FOV CLIP ───
  let fovPolygon: Position[] = [];
  if (!isGhost) {
    fovPolygon = castFovRays(playerPx, playerPy, fovRadius, mapData);
    ctx.save();
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

  // ─── DRAW TILES ───
  const pad = 3;
  const sx = Math.max(0, Math.floor(camX / TILE) - pad);
  const sy = Math.max(0, Math.floor(camY / TILE) - pad);
  const ex = Math.min(mapData.width, Math.ceil((camX + cw) / TILE) + pad);
  const ey = Math.min(mapData.height, Math.ceil((camY + ch) / TILE) + pad);

  for (let ty = sy; ty < ey; ty++) {
    for (let tx = sx; tx < ex; tx++) {
      const tile = mapData.tiles[ty]?.[tx];
      if (tile === undefined) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      drawTile(ctx, tile, x, y, tx, ty, mapData);
    }
  }

  // ─── DRAW ROOM FURNITURE (decorative elements per room) ───
  for (const room of ROOM_DEFS) {
    const rx = room.x * TILE;
    const ry = room.y * TILE;
    const rw = room.width * TILE;
    const rh = room.height * TILE;
    // Only draw if room is visible
    if (rx + rw < camX - 100 || rx > camX + cw + 100 || ry + rh < camY - 100 || ry > camY + cw + 100) continue;
    drawRoomDecor(ctx, room);
  }

  // ─── DRAW ROOM LABELS ───
  ctx.font = 'bold 11px "Courier Prime", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (const room of ROOM_DEFS) {
    const rx = (room.x + room.width / 2) * TILE;
    const ry = (room.y + room.height / 2) * TILE;
    ctx.fillText(room.name.toUpperCase(), rx, ry);
  }

  // ─── EMERGENCY BUTTON ───
  drawEmergencyButton(ctx, mapData.emergencyButton);

  // ─── DEAD BODIES ───
  for (const body of bodies) {
    drawDeadBody(ctx, body);
  }

  // ─── PLAYERS (sorted by Y for depth) ───
  const sortedPlayers = [...players].filter(p => p.isAlive || p.id === myId).sort((a, b) => a.position.y - b.position.y);
  for (const player of sortedPlayers) {
    const pos = getInterpolatedPos(player.id, player.position);
    drawAmongUsPlayer(ctx, pos, player, player.id === myId);
  }

  if (!isGhost) {
    ctx.restore(); // restore FOV clip
  }

  // ─── DARKNESS OVERLAY ───
  if (!isGhost) {
    // Dark overlay with FOV hole  
    ctx.save();
    ctx.beginPath();
    ctx.rect(camX - 300, camY - 300, cw + 600, ch + 600);
    if (fovPolygon.length > 0) {
      ctx.moveTo(fovPolygon[fovPolygon.length - 1].x, fovPolygon[fovPolygon.length - 1].y);
      for (let i = fovPolygon.length - 1; i >= 0; i--) {
        ctx.lineTo(fovPolygon[i].x, fovPolygon[i].y);
      }
    }
    ctx.fillStyle = 'rgba(5, 8, 8, 0.97)';
    ctx.fill('evenodd');
    ctx.restore();

    // Soft vignette at edge
    const grad = ctx.createRadialGradient(playerPx, playerPy, fovRadius * 0.5, playerPx, playerPy, fovRadius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(5,8,8,0.5)');
    ctx.save();
    ctx.beginPath();
    if (fovPolygon.length > 0) {
      ctx.moveTo(fovPolygon[0].x, fovPolygon[0].y);
      for (let i = 1; i < fovPolygon.length; i++) ctx.lineTo(fovPolygon[i].x, fovPolygon[i].y);
      ctx.closePath();
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // camera
}

// ─── TILE DRAWING ───
function drawTile(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, tx: number, ty: number, mapData: MapData) {
  switch (tile) {
    case TileType.FLOOR: {
      ctx.fillStyle = (tx + ty) % 2 === 0 ? C.floorA : C.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      // Subtle grid lines
      ctx.strokeStyle = C.floorGrid;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      break;
    }
    case TileType.WALL: {
      // 3D-ish wall block
      ctx.fillStyle = C.wall;
      ctx.fillRect(x, y, TILE, TILE);
      // Top face (lighter)
      ctx.fillStyle = C.wallTop;
      ctx.fillRect(x, y, TILE, TILE * 0.35);
      // Front face
      ctx.fillStyle = C.wallFace;
      ctx.fillRect(x, y + TILE * 0.35, TILE, TILE * 0.65);
      // Dark border
      ctx.strokeStyle = C.wallLine;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, TILE, TILE);
      // Pipe detail on some walls
      if ((tx + ty * 3) % 7 === 0) {
        ctx.strokeStyle = 'rgba(100,120,120,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + TILE * 0.3, y + TILE * 0.5);
        ctx.lineTo(x + TILE * 0.7, y + TILE * 0.5);
        ctx.stroke();
      }
      break;
    }
    case TileType.VENT: {
      // Floor underneath
      ctx.fillStyle = C.floorA;
      ctx.fillRect(x, y, TILE, TILE);
      // Vent grate
      ctx.fillStyle = C.ventBase;
      const pad = 3;
      ctx.fillRect(x + pad, y + pad, TILE - pad * 2, TILE - pad * 2);
      ctx.strokeStyle = C.ventGrate;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + pad, y + pad, TILE - pad * 2, TILE - pad * 2);
      // Grate lines
      for (let i = 0; i < 4; i++) {
        const ly = y + pad + 3 + i * ((TILE - pad * 2 - 6) / 3);
        ctx.beginPath();
        ctx.moveTo(x + pad + 2, ly);
        ctx.lineTo(x + TILE - pad - 2, ly);
        ctx.stroke();
      }
      break;
    }
    case TileType.TASK: {
      ctx.fillStyle = C.floorA;
      ctx.fillRect(x, y, TILE, TILE);
      // Task console
      ctx.fillStyle = C.taskPanel;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      // Screen glow
      const pulse = 0.3 + 0.15 * Math.sin(Date.now() / 600);
      ctx.fillStyle = `rgba(79, 195, 247, ${pulse})`;
      ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      // Border
      ctx.strokeStyle = C.taskBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      break;
    }
  }
}

// ─── ROOM DECORATIONS ───
function drawRoomDecor(ctx: CanvasRenderingContext2D, room: RoomRegion) {
  const x = room.x * TILE;
  const y = room.y * TILE;
  const w = room.width * TILE;
  const h = room.height * TILE;

  // Draw subtle room border outline
  ctx.strokeStyle = 'rgba(60,80,80,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

  // Add some furniture-like decorations based on room name
  ctx.fillStyle = 'rgba(30,50,50,0.4)';
  const name = room.name;
  
  // Tables / consoles in rooms
  if (name.includes('Cafeteria')) {
    // Central table
    const cx = x + w / 2 - TILE * 2;
    const cy = y + h / 2 - TILE;
    ctx.fillStyle = 'rgba(40,55,55,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx + TILE * 2, cy + TILE, TILE * 2.5, TILE * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,80,80,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (name.includes('Admin')) {
    // Admin table
    ctx.fillStyle = 'rgba(35,55,45,0.4)';
    ctx.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.3);
    ctx.strokeStyle = 'rgba(60,90,70,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.3);
  } else if (name.includes('Electrical')) {
    // Electrical panels on wall
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(30,40,30,0.5)';
      ctx.fillRect(x + TILE * (2 + i * 3), y + TILE, TILE * 2, TILE * 2.5);
      ctx.strokeStyle = 'rgba(80,100,60,0.3)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x + TILE * (2 + i * 3), y + TILE, TILE * 2, TILE * 2.5);
    }
  } else if (name.includes('Storage')) {
    // Crates
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = 'rgba(40,60,40,0.5)';
      ctx.fillRect(x + TILE * (2 + i * 5), y + h - TILE * 4, TILE * 3, TILE * 3);
      ctx.strokeStyle = 'rgba(60,90,50,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + TILE * (2 + i * 5), y + h - TILE * 4, TILE * 3, TILE * 3);
    }
  } else if (name.includes('Reactor')) {
    // Reactor core
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = 'rgba(50,30,30,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,40,40,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (name.includes('MedBay')) {
    // Scan platform
    ctx.fillStyle = 'rgba(30,50,50,0.4)';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, TILE * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(50,150,150,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ─── EMERGENCY BUTTON ───
function drawEmergencyButton(ctx: CanvasRenderingContext2D, pos: Position) {
  const px = pos.x * TILE + TILE / 2;
  const py = pos.y * TILE + TILE / 2;
  const r = TILE * 0.75;
  
  // Base platform
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(px, py + 2, r + 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Button
  ctx.fillStyle = C.emergency;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.arc(px - 2, py - 3, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', px, py + 1);
}

// ─── DEAD BODY ───
function drawDeadBody(ctx: CanvasRenderingContext2D, body: DeadBody) {
  const bx = body.position.x * TILE + TILE / 2;
  const by = body.position.y * TILE + TILE / 2;
  const color = PLAYER_COLORS[body.color] || body.color;
  
  // Shadow
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(bx, by + 8, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Half-body (sliced)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(bx - 4, by + 2, 10, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();
  
  // Bone sticking out
  ctx.fillStyle = '#f5f5f5';
  ctx.beginPath();
  ctx.ellipse(bx + 6, by - 2, 3, 6, 0.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Blood pool
  ctx.fillStyle = 'rgba(180, 30, 30, 0.5)';
  ctx.beginPath();
  ctx.ellipse(bx + 2, by + 4, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ─── AMONG US PLAYER CHARACTER ───
function drawAmongUsPlayer(ctx: CanvasRenderingContext2D, pos: Position, player: PlayerView, isMe: boolean) {
  const cx = pos.x * TILE + TILE / 2;
  const cy = pos.y * TILE + TILE / 2;
  const color = PLAYER_COLORS[player.color] || '#888';
  const alpha = player.isAlive ? 1 : 0.3;
  
  ctx.save();
  ctx.globalAlpha = alpha;

  // Character dimensions (in pixels) - player is ~1.5 tiles tall
  const bodyW = 16;  // body half-width
  const bodyH = 22;  // body height from top to bottom
  const legH = 6;    // leg height
  const visorW = 10;
  const visorH = 7;
  
  const topY = cy - bodyH / 2 - 2;
  const botY = cy + bodyH / 2 - 2;

  // ─── SHADOW ───
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(cx, botY + legH + 2, bodyW + 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // ─── BACKPACK (drawn behind body) ───
  const facingLeft = player.direction === 'left';
  const facingRight = player.direction === 'right';
  const bpSide = facingLeft ? 1 : -1; // backpack on opposite side of facing
  if (facingLeft || facingRight) {
    ctx.fillStyle = darkenColor(color, 0.2);
    ctx.beginPath();
    ctx.roundRect(cx + bpSide * (bodyW - 2), topY + 8, 7 * bpSide, 14, 3);
    ctx.fill();
  } else {
    // Facing up/down - backpack visible on right side
    ctx.fillStyle = darkenColor(color, 0.2);
    ctx.beginPath();
    ctx.roundRect(cx + bodyW - 3, topY + 8, 7, 14, 3);
    ctx.fill();
  }

  // ─── BODY (main bean shape) ───
  ctx.fillStyle = color;
  ctx.beginPath();
  // Top dome
  ctx.arc(cx, topY + bodyW, bodyW, Math.PI, 0, false);
  // Right side down
  ctx.lineTo(cx + bodyW, botY);
  // Right leg
  ctx.lineTo(cx + bodyW, botY + legH);
  ctx.arc(cx + bodyW / 2 + 2, botY + legH, bodyW / 2 - 2, 0, Math.PI, false);
  // Gap between legs
  ctx.lineTo(cx + 2, botY);
  ctx.lineTo(cx - 2, botY);
  // Left leg
  ctx.arc(cx - bodyW / 2 - 2, botY + legH, bodyW / 2 - 2, 0, Math.PI, false);
  ctx.lineTo(cx - bodyW, botY);
  // Left side up
  ctx.lineTo(cx - bodyW, topY + bodyW);
  ctx.closePath();
  ctx.fill();

  // ─── BODY SHADING ───
  // Darker at bottom
  const bodyGrad = ctx.createLinearGradient(cx, topY, cx, botY + legH);
  bodyGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
  bodyGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
  bodyGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // ─── VISOR ───
  const visorOffX = facingLeft ? -4 : facingRight ? 4 : 0;
  const visorOffY = player.direction === 'up' ? -1 : player.direction === 'down' ? 2 : 0;
  const visorCx = cx + visorOffX;
  const visorCy = topY + bodyW - 2 + visorOffY;
  
  // Visor base (cyan/light blue)
  ctx.fillStyle = '#7ec8e3';
  ctx.beginPath();
  ctx.ellipse(visorCx + 2, visorCy, visorW, visorH, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Visor highlight/shine
  ctx.fillStyle = 'rgba(200, 230, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(visorCx + 4, visorCy - 2, visorW * 0.4, visorH * 0.35, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // ─── NAME TAG ───
  const nameY = topY - 8;
  ctx.font = `${isMe ? 'bold ' : ''}10px "Outfit", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  
  // Name background
  const nameWidth = ctx.measureText(player.name).width + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(cx - nameWidth / 2, nameY - 11, nameWidth, 13, 3);
  ctx.fill();
  
  ctx.fillStyle = isMe ? '#fff' : 'rgba(255,255,255,0.85)';
  ctx.fillText(player.name, cx, nameY);

  ctx.restore();
}

// ─── COLOR HELPERS ───
function darkenColor(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amount))},${Math.round(g * (1 - amount))},${Math.round(b * (1 - amount))})`;
}

// ─── FOV RAYCASTING ───
function castFovRays(px: number, py: number, radius: number, mapData: MapData): Position[] {
  const points: Position[] = [];
  const rayCount = 160;
  for (let i = 0; i < rayCount; i++) {
    const angle = (2 * Math.PI * i) / rayCount;
    points.push(castRay(px, py, angle, radius, mapData));
  }
  return points;
}

function castRay(ox: number, oy: number, angle: number, maxDist: number, mapData: MapData): Position {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const step = TILE * 0.25;
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
