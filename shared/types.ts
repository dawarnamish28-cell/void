import { GamePhase, PlayerRole, SabotageType, TaskType, RoomName } from './constants';

// ─── POSITION ───
export interface Position {
  x: number;
  y: number;
}

// ─── PLAYER ───
export interface Player {
  id: string;
  name: string;
  color: string;
  position: Position;
  role?: PlayerRole;
  isAlive: boolean;
  isGhost: boolean;
  direction: 'up' | 'down' | 'left' | 'right';
  speed: number;
  tasksCompleted: string[];
  tasksAssigned: string[];
  killCooldown: number;
  canEmergencyMeet: boolean;
  lastEmergencyMeet: number;
}

// ─── LOBBY ───
export interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
}

export interface Lobby {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  maxPlayers: number;
  impostorCount: number;
  isPublic: boolean;
  gamePhase: GamePhase;
}

// ─── DEAD BODY ───
export interface DeadBody {
  id: string;
  playerId: string;
  color: string;
  position: Position;
  reportedBy?: string;
}

// ─── TASK STATION ───
export interface TaskStation {
  id: string;
  type: TaskType;
  position: Position;
  room: RoomName;
  label: string;
}

// ─── VENT ───
export interface Vent {
  id: string;
  position: Position;
  room: RoomName;
  connections: string[];
}

// ─── SABOTAGE STATE ───
export interface SabotageState {
  type: SabotageType | null;
  active: boolean;
  countdown: number;
  targetRoom?: RoomName;
  fixProgress: Record<string, number>;
}

// ─── DOOR STATE ───
export interface DoorState {
  room: RoomName;
  locked: boolean;
  unlockTime: number;
}

// ─── VOTE ───
export interface VoteState {
  votes: Record<string, string | 'skip'>;
  phase: 'discussion' | 'voting' | 'result';
  timeLeft: number;
  callerId: string;
  callerName: string;
  reason: 'body' | 'button';
  bodyColor?: string;
}

// ─── GAME STATE (sent to clients) ───
export interface ClientGameState {
  phase: GamePhase;
  players: PlayerView[];
  bodies: DeadBody[];
  taskProgress: number;
  totalTasks: number;
  sabotage: SabotageState;
  doors: DoorState[];
  myRole?: PlayerRole;
  myTasks?: TaskAssignment[];
  impostors?: string[];
  vote?: VoteState;
  winner?: 'crewmates' | 'impostors';
  allRoles?: Record<string, PlayerRole>;
}

// ─── PLAYER VIEW (what other players see) ───
export interface PlayerView {
  id: string;
  name: string;
  color: string;
  position: Position;
  isAlive: boolean;
  direction: 'up' | 'down' | 'left' | 'right';
}

// ─── TASK ASSIGNMENT ───
export interface TaskAssignment {
  id: string;
  type: TaskType;
  station: string;
  room: RoomName;
  completed: boolean;
  label: string;
}

// ─── MAP TILE ───
export enum TileType {
  FLOOR = 0,
  WALL = 1,
  VENT = 2,
  TASK = 3,
  DOOR = 4,
  EMPTY = 5,
}

export interface MapData {
  width: number;
  height: number;
  tiles: number[][];
  rooms: RoomRegion[];
  taskStations: TaskStation[];
  vents: Vent[];
  spawnPoint: Position;
  emergencyButton: Position;
}

export interface RoomRegion {
  name: RoomName;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── CHAT MESSAGE ───
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

// ─── GAME OVER STATS ───
export interface GameOverStats {
  winner: 'crewmates' | 'impostors';
  allRoles: Record<string, PlayerRole>;
  taskProgress: number;
  playerStats: Record<string, {
    kills: number;
    tasksCompleted: number;
    meetingsCalled: number;
    correctVotes: number;
  }>;
}
