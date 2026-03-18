import { TileType, MapData, RoomRegion, TaskStation, Vent, Position } from './types';
import { RoomName, TaskType, VENT_CONNECTIONS } from './constants';

// Map: 160 tiles wide x 130 tiles tall (each tile = 32px → 5120x4160 pixel map)
const W = 160;
const H = 130;

// ─── ROOM DEFINITIONS (large rooms like Among Us) ───
export const ROOM_DEFS: RoomRegion[] = [
  // Top row
  { name: RoomName.CAFETERIA,      x: 8,   y: 5,   width: 28, height: 22 },
  { name: RoomName.WEAPONS,        x: 55,  y: 5,   width: 22, height: 18 },
  { name: RoomName.NAVIGATION,     x: 100, y: 5,   width: 24, height: 22 },

  // Corridors top
  { name: RoomName.CORRIDOR_1,     x: 36,  y: 10,  width: 19, height: 8 },
  { name: RoomName.CORRIDOR_2,     x: 77,  y: 10,  width: 23, height: 8 },

  // Middle row
  { name: RoomName.ADMIN,          x: 8,   y: 36,  width: 24, height: 18 },
  { name: RoomName.HALLWAY,        x: 42,  y: 36,  width: 36, height: 14 },
  { name: RoomName.SHIELDS,        x: 100, y: 36,  width: 24, height: 18 },

  // Corridors middle (vertical connectors)
  { name: RoomName.CORRIDOR_3,     x: 18,  y: 27,  width: 8,  height: 9 },
  { name: RoomName.CORRIDOR_4,     x: 110, y: 27,  width: 8,  height: 9 },

  // Lower-mid section
  { name: RoomName.STORAGE,        x: 8,   y: 62,  width: 24, height: 18 },
  { name: RoomName.ENGINE_ROOM,    x: 50,  y: 58,  width: 24, height: 20 },

  // Bottom section
  { name: RoomName.REACTOR,        x: 8,   y: 88,  width: 24, height: 18 },
  { name: RoomName.SECURITY,       x: 8,   y: 112, width: 24, height: 14 },
  { name: RoomName.ELECTRICAL,     x: 42,  y: 88,  width: 24, height: 18 },
  { name: RoomName.O2,             x: 86,  y: 88,  width: 24, height: 18 },
  { name: RoomName.MEDBAY,         x: 42,  y: 112, width: 24, height: 14 },
  { name: RoomName.COMMUNICATIONS, x: 86,  y: 112, width: 28, height: 14 },
];

// Corridors connecting rooms
const CORRIDORS = [
  // Cafeteria ↔ Admin (vertical)
  { x: 18, y: 27, width: 8, height: 9 },
  // Admin ↔ Hallway (horizontal)
  { x: 32, y: 41, width: 10, height: 7 },
  // Hallway ↔ Shields (horizontal)
  { x: 78, y: 41, width: 22, height: 7 },
  // Corridor4 connecting Nav↔Shields (vertical)
  { x: 110, y: 27, width: 8, height: 9 },
  // Hallway ↔ Engine Room (vertical)
  { x: 58, y: 50, width: 8, height: 8 },
  // Admin ↔ Storage (vertical)
  { x: 18, y: 54, width: 8, height: 8 },
  // Storage ↔ Reactor (vertical)
  { x: 18, y: 80, width: 8, height: 8 },
  // Reactor ↔ Security (vertical)
  { x: 18, y: 106, width: 8, height: 6 },
  // Security ↔ Medbay (horizontal)
  { x: 32, y: 116, width: 10, height: 6 },
  // Electrical ↔ O2 (horizontal)
  { x: 66, y: 93, width: 20, height: 7 },
  // Medbay ↔ Communications (horizontal)
  { x: 66, y: 116, width: 20, height: 6 },
  // Engine ↔ Electrical (vertical)
  { x: 58, y: 78, width: 8, height: 10 },
  // Engine ↔ Storage (horizontal)
  { x: 32, y: 66, width: 18, height: 7 },
  // O2 ↔ Communications (vertical)
  { x: 96, y: 106, width: 8, height: 6 },
  // Shields ↔ O2 (vertical)
  { x: 110, y: 54, width: 8, height: 8 },
  // O2 ↔ upper connector
  { x: 110, y: 62, width: 8, height: 8 },
  // More corridor from Shields → lower right
  { x: 110, y: 70, width: 8, height: 18 },
];

