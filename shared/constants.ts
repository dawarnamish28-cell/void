// ─── GAME CONSTANTS ───
export const GAME = {
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 15,
  KILL_COOLDOWN_MS: 25000,
  KILL_RANGE_PX: 80,
  VENT_RANGE_PX: 64,
  REPORT_RANGE_PX: 100,
  TASK_RANGE_PX: 64,
  FOV_RADIUS_NORMAL: 380,
  FOV_RADIUS_LIGHTS_OUT: 100,
  IMPOSTOR_FOV_BONUS: 80,
  MEETING_DISCUSS_SECS: 30,
  MEETING_VOTE_SECS: 15,
  SABOTAGE_REACTOR_SECS: 45,
  SABOTAGE_O2_SECS: 30,
  DOOR_LOCK_SECS: 10,
  TASK_BAR_WIN_PERCENT: 100,
  PLAYER_SPEED: 3,
  TICK_RATE_MS: 50,
  TILE_SIZE: 32,
  ROLE_REVEAL_SECS: 8,
  LOBBY_COUNTDOWN_SECS: 5,
  EMERGENCY_COOLDOWN_MS: 30000,
  SABOTAGE_COOLDOWN_MS: 20000,
};

// ─── PLAYER COLORS ───
export const PLAYER_COLORS: Record<string, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  pink: '#e91e8a',
  orange: '#f39c12',
  yellow: '#f1c40f',
  black: '#2c3e50',
  white: '#ecf0f1',
  purple: '#9b59b6',
  brown: '#8B4513',
  cyan: '#00bcd4',
  lime: '#8bc34a',
  maroon: '#800000',
  rose: '#ff6b9d',
  banana: '#ffe135',
  gray: '#95a5a6',
};

export const COLOR_NAMES = Object.keys(PLAYER_COLORS);

// ─── ROOM NAMES ───
export enum RoomName {
  CAFETERIA = 'Cafeteria',
  WEAPONS = 'Weapons',
  NAVIGATION = 'Navigation',
  ADMIN = 'Admin',
  HALLWAY = 'Hallway',
  SHIELDS = 'Shields',
  STORAGE = 'Storage',
  ENGINE_ROOM = 'Engine Room',
  REACTOR = 'Reactor',
  SECURITY = 'Security',
  ELECTRICAL = 'Electrical',
  O2 = 'O2',
  MEDBAY = 'MedBay',
  COMMUNICATIONS = 'Communications',
  CORRIDOR_1 = 'Corridor 1',
  CORRIDOR_2 = 'Corridor 2',
  CORRIDOR_3 = 'Corridor 3',
  CORRIDOR_4 = 'Corridor 4',
}

// ─── GAME PHASES ───
export enum GamePhase {
  LOGIN = 'login',
  LOBBY = 'lobby',
  ROLE_REVEAL = 'role_reveal',
  PLAYING = 'playing',
  MEETING = 'meeting',
  VOTING = 'voting',
  EJECTION = 'ejection',
  GAME_OVER = 'game_over',
}

// ─── ROLES ───
export enum PlayerRole {
  CREWMATE = 'crewmate',
  IMPOSTOR = 'impostor',
}

// ─── SABOTAGE TYPES ───
export enum SabotageType {
  LIGHTS = 'lights',
  REACTOR = 'reactor',
  O2 = 'o2',
  COMMS = 'comms',
  DOORS = 'doors',
}

// ─── TASK TYPES ───
export enum TaskType {
  WIRE_FIX = 'wire_fix',
  FUEL_UP = 'fuel_up',
  DOWNLOAD_DATA = 'download_data',
  SCAN_MEDBAY = 'scan_medbay',
  CALIBRATE_SHIELDS = 'calibrate_shields',
  ENTER_ID = 'enter_id',
  ALIGN_NAV = 'align_nav',
  EMPTY_GARBAGE = 'empty_garbage',
}

// ─── VENT CONNECTIONS ───
export const VENT_CONNECTIONS: Record<string, string[]> = {
  cafeteria_vent: ['admin_vent'],
  admin_vent: ['cafeteria_vent'],
  security_vent: ['electrical_vent', 'medbay_vent'],
  electrical_vent: ['security_vent', 'medbay_vent'],
  medbay_vent: ['security_vent', 'electrical_vent'],
  engine_vent: ['reactor_vent'],
  reactor_vent: ['engine_vent'],
};

// ─── SOCKET EVENTS ───
export const SocketEvents = {
  // Client → Server
  JOIN_LOBBY: 'join_lobby',
  CREATE_LOBBY: 'create_lobby',
  LEAVE_LOBBY: 'leave_lobby',
  START_GAME: 'start_game',
  PLAYER_MOVE: 'player_move',
  KILL_PLAYER: 'kill_player',
  REPORT_BODY: 'report_body',
  CALL_MEETING: 'call_meeting',
  CAST_VOTE: 'cast_vote',
  COMPLETE_TASK: 'complete_task',
  USE_VENT: 'use_vent',
  TRIGGER_SABOTAGE: 'trigger_sabotage',
  FIX_SABOTAGE: 'fix_sabotage',
  SELECT_COLOR: 'select_color',
  CHAT_MESSAGE: 'chat_message',
  LIST_LOBBIES: 'list_lobbies',
  SET_IMPOSTOR_COUNT: 'set_impostor_count',
  KICK_PLAYER: 'kick_player',

  // Server → Client
  LOBBY_UPDATE: 'lobby_update',
  LOBBY_LIST: 'lobby_list',
  GAME_START: 'game_start',
  ROLE_ASSIGNED: 'role_assigned',
  GAME_STATE: 'game_state',
  PLAYER_KILLED: 'player_killed',
  MEETING_CALLED: 'meeting_called',
  VOTE_UPDATE: 'vote_update',
  VOTE_RESULT: 'vote_result',
  TASK_UPDATE: 'task_update',
  SABOTAGE_ACTIVE: 'sabotage_active',
  SABOTAGE_FIXED: 'sabotage_fixed',
  GAME_OVER: 'game_over',
  ERROR: 'error',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  CHAT_BROADCAST: 'chat_broadcast',
  COUNTDOWN: 'countdown',
  EJECTION_RESULT: 'ejection_result',
  DOOR_LOCKED: 'door_locked',
  DOOR_UNLOCKED: 'door_unlocked',
} as const;
