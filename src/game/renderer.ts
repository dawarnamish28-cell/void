import { GAME, PLAYER_COLORS, PLAYER_COLORS_DARK } from '@shared/constants';
import { TileType, MapData, PlayerView, DeadBody, Position, RoomRegion } from '@shared/types';
import { ROOM_DEFS } from '@shared/map';

const T = GAME.TILE_SIZE; // 48px

// ─── Color Palette ───
const PAL = {
  // Floor: dark teal/green industrial
  floorA: '#2d4a4a',
  floorB: '#2a4545',
  floorGrid: 'rgba(0,0,0,0.15)',
  floorEdge: 'rgba(255,255,255,0.03)',
  // Walls: very dark with visible 3D
  wallDark: '#1a2828',
  wallFront: '#253838',
  wallTop: '#3d5555',
  wallEdge: '#0e1818',
  wallPipe: 'rgba(100,130,130,0.25)',
  wallPanel: 'rgba(40,60,60,0.6)',
  // Others
  empty: '#030606',
  ventBase: '#0e3322',
  ventSlat: '#1a7040',
  ventBorder: '#0a5530',
  taskPanel: '#1a2a40',
  taskScreen: '#4fc3f7',
  taskBorder: '#2196f3',
  emergency: '#d32f2f',
  shadow: 'rgba(0,0,0,0.4)',
};

// ─── Interpolation system ───
const interpState = new Map<string, { x: number; y: number; tx: number; ty: number }>();