// ─── TASK STATIONS ───
export const TASK_STATIONS: TaskStation[] = [
  { id: 'task_wire_cafeteria',   type: TaskType.WIRE_FIX,         position: { x: 20, y: 10 }, room: RoomName.CAFETERIA,      label: 'Fix Wiring' },
  { id: 'task_download_cafeteria', type: TaskType.DOWNLOAD_DATA,  position: { x: 30, y: 18 }, room: RoomName.CAFETERIA,      label: 'Download Data' },
  { id: 'task_fuel_engine',      type: TaskType.FUEL_UP,          position: { x: 62, y: 68 }, room: RoomName.ENGINE_ROOM,    label: 'Fuel Engines' },
  { id: 'task_align_nav',        type: TaskType.ALIGN_NAV,        position: { x: 116, y: 14 }, room: RoomName.NAVIGATION,    label: 'Chart Course' },
  { id: 'task_shields',          type: TaskType.CALIBRATE_SHIELDS, position: { x: 116, y: 44 }, room: RoomName.SHIELDS,      label: 'Calibrate Shields' },
  { id: 'task_scan_medbay',      type: TaskType.SCAN_MEDBAY,      position: { x: 54, y: 118 }, room: RoomName.MEDBAY,       label: 'Submit Scan' },
  { id: 'task_id_admin',         type: TaskType.ENTER_ID,         position: { x: 20, y: 44 }, room: RoomName.ADMIN,          label: 'Swipe Card' },
  { id: 'task_wire_electrical',  type: TaskType.WIRE_FIX,         position: { x: 56, y: 96 }, room: RoomName.ELECTRICAL,     label: 'Fix Wiring' },
  { id: 'task_garbage_storage',  type: TaskType.EMPTY_GARBAGE,    position: { x: 18, y: 70 }, room: RoomName.STORAGE,        label: 'Empty Garbage' },
  { id: 'task_weapons',          type: TaskType.CALIBRATE_SHIELDS, position: { x: 66, y: 10 }, room: RoomName.WEAPONS,      label: 'Clear Asteroids' },
  { id: 'task_o2_code',          type: TaskType.ENTER_ID,         position: { x: 100, y: 96 }, room: RoomName.O2,            label: 'Clean O2 Filter' },
  { id: 'task_download_comms',   type: TaskType.DOWNLOAD_DATA,    position: { x: 100, y: 118 }, room: RoomName.COMMUNICATIONS, label: 'Download Data' },
];

// ─── VENTS ───
export const VENTS: Vent[] = [
  { id: 'cafeteria_vent', position: { x: 26, y: 22 }, room: RoomName.CAFETERIA,   connections: VENT_CONNECTIONS['cafeteria_vent'] },
  { id: 'admin_vent',     position: { x: 26, y: 42 }, room: RoomName.ADMIN,       connections: VENT_CONNECTIONS['admin_vent'] },
  { id: 'security_vent',  position: { x: 20, y: 120 }, room: RoomName.SECURITY,   connections: VENT_CONNECTIONS['security_vent'] },
  { id: 'electrical_vent', position: { x: 56, y: 100 }, room: RoomName.ELECTRICAL, connections: VENT_CONNECTIONS['electrical_vent'] },
  { id: 'medbay_vent',    position: { x: 56, y: 120 }, room: RoomName.MEDBAY,     connections: VENT_CONNECTIONS['medbay_vent'] },
  { id: 'engine_vent',    position: { x: 64, y: 72 }, room: RoomName.ENGINE_ROOM, connections: VENT_CONNECTIONS['engine_vent'] },
  { id: 'reactor_vent',   position: { x: 20, y: 96 }, room: RoomName.REACTOR,     connections: VENT_CONNECTIONS['reactor_vent'] },
];

// ─── BUILD TILE MAP ───
export function buildTileMap(): number[][] {
  const tiles: number[][] = [];
  for (let y = 0; y < H; y++) {
    tiles[y] = [];
    for (let x = 0; x < W; x++) {
      tiles[y][x] = TileType.EMPTY;
    }
  }

  // Fill rooms with floor
  for (const room of ROOM_DEFS) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (y >= 0 && y < H && x >= 0 && x < W) {
          tiles[y][x] = TileType.FLOOR;
        }
      }
    }
  }

  // Fill corridors
  for (const c of CORRIDORS) {
    for (let y = c.y; y < c.y + c.height; y++) {
      for (let x = c.x; x < c.x + c.width; x++) {
        if (y >= 0 && y < H && x >= 0 && x < W) {
          tiles[y][x] = TileType.FLOOR;
        }
      }
    }
  }

  // Add walls around floors
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (tiles[y][x] === TileType.FLOOR) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < H && nx >= 0 && nx < W && tiles[ny][nx] === TileType.EMPTY) {
              tiles[ny][nx] = TileType.WALL;
            }
          }
        }
      }
    }
  }

  // Place vents
  for (const vent of VENTS) {
    const vx = Math.floor(vent.position.x);
    const vy = Math.floor(vent.position.y);
    if (vy >= 0 && vy < H && vx >= 0 && vx < W) {
      tiles[vy][vx] = TileType.VENT;
    }
  }

  // Place task stations
  for (const task of TASK_STATIONS) {
    const tx = Math.floor(task.position.x);
    const ty = Math.floor(task.position.y);
    if (ty >= 0 && ty < H && tx >= 0 && tx < W) {
      tiles[ty][tx] = TileType.TASK;
    }
  }

  return tiles;
}

// ─── BUILD MAP DATA ───
export function buildMapData(): MapData {
  return {
    width: W,
    height: H,
    tiles: buildTileMap(),
    rooms: ROOM_DEFS,
    taskStations: TASK_STATIONS,
    vents: VENTS,
    spawnPoint: { x: 22, y: 16 },
    emergencyButton: { x: 22, y: 14 },
  };
}

// ─── GET ROOM AT POSITION ───
export function getRoomAtPosition(x: number, y: number): RoomName | null {
  for (const room of ROOM_DEFS) {
    if (x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height) {
      return room.name;
    }
  }
  return null;
}
