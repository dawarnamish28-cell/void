import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { LobbyManager } from './lobby/lobbyManager.ts';
import { GameManager } from './game/gameManager.ts';
import { SocketEvents, GAME } from '../../shared/constants.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Serve static files in production
const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const lobbyManager = new LobbyManager();
const gameManagers = new Map<string, GameManager>();

// Track player sessions
const playerSessions = new Map<string, { name: string; age: number; lobbyCode: string | null }>();

io.on('connection', (socket) => {
  console.log(`[CONNECT] ${socket.id}`);

  // ─── LIST LOBBIES ───
  socket.on(SocketEvents.LIST_LOBBIES, (callback) => {
    const lobbies = lobbyManager.getPublicLobbies();
    if (typeof callback === 'function') callback(lobbies);
  });

  // ─── CREATE LOBBY ───
  socket.on(SocketEvents.CREATE_LOBBY, (data: { name: string; age: number }, callback) => {
    if (!data.name || data.name.length > 16 || !data.age || data.age < 14) {
      if (typeof callback === 'function') callback({ error: 'Invalid name or age' });
      return;
    }

    playerSessions.set(socket.id, { name: data.name, age: data.age, lobbyCode: null });

    const lobby = lobbyManager.createLobby(socket.id, data.name);
    playerSessions.get(socket.id)!.lobbyCode = lobby.code;
    socket.join(lobby.code);

    if (typeof callback === 'function') callback({ lobby });
    io.to(lobby.code).emit(SocketEvents.LOBBY_UPDATE, lobby);
  });

  // ─── JOIN LOBBY ───
  socket.on(SocketEvents.JOIN_LOBBY, (data: { code: string; name: string; age: number }, callback) => {
    if (!data.name || data.name.length > 16 || !data.age || data.age < 14) {
      if (typeof callback === 'function') callback({ error: 'Invalid name or age' });
      return;
    }

    const result = lobbyManager.joinLobby(data.code, socket.id, data.name);
    if ('error' in result) {
      if (typeof callback === 'function') callback(result);
      return;
    }

    playerSessions.set(socket.id, { name: data.name, age: data.age, lobbyCode: data.code });
    socket.join(data.code);

    if (typeof callback === 'function') callback({ lobby: result });
    io.to(data.code).emit(SocketEvents.LOBBY_UPDATE, result);
  });

  // ─── SELECT COLOR ───
  socket.on(SocketEvents.SELECT_COLOR, (data: { color: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;

    const lobby = lobbyManager.selectColor(session.lobbyCode, socket.id, data.color);
    if (lobby) {
      io.to(session.lobbyCode).emit(SocketEvents.LOBBY_UPDATE, lobby);
    }
  });

  // ─── SET IMPOSTOR COUNT ───
  socket.on(SocketEvents.SET_IMPOSTOR_COUNT, (data: { count: number }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;

    const lobby = lobbyManager.setImpostorCount(session.lobbyCode, socket.id, data.count);
    if (lobby) {
      io.to(session.lobbyCode).emit(SocketEvents.LOBBY_UPDATE, lobby);
    }
  });

  // ─── KICK PLAYER ───
  socket.on(SocketEvents.KICK_PLAYER, (data: { targetId: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;

    const lobby = lobbyManager.kickPlayer(session.lobbyCode, socket.id, data.targetId);
    if (lobby) {
      io.to(data.targetId).emit(SocketEvents.ERROR, { message: 'You have been kicked from the lobby' });
      const targetSocket = io.sockets.sockets.get(data.targetId);
      if (targetSocket) {
        targetSocket.leave(session.lobbyCode);
      }
      playerSessions.delete(data.targetId);
      io.to(session.lobbyCode).emit(SocketEvents.LOBBY_UPDATE, lobby);
    }
  });

  // ─── CHAT MESSAGE ───
  socket.on(SocketEvents.CHAT_MESSAGE, (data: { text: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode || !data.text || data.text.length > 200) return;

    const lobby = lobbyManager.getLobby(session.lobbyCode);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player) return;

    // Check if in game and it's a meeting
    const gm = gameManagers.get(session.lobbyCode);
    if (gm) {
      // Only allow chat during meetings for alive players
      const gamePlayer = gm.getPlayer(socket.id);
      if (!gamePlayer?.isAlive) return;
    }

    io.to(session.lobbyCode).emit(SocketEvents.CHAT_BROADCAST, {
      id: Date.now().toString(),
      playerId: socket.id,
      playerName: player.name,
      playerColor: player.color,
      text: data.text,
      timestamp: Date.now(),
      isSystem: false,
    });
  });

  // ─── START GAME ───
  socket.on(SocketEvents.START_GAME, () => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;

    const lobby = lobbyManager.getLobby(session.lobbyCode);
    if (!lobby || lobby.hostId !== socket.id) return;
    if (lobby.players.length < GAME.MIN_PLAYERS) {
      socket.emit(SocketEvents.ERROR, { message: `Need at least ${GAME.MIN_PLAYERS} players` });
      return;
    }

    // Countdown
    let countdown = GAME.LOBBY_COUNTDOWN_SECS;
    const countdownInterval = setInterval(() => {
      io.to(session.lobbyCode!).emit(SocketEvents.COUNTDOWN, { seconds: countdown });
      countdown--;
      if (countdown < 0) {
        clearInterval(countdownInterval);
        startGame(session.lobbyCode!);
      }
    }, 1000);
  });

  function startGame(lobbyCode: string) {
    const lobby = lobbyManager.getLobby(lobbyCode);
    if (!lobby) return;

    lobby.gamePhase = 'role_reveal' as any;
    const gm = new GameManager(lobby, io);
    gameManagers.set(lobbyCode, gm);

    // Send role assignments to each player individually
    for (const player of lobby.players) {
      const role = gm.getPlayerRole(player.id);
      const impostorNames = role === 'impostor' ? gm.getImpostorNames(player.id) : [];
      io.to(player.id).emit(SocketEvents.ROLE_ASSIGNED, {
        role,
        impostors: impostorNames,
      });
    }

    io.to(lobbyCode).emit(SocketEvents.GAME_START, {
      mapData: gm.getMapData(),
    });

    // After role reveal, start actual gameplay
    setTimeout(() => {
      gm.startGameplay();
    }, GAME.ROLE_REVEAL_SECS * 1000);
  }

  // ─── PLAYER MOVE ───
  socket.on(SocketEvents.PLAYER_MOVE, (data: { x: number; y: number; direction: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handlePlayerMove(socket.id, data.x, data.y, data.direction as any);
  });

  // ─── KILL PLAYER ───
  socket.on(SocketEvents.KILL_PLAYER, (data: { targetId: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleKill(socket.id, data.targetId);
  });

  // ─── REPORT BODY ───
  socket.on(SocketEvents.REPORT_BODY, (data: { bodyId: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleReportBody(socket.id, data.bodyId);
  });

  // ─── CALL MEETING ───
  socket.on(SocketEvents.CALL_MEETING, () => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleCallMeeting(socket.id);
  });

  // ─── CAST VOTE ───
  socket.on(SocketEvents.CAST_VOTE, (data: { targetId: string | 'skip' }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleVote(socket.id, data.targetId);
  });

  // ─── COMPLETE TASK ───
  socket.on(SocketEvents.COMPLETE_TASK, (data: { taskId: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleCompleteTask(socket.id, data.taskId);
  });

  // ─── USE VENT ───
  socket.on(SocketEvents.USE_VENT, (data: { ventId: string; targetVentId?: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleVent(socket.id, data.ventId, data.targetVentId);
  });

  // ─── TRIGGER SABOTAGE ───
  socket.on(SocketEvents.TRIGGER_SABOTAGE, (data: { type: string; targetRoom?: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleSabotage(socket.id, data.type as any, data.targetRoom as any);
  });

  // ─── FIX SABOTAGE ───
  socket.on(SocketEvents.FIX_SABOTAGE, (data: { type: string }) => {
    const session = playerSessions.get(socket.id);
    if (!session?.lobbyCode) return;
    const gm = gameManagers.get(session.lobbyCode);
    if (!gm) return;
    gm.handleFixSabotage(socket.id, data.type as any);
  });

  // ─── LEAVE LOBBY ───
  socket.on(SocketEvents.LEAVE_LOBBY, () => {
    handleDisconnect(socket.id);
  });

  // ─── DISCONNECT ───
  socket.on('disconnect', () => {
    console.log(`[DISCONNECT] ${socket.id}`);
    handleDisconnect(socket.id);
  });

  function handleDisconnect(socketId: string) {
    const session = playerSessions.get(socketId);
    if (!session?.lobbyCode) return;

    const lobbyCode = session.lobbyCode;

    // Handle game disconnect
    const gm = gameManagers.get(lobbyCode);
    if (gm) {
      gm.handleDisconnect(socketId);
      // If game should end
      if (gm.shouldEnd()) {
        gameManagers.delete(lobbyCode);
      }
    }

    // Remove from lobby
    const lobby = lobbyManager.leaveLobby(lobbyCode, socketId);
    if (lobby) {
      io.to(lobbyCode).emit(SocketEvents.LOBBY_UPDATE, lobby);
    } else {
      // Lobby is empty, clean up
      gameManagers.delete(lobbyCode);
    }

    playerSessions.delete(socketId);
  }
});

const PORT = parseInt(process.env.PORT || '3001');
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Void game server running on port ${PORT}`);
});
