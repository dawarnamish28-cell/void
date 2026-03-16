import { TileType, MapData, RoomRegion, TaskStation, Vent } from './types';
import { RoomName, TaskType, VENT_CONNECTIONS } from './constants';

// Map: 60 tiles wide x 50 tiles tall (each tile = 32px)
const W = 60;
const H = 50;

// ─── ROOM DEFINITIONS ───
export const ROOMS: RoomRegion[] = [
  { name: RoomName.CAFETERIA, x: 4, y: 2, width: 12, height: 8 },
  { name: RoomName.WEAPONS, x: 22, y: 2, width: 8, height: 7 },
  { name: RoomName.NAVIGATION, x: 38, y: 2, width: 10, height: 8 },
  { name: RoomName.ADMIN, x: 4, y: 14, width: 10, height: 7 },
  { name: RoomName.HALLWAY, x: 18, y: 13, width: 14, height: 5 },
  { name: RoomName.SHIELDS, x: 38, y: 13, width: 10, height: 7 },
  { name: RoomName.STORAGE, x: 4, y: 25, width: 10, height: 7 },
  { name: RoomName.ENGINE_ROOM, x: 22, y: 22, width: 10, height: 8 },
  { name: RoomName.REACTOR, x: 4, y: 36, width: 10, height: 7 },
  { name: RoomName.SECURITY, x: 4, y: 47 - 7, width: 10, height: 7 }, // y=40
  { name: RoomName.ELECTRICAL, x: 18, y: 36, width: 10, height: 7 },
  { name: RoomName.O2, x: 34, y: 36, width: 10, height: 7 },
  { name: RoomName.MEDBAY, x: 4, y: 47 - 7 + 0, width: 10, height: 7 }, // adjust
  { name: RoomName.COMMUNICATIONS, x: 22, y: 47 - 7, width: 12, height: 7 },
];

// Simplified: keep rooms cleaner
export const ROOM_DEFS: RoomRegion[] = [
  { name: RoomName.CAFETERIA, x: 3, y: 2, width: 12, height: 8 },
  { name: RoomName.WEAPONS, x: 20, y: 2, width: 8, height: 7 },
  { name: RoomName.NAVIGATION, x: 34, y: 2, width: 10, height: 8 },

  { name: RoomName.CORRIDOR_1, x: 15, y: 4, width: 5, height: 4 },
  { name: RoomName.CORRIDOR_2, x: 28, y: 4, width: 6, height: 4 },

  { name: RoomName.ADMIN, x: 3, y: 13, width: 10, height: 7 },
  { name: RoomName.HALLWAY, x: 16, y: 13, width: 14, height: 5 },
  { name: RoomName.SHIELDS, x: 34, y: 13, width: 10, height: 7 },

  { name: RoomName.CORRIDOR_3, x: 8, y: 10, width: 4, height: 3 },
  { name: RoomName.CORRIDOR_4, x: 38, y: 10, width: 4, height: 3 },

  { name: RoomName.STORAGE, x: 3, y: 23, width: 10, height: 7 },
  { name: RoomName.ENGINE_ROOM, x: 18, y: 21, width: 10, height: 8 },

  { name: RoomName.REACTOR, x: 3, y: 33, width: 10, height: 7 },
  { name: RoomName.SECURITY, x: 3, y: 43, width: 10, height: 5 },
  { name: RoomName.ELECTRICAL, x: 16, y: 33, width: 10, height: 7 },
  { name: RoomName.O2, x: 30, y: 33, width: 10, height: 7 },
  { name: RoomName.MEDBAY, x: 16, y: 43, width: 10, height: 5 },
  { name: RoomName.COMMUNICATIONS, x: 30, y: 43, width: 12, height: 5 },
];

// Additional corridors to connect rooms
const CORRIDORS = [
  // Cafeteria down to Admin
  { x: 8, y: 10, width: 3, height: 3 },
  // Admin to Hallway
  { x: 13, y: 15, width: 3, height: 3 },
  // Hallway to Shields
  { x: 30, y: 14, width: 4, height: 3 },
  // Hallway down to Engine Room
  { x: 22, y: 18, width: 3, height: 3 },
  // Storage down to Reactor
  { x: 7, y: 30, width: 3, height: 3 },
  // Admin down to Storage
  { x: 7, y: 20, width: 3, height: 3 },
  // Reactor down to Security
  { x: 7, y: 40, width: 3, height: 3 },
  // Security to Electrical
  { x: 13, y: 44, width: 3, height: 3 },
  // Electrical to O2
  { x: 26, y: 35, width: 4, height: 3 },
  // Security right to Medbay
  { x: 13, y: 44, width: 3, height: 2 },
  // Medbay to Communications
  { x: 26, y: 44, width: 4, height: 3 },
  // Engine Room to Electrical
  { x: 22, y: 29, width: 3, height: 4 },
  // Engine to Storage
  { x: 13, y: 24, width: 5, height: 3 },
];