export function updateInterpolationTargets(players: PlayerView[]) {
  const seen = new Set<string>();
  for (const p of players) {
    seen.add(p.id);
    const s = interpState.get(p.id);
    if (s) {
      s.tx = p.position.x;
      s.ty = p.position.y;
    } else {
      interpState.set(p.id, { x: p.position.x, y: p.position.y, tx: p.position.x, ty: p.position.y });
    }
  }
  for (const id of interpState.keys()) {
    if (!seen.has(id)) interpState.delete(id);
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getInterpPos(id: string, fallback: Position): Position {
  const s = interpState.get(id);
  if (!s) return fallback;
  s.x = lerp(s.x, s.tx, 0.35);
  s.y = lerp(s.y, s.ty, 0.35);
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
  // Local player position is ALREADY the predicted position (passed from GameView ref).
  // Do NOT interpolate it — use it directly for zero-latency camera.
  const px = me.position.x * T + T / 2;
  const py = me.position.y * T + T / 2;
  const camX = px - cw / 2;
  const camY = py - ch / 2;

  // Clear
  ctx.fillStyle = PAL.empty;
  ctx.fillRect(0, 0, cw, ch);

  ctx.save();
  ctx.translate(-camX, -camY);

  // ─── FOV clip ───
  let fovPoly: Position[] = [];
  if (!isGhost) {
    fovPoly = castFov(px, py, fovRadius, mapData);
    ctx.save();
    ctx.beginPath();
    if (fovPoly.length > 0) {
      ctx.moveTo(fovPoly[0].x, fovPoly[0].y);
      for (let i = 1; i < fovPoly.length; i++) ctx.lineTo(fovPoly[i].x, fovPoly[i].y);
      ctx.closePath();
    }
    ctx.clip();
  }

  // ─── TILES ───
  const pad = 4;
  const sx = Math.max(0, Math.floor(camX / T) - pad);
  const sy = Math.max(0, Math.floor(camY / T) - pad);
  const ex = Math.min(mapData.width, Math.ceil((camX + cw) / T) + pad);
  const ey = Math.min(mapData.height, Math.ceil((camY + ch) / T) + pad);

  for (let ty = sy; ty < ey; ty++) {
    for (let tx = sx; tx < ex; tx++) {
      const tile = mapData.tiles[ty]?.[tx];
      if (tile === undefined) continue;
      drawTile(ctx, tile, tx * T, ty * T, tx, ty);
    }
  }

  // ─── Room decorations ───
  for (const room of ROOM_DEFS) {
    const rx = room.x * T;
    const ry = room.y * T;
    const rw = room.width * T;
    const rh = room.height * T;
    if (rx + rw < camX - 200 || rx > camX + cw + 200 || ry + rh < camY - 200 || ry > camY + ch + 200) continue;
    drawRoomDecor(ctx, room);
  }

  // ─── Room labels ───
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const room of ROOM_DEFS) {
    if (room.name.startsWith('Corridor')) continue;
    const rx = (room.x + room.width / 2) * T;
    const ry = (room.y + room.height / 2) * T;
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillText(room.name.toUpperCase(), rx, ry);
  }

  // ─── Emergency button ───
  drawEmergencyButton(ctx, mapData.emergencyButton);

  // ─── Dead bodies ───
  for (const body of bodies) drawBody(ctx, body);

  // ─── Players (sorted by Y) ───
  const sorted = [...players].filter(p => p.isAlive || p.id === myId).sort((a, b) => a.position.y - b.position.y);
  for (const player of sorted) {
    // Local player: use position directly (already predicted, no lerp delay).
    // Other players: interpolate for smooth movement.
    const pos = player.id === myId ? player.position : getInterpPos(player.id, player.position);
    drawPlayer(ctx, pos, player, player.id === myId);
  }

  if (!isGhost) ctx.restore(); // unclip

  // ─── Dark overlay outside FOV ───
  if (!isGhost && fovPoly.length > 0) {
    // Opaque darkness
    ctx.save();
    ctx.beginPath();
    ctx.rect(camX - 500, camY - 500, cw + 1000, ch + 1000);
    ctx.moveTo(fovPoly[fovPoly.length - 1].x, fovPoly[fovPoly.length - 1].y);
    for (let i = fovPoly.length - 1; i >= 0; i--) ctx.lineTo(fovPoly[i].x, fovPoly[i].y);
    ctx.fillStyle = 'rgba(3,6,6,0.96)';
    ctx.fill('evenodd');
    ctx.restore();

    // Soft edge vignette
    const grad = ctx.createRadialGradient(px, py, fovRadius * 0.55, px, py, fovRadius * 1.05);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, 'rgba(3,6,6,0.25)');
    grad.addColorStop(1, 'rgba(3,6,6,0.7)');
    ctx.save();
    ctx.beginPath();
    if (fovPoly.length > 0) {
      ctx.moveTo(fovPoly[0].x, fovPoly[0].y);
      for (let i = 1; i < fovPoly.length; i++) ctx.lineTo(fovPoly[i].x, fovPoly[i].y);
      ctx.closePath();
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // camera
}

// ─── TILE DRAWING ───
function drawTile(ctx: CanvasRenderingContext2D, tile: number, x: number, y: number, tx: number, ty: number) {
  switch (tile) {
    case TileType.FLOOR: {
      // Base floor color with checkerboard
      ctx.fillStyle = (tx + ty) % 2 === 0 ? PAL.floorA : PAL.floorB;
      ctx.fillRect(x, y, T, T);
      // Grid lines (subtle)
      ctx.strokeStyle = PAL.floorGrid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      // Very subtle inner highlight
      ctx.strokeStyle = PAL.floorEdge;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3);
      break;
    }
    case TileType.WALL: {
      // Wall base
      ctx.fillStyle = PAL.wallDark;
      ctx.fillRect(x, y, T, T);
      // Top face (lighter, gives 3D effect)
      const topH = T * 0.4;
      ctx.fillStyle = PAL.wallTop;
      ctx.fillRect(x, y, T, topH);
      // Front face
      ctx.fillStyle = PAL.wallFront;
      ctx.fillRect(x, y + topH, T, T - topH);
      // Strong edge outlines
      ctx.strokeStyle = PAL.wallEdge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.5, y + 0.5, T - 1, T - 1);
      // Horizontal line between top and front
      ctx.beginPath();
      ctx.moveTo(x, y + topH);
      ctx.lineTo(x + T, y + topH);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Occasional panel detail
      if ((tx * 3 + ty * 7) % 11 === 0) {
        ctx.fillStyle = PAL.wallPanel;
        ctx.fillRect(x + 6, y + topH + 4, T - 12, T - topH - 8);
        ctx.strokeStyle = 'rgba(80,110,110,0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 6, y + topH + 4, T - 12, T - topH - 8);
      }
      // Occasional pipe
      if ((tx + ty * 5) % 9 === 0) {
        ctx.strokeStyle = PAL.wallPipe;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + T * 0.2, y + T * 0.55);
        ctx.lineTo(x + T * 0.8, y + T * 0.55);
        ctx.stroke();
      }
      break;
    }
    case TileType.VENT: {
      // Floor underneath
      ctx.fillStyle = PAL.floorA;
      ctx.fillRect(x, y, T, T);
      // Vent grate (prominent green)
      const p = 4;
      const vw = T - p * 2;
      const vh = T - p * 2;
      ctx.fillStyle = PAL.ventBase;
      ctx.fillRect(x + p, y + p, vw, vh);
      // Border
      ctx.strokeStyle = PAL.ventBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + p, y + p, vw, vh);
      // Slats
      ctx.strokeStyle = PAL.ventSlat;
      ctx.lineWidth = 2;
      const slatCount = 5;
      for (let i = 0; i < slatCount; i++) {
        const sy = y + p + 4 + i * ((vh - 8) / (slatCount - 1));
        ctx.beginPath();
        ctx.moveTo(x + p + 3, sy);
        ctx.lineTo(x + p + vw - 3, sy);
        ctx.stroke();
      }
      // Center screw
      ctx.fillStyle = '#2a6a48';
      ctx.beginPath();
      ctx.arc(x + T / 2, y + T / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case TileType.TASK: {
      // Floor underneath
      ctx.fillStyle = PAL.floorA;
      ctx.fillRect(x, y, T, T);
      // Task console box
      const m = 3;
      ctx.fillStyle = PAL.taskPanel;
      ctx.fillRect(x + m, y + m, T - m * 2, T - m * 2);
      // Screen with pulsing glow
      const pulse = 0.4 + 0.2 * Math.sin(Date.now() / 500);
      ctx.fillStyle = `rgba(79, 195, 247, ${pulse})`;
      ctx.fillRect(x + m + 4, y + m + 4, T - m * 2 - 8, T - m * 2 - 8);
      // Border
      ctx.strokeStyle = PAL.taskBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + m, y + m, T - m * 2, T - m * 2);
      // Small icon lines on screen
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      const cx = x + T / 2;
      const cy = y + T / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 3);
      ctx.lineTo(cx + 6, cy - 3);
      ctx.moveTo(cx - 6, cy + 1);
      ctx.lineTo(cx + 4, cy + 1);
      ctx.moveTo(cx - 6, cy + 5);
      ctx.lineTo(cx + 6, cy + 5);
      ctx.stroke();
      break;
    }
  }
}

