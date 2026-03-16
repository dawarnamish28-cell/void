import { create } from 'zustand';
import { GamePhase, PlayerRole, SabotageType } from '@shared/constants';
import type { 
  Lobby, LobbyPlayer, PlayerView, DeadBody, TaskAssignment, 
  SabotageState, DoorState, VoteState, MapData, ChatMessage, Position 
} from '@shared/types';

interface GameStore {
  // Auth
  playerName: string;
  playerAge: number;
  setAuth: (name: string, age: number) => void;

  // Lobby
  lobby: Lobby | null;
  lobbyList: Lobby[];
  setLobby: (lobby: Lobby | null) => void;
  setLobbyList: (lobbies: Lobby[]) => void;

  // Game phase
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;

  // Role
  myRole: PlayerRole | null;
  impostorNames: string[];
  setRole: (role: PlayerRole, impostorNames: string[]) => void;

  // Map
  mapData: MapData | null;
  setMapData: (map: MapData) => void;

  // Players & game state
  players: PlayerView[];
  bodies: DeadBody[];
  myPosition: Position;
  myDirection: 'up' | 'down' | 'left' | 'right';
  setPlayers: (players: PlayerView[]) => void;
  setBodies: (bodies: DeadBody[]) => void;
  setMyPosition: (pos: Position) => void;
  setMyDirection: (dir: 'up' | 'down' | 'left' | 'right') => void;

  // Tasks
  myTasks: TaskAssignment[];
  taskProgress: number;
  totalTasks: number;
  activeTask: TaskAssignment | null;
  setMyTasks: (tasks: TaskAssignment[]) => void;
  setTaskProgress: (progress: number, total: number) => void;
  setActiveTask: (task: TaskAssignment | null) => void;

  // Sabotage
  sabotage: SabotageState;
  doors: DoorState[];
  setSabotage: (sab: SabotageState) => void;
  setDoors: (doors: DoorState[]) => void;

  // Voting
  vote: VoteState | null;
  setVote: (vote: VoteState | null) => void;

  // Chat
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;

  // Game over
  winner: 'crewmates' | 'impostors' | null;
  allRoles: Record<string, PlayerRole> | null;
  setGameOver: (winner: 'crewmates' | 'impostors', allRoles: Record<string, PlayerRole>) => void;

  // Ejection
  ejection: {
    ejectedName: string | null;
    ejectedColor: string | null;
    wasImpostor: boolean;
  } | null;
  setEjection: (data: any) => void;

  // UI
  showMiniMap: boolean;
  showChat: boolean;
  toggleMiniMap: () => void;
  toggleChat: () => void;

  // Vent state
  inVent: boolean;
  nearbyVent: string | null;
  setInVent: (inVent: boolean) => void;
  setNearbyVent: (ventId: string | null) => void;

  // Nearby targets
  nearbyKillTarget: string | null;
  nearbyBody: string | null;
  nearbyTask: TaskAssignment | null;
  nearbyEmergencyButton: boolean;
  setNearbyKillTarget: (id: string | null) => void;
  setNearbyBody: (id: string | null) => void;
  setNearbyTask: (task: TaskAssignment | null) => void;
  setNearbyEmergencyButton: (near: boolean) => void;

  // Kill cooldown
  killCooldown: number;
  setKillCooldown: (cd: number) => void;

  // Reset
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Auth
  playerName: '',
  playerAge: 0,
  setAuth: (name, age) => set({ playerName: name, playerAge: age }),

  // Lobby
  lobby: null,
  lobbyList: [],
  setLobby: (lobby) => set({ lobby }),
  setLobbyList: (lobbyList) => set({ lobbyList }),

  // Phase
  phase: GamePhase.LOGIN,
  setPhase: (phase) => set({ phase }),

  // Role
  myRole: null,
  impostorNames: [],
  setRole: (role, impostorNames) => set({ myRole: role, impostorNames }),

  // Map
  mapData: null,
  setMapData: (mapData) => set({ mapData }),

  // Players
  players: [],
  bodies: [],
  myPosition: { x: 9, y: 6 },
  myDirection: 'down',
  setPlayers: (players) => set({ players }),
  setBodies: (bodies) => set({ bodies }),
  setMyPosition: (pos) => set({ myPosition: pos }),
  setMyDirection: (dir) => set({ myDirection: dir }),

  // Tasks
  myTasks: [],
  taskProgress: 0,
  totalTasks: 0,
  activeTask: null,
  setMyTasks: (myTasks) => set({ myTasks }),
  setTaskProgress: (taskProgress, totalTasks) => set({ taskProgress, totalTasks }),
  setActiveTask: (activeTask) => set({ activeTask }),

  // Sabotage
  sabotage: { type: null, active: false, countdown: 0, fixProgress: {} },
  doors: [],
  setSabotage: (sabotage) => set({ sabotage }),
  setDoors: (doors) => set({ doors }),

  // Voting
  vote: null,
  setVote: (vote) => set({ vote }),

  // Chat
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages.slice(-50), msg] })),
  clearMessages: () => set({ messages: [] }),

  // Game over
  winner: null,
  allRoles: null,
  setGameOver: (winner, allRoles) => set({ winner, allRoles }),

  // Ejection
  ejection: null,
  setEjection: (data) => set({ ejection: data }),

  // UI
  showMiniMap: true,
  showChat: false,
  toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
  toggleChat: () => set((s) => ({ showChat: !s.showChat })),

  // Vent
  inVent: false,
  nearbyVent: null,
  setInVent: (inVent) => set({ inVent }),
  setNearbyVent: (nearbyVent) => set({ nearbyVent }),

  // Nearby targets
  nearbyKillTarget: null,
  nearbyBody: null,
  nearbyTask: null,
  nearbyEmergencyButton: false,
  setNearbyKillTarget: (nearbyKillTarget) => set({ nearbyKillTarget }),
  setNearbyBody: (nearbyBody) => set({ nearbyBody }),
  setNearbyTask: (nearbyTask) => set({ nearbyTask }),
  setNearbyEmergencyButton: (nearbyEmergencyButton) => set({ nearbyEmergencyButton }),

  // Kill cooldown
  killCooldown: 0,
  setKillCooldown: (killCooldown) => set({ killCooldown }),

  // Reset
  resetGame: () => set({
    phase: GamePhase.LOBBY,
    myRole: null,
    impostorNames: [],
    players: [],
    bodies: [],
    myTasks: [],
    taskProgress: 0,
    totalTasks: 0,
    activeTask: null,
    sabotage: { type: null, active: false, countdown: 0, fixProgress: {} },
    doors: [],
    vote: null,
    winner: null,
    allRoles: null,
    ejection: null,
    inVent: false,
    nearbyVent: null,
    nearbyKillTarget: null,
    nearbyBody: null,
    nearbyTask: null,
    nearbyEmergencyButton: false,
    killCooldown: 0,
    messages: [],
  }),
}));