// ─── TASK STATIONS ───
export const TASK_STATIONS: TaskStation[] = [
  { id: 'task_wire_cafeteria', type: TaskType.WIRE_FIX, position: { x: 8, y: 4 }, room: RoomName.CAFETERIA, label: 'Fix Wiring' },
  { id: 'task_download_cafeteria', type: TaskType.DOWNLOAD_DATA, position: { x: 12, y: 6 }, room: RoomName.CAFETERIA, label: 'Download Data' },
  { id: 'task_fuel_engine', type: TaskType.FUEL_UP, position: { x: 24, y: 25 }, room: RoomName.ENGINE_ROOM, label: 'Fuel Engines' },
  { id: 'task_align_nav', type: TaskType.ALIGN_NAV, position: { x: 40, y: 5 }, room: RoomName.NAVIGATION, label: 'Align Engine' },
  { id: 'task_shields', type: TaskType.CALIBRATE_SHIELDS, position: { x: 40, y: 16 }, room: RoomName.SHIELDS, label: 'Calibrate Shields' },
  { id: 'task_scan_medbay', type: TaskType.SCAN_MEDBAY, position: { x: 20, y: 45 }, room: RoomName.MEDBAY, label: 'Scan MedBay' },
  { id: 'task_id_admin', type: TaskType.ENTER_ID, position: { x: 8, y: 16 }, room: RoomName.ADMIN, label: 'Swipe Card' },
  { id: 'task_wire_electrical', type: TaskType.WIRE_FIX, position: { x: 22, y: 36 }, room: RoomName.ELECTRICAL, label: 'Fix Wiring' },
  { id: 'task_garbage_storage', type: TaskType.EMPTY_GARBAGE, position: { x: 6, y: 27 }, room: RoomName.STORAGE, label: 'Empty Garbage' },
  { id: 'task_weapons', type: TaskType.CALIBRATE_SHIELDS, position: { x: 24, y: 5 }, room: RoomName.WEAPONS, label: 'Clear Asteroids' },
  { id: 'task_o2_code', type: TaskType.ENTER_ID, position: { x: 36, y: 36 }, room: RoomName.O2, label: 'Clean Filter' },
  { id: 'task_download_comms', type: TaskType.DOWNLOAD_DATA, position: { x: 36, y: 45 }, room: RoomName.COMMUNICATIONS, label: 'Download Data' },
];

// ─── VENTS ───
export const VENTS: Vent[] = [
  { id: 'cafeteria_vent', position: { x: 10, y: 8 }, room: RoomName.CAFETERIA, connections: VENT_CONNECTIONS['cafeteria_vent'] },
  { id: 'admin_vent', position: { x: 10, y: 15 }, room: RoomName.ADMIN, connections: VENT_CONNECTIONS['admin_vent'] },
  { id: 'security_vent', position: { x: 8, y: 45 }, room: RoomName.SECURITY, connections: VENT_CONNECTIONS['security_vent'] },
  { id: 'electrical_vent', position: { x: 22, y: 38 }, room: RoomName.ELECTRICAL, connections: VENT_CONNECTIONS['electrical_vent'] },
  { id: 'medbay_vent', position: { x: 22, y: 45 }, room: RoomName.MEDBAY, connections: VENT_CONNECTIONS['medbay_vent'] },
  { id: 'engine_vent', position: { x: 24, y: 27 }, room: RoomName.ENGINE_ROOM, connections: VENT_CONNECTIONS['engine_vent'] },
  { id: 'reactor_vent', position: { x: 8, y: 37 }, room: RoomName.REACTOR, connections: VENT_CONNECTIONS['reactor_vent'] },
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

  // Fill corridors with floor
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
    spawnPoint: { x: 9, y: 6 },
    emergencyButton: { x: 9, y: 5 },
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