// ─── ROOM DECORATIONS ───
function drawRoomDecor(ctx: CanvasRenderingContext2D, room: RoomRegion) {
  const rx = room.x * T;
  const ry = room.y * T;
  const rw = room.width * T;
  const rh = room.height * T;
  const name = room.name;

  // Room border highlight
  ctx.strokeStyle = 'rgba(60,90,90,0.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rx + 4, ry + 4, rw - 8, rh - 8);

  if (name.includes('Cafeteria')) {
    // Large oval table
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    ctx.fillStyle = 'rgba(35,55,55,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, T * 3.5, T * 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,90,90,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Plate dots
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const px = cx + Math.cos(a) * T * 2.5;
      const py = cy + Math.sin(a) * T * 1.5;
      ctx.fillStyle = 'rgba(80,100,100,0.3)';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (name.includes('Admin')) {
    // Admin desk
    ctx.fillStyle = 'rgba(30,50,45,0.5)';
    ctx.fillRect(rx + rw * 0.25, ry + rh * 0.3, rw * 0.5, rh * 0.35);
    ctx.strokeStyle = 'rgba(50,80,70,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rx + rw * 0.25, ry + rh * 0.3, rw * 0.5, rh * 0.35);
    // Monitor
    ctx.fillStyle = 'rgba(40,80,100,0.3)';
    ctx.fillRect(rx + rw * 0.4, ry + rh * 0.35, rw * 0.2, rh * 0.12);
  } else if (name.includes('Electrical')) {
    // Panel boxes on walls
    for (let i = 0; i < 4; i++) {
      const bx = rx + T * (2 + i * 5);
      const by = ry + T;
      ctx.fillStyle = 'rgba(25,40,30,0.6)';
      ctx.fillRect(bx, by, T * 3, T * 3);
      ctx.strokeStyle = 'rgba(60,90,50,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, T * 3, T * 3);
      // Wire details
      ctx.strokeStyle = 'rgba(100,180,60,0.15)';
      ctx.lineWidth = 1;
      for (let j = 0; j < 3; j++) {
        ctx.beginPath();
        ctx.moveTo(bx + 4, by + 8 + j * T);
        ctx.lineTo(bx + T * 3 - 4, by + 8 + j * T);
        ctx.stroke();
      }
    }
  } else if (name.includes('Storage')) {
    // Crates
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const bx = rx + T * 2 + i * T * 4;
        const by = ry + rh - T * (4 + j * 3);
        ctx.fillStyle = j === 0 ? 'rgba(50,70,40,0.5)' : 'rgba(40,60,35,0.4)';
        ctx.fillRect(bx, by, T * 2.5, T * 2.5);
        ctx.strokeStyle = 'rgba(70,100,50,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, T * 2.5, T * 2.5);
        // Cross lines
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + T * 2.5, by + T * 2.5);
        ctx.moveTo(bx + T * 2.5, by);
        ctx.lineTo(bx, by + T * 2.5);
        ctx.strokeStyle = 'rgba(70,100,50,0.15)';
        ctx.stroke();
      }
    }
  } else if (name.includes('Reactor')) {
    // Reactor core circle
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    // Outer ring
    ctx.strokeStyle = 'rgba(120,40,40,0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, T * 3, 0, Math.PI * 2);
    ctx.stroke();
    // Inner glow
    const pulse = 0.15 + 0.1 * Math.sin(Date.now() / 800);
    ctx.fillStyle = `rgba(200,60,60,${pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy, T * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,25,25,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, T * 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (name.includes('MedBay')) {
    // Scan platform
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    ctx.fillStyle = 'rgba(30,55,55,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, T * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(50,160,160,0.2)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Scan lines
    const scanY = cy - T + (Date.now() / 20 % (T * 2));
    ctx.strokeStyle = 'rgba(50,200,200,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - T * 1.5, scanY);
    ctx.lineTo(cx + T * 1.5, scanY);
    ctx.stroke();
  } else if (name.includes('Engine')) {
    // Engine cylinders
    for (let i = 0; i < 2; i++) {
      const ex = rx + rw * (0.25 + i * 0.4);
      const ey = ry + rh * 0.3;
      ctx.fillStyle = 'rgba(40,50,40,0.5)';
      ctx.fillRect(ex, ey, T * 3, T * 4);
      ctx.strokeStyle = 'rgba(70,90,60,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ex, ey, T * 3, T * 4);
    }
  } else if (name.includes('Security')) {
    // Monitor bank
    ctx.fillStyle = 'rgba(30,40,50,0.5)';
    ctx.fillRect(rx + rw * 0.2, ry + T, rw * 0.6, rh * 0.4);
    // Screen glow
    ctx.fillStyle = 'rgba(40,80,120,0.2)';
    ctx.fillRect(rx + rw * 0.25, ry + T + 4, rw * 0.5, rh * 0.3);
  } else if (name.includes('Navigation')) {
    // Navigation console
    ctx.fillStyle = 'rgba(25,40,50,0.5)';
    ctx.fillRect(rx + rw * 0.2, ry + T * 2, rw * 0.6, rh * 0.3);
    // Star display
    ctx.fillStyle = 'rgba(30,60,100,0.2)';
    ctx.fillRect(rx + rw * 0.25, ry + T * 2.5, rw * 0.5, rh * 0.15);
  } else if (name.includes('Weapons')) {
    // Weapons console
    ctx.fillStyle = 'rgba(35,35,45,0.5)';
    const wcx = rx + rw / 2;
    const wcy = ry + rh / 2;
    ctx.beginPath();
    ctx.arc(wcx, wcy, T * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,80,100,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (name.includes('Shields')) {
    // Shield hex pattern
    ctx.strokeStyle = 'rgba(50,100,120,0.15)';
    ctx.lineWidth = 1;
    const scx = rx + rw / 2;
    const scy = ry + rh / 2;
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const angle = (Math.PI / 3) * a - Math.PI / 6;
        const hx = scx + Math.cos(angle) * T * r;
        const hy = scy + Math.sin(angle) * T * r;
        if (a === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

// ─── EMERGENCY BUTTON ───
function drawEmergencyButton(ctx: CanvasRenderingContext2D, pos: Position) {
  const cx = pos.x * T + T / 2;
  const cy = pos.y * T + T / 2;
  const r = T * 0.8;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx + 2, cy + 3, r + 4, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pedestal
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, r + 5, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Button base
  ctx.fillStyle = '#c62828';
  ctx.beginPath();
  ctx.arc(cx, cy - 4, r, 0, Math.PI * 2);
  ctx.fill();

  // Button highlight
  ctx.fillStyle = '#ef5350';
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 8, r * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 10, r * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', cx, cy - 3);
}

// ─── DEAD BODY ───
function drawBody(ctx: CanvasRenderingContext2D, body: DeadBody) {
  const bx = body.position.x * T + T / 2;
  const by = body.position.y * T + T / 2;
  const color = PLAYER_COLORS[body.color] || body.color;
  const dark = PLAYER_COLORS_DARK[body.color] || darken(color, 0.3);

  // Blood pool
  ctx.fillStyle = 'rgba(160,20,20,0.4)';
  ctx.beginPath();
  ctx.ellipse(bx + 3, by + 8, 22, 10, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Shadow
  ctx.fillStyle = PAL.shadow;
  ctx.beginPath();
  ctx.ellipse(bx, by + 12, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Half body (sliced, laid down)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(bx - 5, by + 2, 15, 12, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Darker bottom
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(bx - 5, by + 6, 12, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Bone
  ctx.fillStyle = '#e8e8e8';
  ctx.beginPath();
  ctx.ellipse(bx + 9, by - 4, 4, 8, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d0d0d0';
  ctx.beginPath();
  ctx.arc(bx + 12, by - 10, 3, 0, Math.PI * 2);
  ctx.fill();
}

// ─── AMONG US PLAYER ───
function drawPlayer(ctx: CanvasRenderingContext2D, pos: Position, player: PlayerView, isMe: boolean) {
  const cx = pos.x * T + T / 2;
  const cy = pos.y * T + T / 2;
  const color = PLAYER_COLORS[player.color] || '#888';
  const dark = PLAYER_COLORS_DARK[player.color] || darken(color, 0.3);

  ctx.save();
  ctx.globalAlpha = player.isAlive ? 1 : 0.3;

  // Character scale: ~1.8 tiles tall, ~1.2 tiles wide
  const scale = T / 48; // base at 48px
  const bw = 22 * scale;   // body half-width
  const bh = 34 * scale;   // body total height
  const legH = 10 * scale;
  const legW = 8 * scale;
  const legGap = 4 * scale;

  const topY = cy - bh / 2 + 2;
  const botY = topY + bh - legH;

  const facingLeft = player.direction === 'left';
  const facingRight = player.direction === 'right';

  // ─── SHADOW ───
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx, botY + legH + 3 * scale, bw + 4 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // ─── BACKPACK ───
  const bpSide = facingLeft ? 1 : -1;
  const bpX = facingLeft || facingRight ? cx + bpSide * (bw - 1 * scale) : cx + (bw - 1 * scale);
  const bpW = 10 * scale;
  const bpH = 18 * scale;
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.roundRect(bpX, topY + 12 * scale, (facingLeft || facingRight ? bpSide : 1) * bpW, bpH, 4 * scale);
  ctx.fill();

  // ─── BODY (bean shape) ───
  ctx.fillStyle = color;
  ctx.beginPath();
  // Top dome
  ctx.arc(cx, topY + bw, bw, Math.PI, 0, false);
  // Right side
  ctx.lineTo(cx + bw, botY);
  // Right leg
  ctx.lineTo(cx + bw, botY + legH);
  ctx.arc(cx + bw / 2 + legGap / 2, botY + legH, legW, 0, Math.PI, false);
  // Gap
  ctx.lineTo(cx + legGap / 2, botY + 2 * scale);
  ctx.lineTo(cx - legGap / 2, botY + 2 * scale);
  // Left leg
  ctx.arc(cx - bw / 2 - legGap / 2, botY + legH, legW, 0, Math.PI, false);
  ctx.lineTo(cx - bw, botY);
  // Left side up
  ctx.lineTo(cx - bw, topY + bw);
  ctx.closePath();
  ctx.fill();

  // ─── Body shading ───
  const bodyGrad = ctx.createLinearGradient(cx, topY, cx, botY + legH);
  bodyGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
  bodyGrad.addColorStop(0.3, 'rgba(255,255,255,0.03)');
  bodyGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
  bodyGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // ─── VISOR ───
  const vOffX = facingLeft ? -6 * scale : facingRight ? 6 * scale : 0;
  const vOffY = player.direction === 'up' ? -2 * scale : player.direction === 'down' ? 2 * scale : 0;
  const visorX = cx + vOffX + 3 * scale;
  const visorY = topY + bw - 2 * scale + vOffY;
  const visorW = 14 * scale;
  const visorH = 10 * scale;

  // Visor shape (slightly flat oval)
  ctx.fillStyle = '#7ec8e3';
  ctx.beginPath();
  ctx.ellipse(visorX, visorY, visorW, visorH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Visor darker edge
  ctx.strokeStyle = 'rgba(40,100,140,0.4)';
  ctx.lineWidth = 1 * scale;
  ctx.stroke();

  // Visor shine
  ctx.fillStyle = 'rgba(210,240,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(visorX + 3 * scale, visorY - 3 * scale, visorW * 0.35, visorH * 0.3, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // ─── NAME TAG ───
  const nameY = topY - 6 * scale;
  ctx.font = `${isMe ? 'bold ' : ''}${Math.round(13 * scale)}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const tw = ctx.measureText(player.name).width + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(cx - tw / 2, nameY - 15 * scale, tw, 17 * scale, 4 * scale);
  ctx.fill();
  ctx.fillStyle = isMe ? '#ffffff' : 'rgba(255,255,255,0.9)';
  ctx.fillText(player.name, cx, nameY);

  ctx.restore();
}

// ─── HELPERS ───
function darken(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
}

// ─── FOV RAYCASTING ───
function castFov(px: number, py: number, radius: number, mapData: MapData): Position[] {
  const pts: Position[] = [];
  const rays = 200;
  for (let i = 0; i < rays; i++) {
    const angle = (2 * Math.PI * i) / rays;
    pts.push(castRay(px, py, angle, radius, mapData));
  }
  return pts;
}

function castRay(ox: number, oy: number, angle: number, maxDist: number, mapData: MapData): Position {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const step = T * 0.3;
  let dist = 0;
  while (dist < maxDist) {
    dist += step;
    const x = ox + dx * dist;
    const y = oy + dy * dist;
    const tileX = Math.floor(x / T);
    const tileY = Math.floor(y / T);
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
