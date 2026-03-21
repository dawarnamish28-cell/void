import { Server } from 'socket.io';
import { Player, Lobby, DeadBody, TaskAssignment, SabotageState, DoorState, VoteState, MapData, Position } from '../../../shared/types.ts';
import { GAME, GamePhase, PlayerRole, SabotageType, TaskType, RoomName, SocketEvents } from '../../../shared/constants.ts';
import { buildMapData, getRoomAtPosition, TASK_STATIONS, VENTS } from '../../../shared/map.ts';
import { TileType } from '../../../shared/types.ts';

export class GameManager {
  private players = new Map<string, Player>();
  private bodies: DeadBody[] = [];
  private mapData: MapData;
  private taskAssignments = new Map<string, TaskAssignment[]>();
  private totalTasks = 0;
  private completedTasks = 0;
  private sabotage: SabotageState = { type: null, active: false, countdown: 0, fixProgress: {} };
  private doors: DoorState[] = [];
  private phase: GamePhase = GamePhase.ROLE_REVEAL;
  private vote: VoteState | null = null;
  private io: Server;
  private lobbyCode: string;
  private tickInterval: NodeJS.Timeout | null = null;
  private sabotageInterval: NodeJS.Timeout | null = null;
  private voteInterval: NodeJS.Timeout | null = null;
  private lastSabotageTime = 0;
  private impostorIds: string[] = [];
  private winner: 'crewmates' | 'impostors' | null = null;

  constructor(lobby: Lobby, io: Server) {
    this.io = io;
    this.lobbyCode = lobby.code;
    this.mapData = buildMapData();

    // Assign roles
    const playerIds = lobby.players.map(p => p.id);
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const impostorCount = Math.min(lobby.impostorCount, Math.floor(playerIds.length / 3));
    this.impostorIds = shuffled.slice(0, Math.max(1, impostorCount));

    // Create player objects
    const spawnPoints = this.generateSpawnPoints(lobby.players.length);
    lobby.players.forEach((lp, idx) => {
      const role = this.impostorIds.includes(lp.id) ? PlayerRole.IMPOSTOR : PlayerRole.CREWMATE;
      const spawn = spawnPoints[idx];
      this.players.set(lp.id, {
        id: lp.id,
        name: lp.name,
        color: lp.color,
        position: { x: spawn.x, y: spawn.y },
        role,
        isAlive: true,
        isGhost: false,
        direction: 'down',
        speed: GAME.PLAYER_SPEED,
        tasksCompleted: [],
        tasksAssigned: [],
        killCooldown: 0,
        canEmergencyMeet: true,
        lastEmergencyMeet: 0,
      });
    });

    // Assign tasks to crewmates
    this.assignTasks();
  }

  private generateSpawnPoints(count: number): Position[] {
    const center = this.mapData.spawnPoint;
    const points: Position[] = [];
    const radius = 3;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count;
      points.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      });
    }
    return points;
  }

  private assignTasks() {
    const taskPool = [...TASK_STATIONS];
    const tasksPerPlayer = 5;

    for (const [id, player] of this.players) {
      if (player.role === PlayerRole.IMPOSTOR) {
        // Impostors get fake tasks for display
        const shuffled = [...taskPool].sort(() => Math.random() - 0.5);
        const tasks: TaskAssignment[] = shuffled.slice(0, tasksPerPlayer).map(ts => ({
          id: `${id}_${ts.id}`,
          type: ts.type,
          station: ts.id,
          room: ts.room,
          completed: false,
          label: ts.label,
        }));
        this.taskAssignments.set(id, tasks);
        continue;
      }

      const shuffled = [...taskPool].sort(() => Math.random() - 0.5);
      const tasks: TaskAssignment[] = shuffled.slice(0, tasksPerPlayer).map(ts => ({
        id: `${id}_${ts.id}`,
        type: ts.type,
        station: ts.id,
        room: ts.room,
        completed: false,
        label: ts.label,
      }));
      this.taskAssignments.set(id, tasks);
      this.totalTasks += tasksPerPlayer;
      player.tasksAssigned = tasks.map(t => t.id);
    }
  }

  getPlayerRole(playerId: string): PlayerRole {
    return this.players.get(playerId)?.role || PlayerRole.CREWMATE;
  }

  getImpostorNames(requesterId: string): string[] {
    return this.impostorIds
      .filter(id => id !== requesterId)
      .map(id => this.players.get(id)?.name || 'Unknown');
  }

  getMapData(): MapData {
    return this.mapData;
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  startGameplay() {
    this.phase = GamePhase.PLAYING;
    this.broadcastState();

    // Start tick loop
    this.tickInterval = setInterval(() => {
      this.tick();
    }, GAME.TICK_RATE_MS);
  }

  private tick() {
    if (this.phase !== GamePhase.PLAYING) return;

    // Update kill cooldowns
    for (const [, player] of this.players) {
      if (player.killCooldown > 0) {
        player.killCooldown -= GAME.TICK_RATE_MS;
      }
    }

    this.broadcastState();
  }

  private broadcastState() {
    for (const [id, player] of this.players) {
      const state = this.buildClientState(id);
      this.io.to(id).emit(SocketEvents.GAME_STATE, state);
    }
  }

  private buildClientState(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return null;

    const isGhostOrDead = !player.isAlive;
    const isImpostor = player.role === PlayerRole.IMPOSTOR;
    const fovRadius = this.getFovRadius(player);

    // Build visible players (server-side FOV culling)
    const visiblePlayers = [];
    for (const [id, other] of this.players) {
      if (id === playerId) {
        visiblePlayers.push({
          id: other.id,
          name: other.name,
          color: other.color,
          position: { ...other.position },
          isAlive: other.isAlive,
          direction: other.direction,
        });
        continue;
      }

      // Ghosts see everyone
      if (isGhostOrDead) {
        visiblePlayers.push({
          id: other.id,
          name: other.name,
          color: other.color,
          position: { ...other.position },
          isAlive: other.isAlive,
          direction: other.direction,
        });
        continue;
      }

      // During meetings everyone is visible
      if (this.phase === GamePhase.MEETING || this.phase === GamePhase.VOTING) {
        visiblePlayers.push({
          id: other.id,
          name: other.name,
          color: other.color,
          position: { ...other.position },
          isAlive: other.isAlive,
          direction: other.direction,
        });
        continue;
      }

      // Living players only see within FOV
      if (!other.isAlive && !other.isGhost) continue;
      const dx = (other.position.x - player.position.x) * GAME.TILE_SIZE;
      const dy = (other.position.y - player.position.y) * GAME.TILE_SIZE;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= fovRadius) {
        visiblePlayers.push({
          id: other.id,
          name: other.name,
          color: other.color,
          position: { ...other.position },
          isAlive: other.isAlive,
          direction: other.direction,
        });
      }
    }

    // Visible bodies
    const visibleBodies = isGhostOrDead ? this.bodies : this.bodies.filter(b => {
      const dx = (b.position.x - player.position.x) * GAME.TILE_SIZE;
      const dy = (b.position.y - player.position.y) * GAME.TILE_SIZE;
      return Math.sqrt(dx * dx + dy * dy) <= fovRadius;
    });

    return {
      phase: this.phase,
      players: visiblePlayers,
      bodies: visibleBodies,
      taskProgress: this.completedTasks,
      totalTasks: this.totalTasks,
      sabotage: { ...this.sabotage },
      doors: [...this.doors],
      myRole: player.role,
      myTasks: this.taskAssignments.get(playerId) || [],
      impostors: isImpostor ? this.impostorIds : undefined,
      vote: this.vote || undefined,
      winner: this.winner || undefined,
      allRoles: this.winner ? Object.fromEntries(
        Array.from(this.players.entries()).map(([id, p]) => [id, p.role!])
      ) : undefined,
    };
  }

  private getFovRadius(player: Player): number {
    if (!player.isAlive) return 99999; // Ghosts see all
    const base = GAME.FOV_RADIUS_NORMAL;
    const bonus = player.role === PlayerRole.IMPOSTOR ? GAME.IMPOSTOR_FOV_BONUS : 0;
    if (this.sabotage.active && this.sabotage.type === SabotageType.LIGHTS && player.role !== PlayerRole.IMPOSTOR) {
      return GAME.FOV_RADIUS_LIGHTS_OUT;
    }
    return base + bonus;
  }

  // ─── MOVEMENT ───
  handlePlayerMove(playerId: string, x: number, y: number, direction: 'up' | 'down' | 'left' | 'right') {
    if (this.phase !== GamePhase.PLAYING) return;
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    // Validate the move on server
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    if (tileX < 0 || tileX >= this.mapData.width || tileY < 0 || tileY >= this.mapData.height) return;

    const tile = this.mapData.tiles[tileY]?.[tileX];
    if (tile === TileType.WALL || tile === TileType.EMPTY) return;

    // Check speed (anti-cheat: max distance per tick)
    const dx = x - player.position.x;
    const dy = y - player.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > GAME.PLAYER_SPEED * 3) return; // Allow tolerance for client-side prediction

    player.position.x = x;
    player.position.y = y;
    player.direction = direction;
  }

  // ─── KILL ───
  handleKill(killerId: string, targetId: string) {
    if (this.phase !== GamePhase.PLAYING) return;
    const killer = this.players.get(killerId);
    const target = this.players.get(targetId);
    if (!killer || !target) return;
    if (killer.role !== PlayerRole.IMPOSTOR) return;
    if (!killer.isAlive || !target.isAlive) return;
    if (killer.killCooldown > 0) return;

    // Range check
    const dx = (target.position.x - killer.position.x) * GAME.TILE_SIZE;
    const dy = (target.position.y - killer.position.y) * GAME.TILE_SIZE;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > GAME.KILL_RANGE_PX) return;

    // Perform kill
    target.isAlive = false;
    target.isGhost = true;
    killer.killCooldown = GAME.KILL_COOLDOWN_MS;

    // Teleport killer to target's position
    killer.position = { ...target.position };

    // Create body
    this.bodies.push({
      id: `body_${target.id}_${Date.now()}`,
      playerId: target.id,
      color: target.color,
      position: { ...target.position },
    });

    this.io.to(killerId).emit(SocketEvents.PLAYER_KILLED, { victimId: targetId });
    this.io.to(targetId).emit(SocketEvents.PLAYER_KILLED, { victimId: targetId, youDied: true });

    this.checkWinConditions();
  }

  // ─── REPORT BODY ───
  handleReportBody(reporterId: string, bodyId: string) {
    if (this.phase !== GamePhase.PLAYING) return;
    const reporter = this.players.get(reporterId);
    if (!reporter || !reporter.isAlive) return;

    const body = this.bodies.find(b => b.id === bodyId);
    if (!body) return;

    // Range check
    const dx = (body.position.x - reporter.position.x) * GAME.TILE_SIZE;
    const dy = (body.position.y - reporter.position.y) * GAME.TILE_SIZE;
    if (Math.sqrt(dx * dx + dy * dy) > GAME.REPORT_RANGE_PX) return;

    this.startMeeting(reporterId, 'body', body.color);
  }

  // ─── CALL MEETING ───
  handleCallMeeting(callerId: string) {
    if (this.phase !== GamePhase.PLAYING) return;
    const caller = this.players.get(callerId);
    if (!caller || !caller.isAlive) return;
    if (!caller.canEmergencyMeet) return;

    // Check if near emergency button
    const btn = this.mapData.emergencyButton;
    const dx = (caller.position.x - btn.x) * GAME.TILE_SIZE;
    const dy = (caller.position.y - btn.y) * GAME.TILE_SIZE;
    if (Math.sqrt(dx * dx + dy * dy) > GAME.TASK_RANGE_PX * 2) return;

    // Check cooldown
    if (Date.now() - caller.lastEmergencyMeet < GAME.EMERGENCY_COOLDOWN_MS) return;

    caller.canEmergencyMeet = false;
    caller.lastEmergencyMeet = Date.now();
    this.startMeeting(callerId, 'button');
  }

  private startMeeting(callerId: string, reason: 'body' | 'button', bodyColor?: string) {
    this.phase = GamePhase.MEETING;

    // Cancel sabotage
    if (this.sabotage.active) {
      this.sabotage = { type: null, active: false, countdown: 0, fixProgress: {} };
      if (this.sabotageInterval) {
        clearInterval(this.sabotageInterval);
        this.sabotageInterval = null;
      }
    }

    // Clear bodies
    this.bodies = [];

    // Teleport all alive players to cafeteria
    const spawn = this.mapData.spawnPoint;
    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    alivePlayers.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / alivePlayers.length;
      p.position = { x: spawn.x + Math.cos(angle) * 2, y: spawn.y + Math.sin(angle) * 2 };
    });

    const caller = this.players.get(callerId);
    this.vote = {
      votes: {},
      phase: 'discussion',
      timeLeft: GAME.MEETING_DISCUSS_SECS,
      callerId,
      callerName: caller?.name || 'Unknown',
      reason,
      bodyColor,
    };

    this.io.to(this.lobbyCode).emit(SocketEvents.MEETING_CALLED, {
      callerId,
      callerName: caller?.name,
      reason,
      bodyColor,
    });

    // Discussion timer
    this.voteInterval = setInterval(() => {
      if (!this.vote) return;

      this.vote.timeLeft--;

      if (this.vote.phase === 'discussion' && this.vote.timeLeft <= 0) {
        this.vote.phase = 'voting';
        this.vote.timeLeft = GAME.MEETING_VOTE_SECS;
        this.phase = GamePhase.VOTING;
      } else if (this.vote.phase === 'voting' && this.vote.timeLeft <= 0) {
        this.resolveVotes();
      }

      this.broadcastState();
    }, 1000);
  }

  // ─── VOTE ───
  handleVote(playerId: string, targetId: string | 'skip') {
    if (!this.vote || this.vote.phase !== 'voting') return;
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    this.vote.votes[playerId] = targetId;

    // Check if all alive players have voted
    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    const allVoted = alivePlayers.every(p => this.vote!.votes[p.id] !== undefined);
    if (allVoted) {
      this.resolveVotes();
    }
  }

  private resolveVotes() {
    if (this.voteInterval) {
      clearInterval(this.voteInterval);
      this.voteInterval = null;
    }

    if (!this.vote) return;

    // Count votes
    const voteCounts = new Map<string, number>();
    let skipCount = 0;
    for (const targetId of Object.values(this.vote.votes)) {
      if (targetId === 'skip') {
        skipCount++;
      } else {
        voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
      }
    }

    // Find maximum
    let maxVotes = skipCount;
    let ejectedId: string | null = null;
    let tie = false;

    for (const [id, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        ejectedId = id;
        tie = false;
      } else if (count === maxVotes && count > 0) {
        tie = true;
      }
    }

    if (tie) ejectedId = null;

    // Eject
    this.phase = GamePhase.EJECTION;
    let ejectedPlayer: Player | undefined;
    if (ejectedId) {
      ejectedPlayer = this.players.get(ejectedId);
      if (ejectedPlayer) {
        ejectedPlayer.isAlive = false;
        ejectedPlayer.isGhost = true;
      }
    }

    this.io.to(this.lobbyCode).emit(SocketEvents.EJECTION_RESULT, {
      ejectedId,
      ejectedName: ejectedPlayer?.name || null,
      ejectedColor: ejectedPlayer?.color || null,
      ejectedRole: ejectedPlayer?.role || null,
      wasImpostor: ejectedPlayer?.role === PlayerRole.IMPOSTOR,
      votes: Object.fromEntries(voteCounts),
      skipCount,
    });

    this.vote = null;

    // Check win conditions after ejection
    setTimeout(() => {
      if (this.checkWinConditions()) return;

      // Resume gameplay
      this.phase = GamePhase.PLAYING;
      this.broadcastState();
    }, 5000);
  }

  // ─── TASKS ───
  handleCompleteTask(playerId: string, taskId: string) {
    if (this.phase !== GamePhase.PLAYING) return;
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    // Impostors can fake-complete but it doesn't count
    const tasks = this.taskAssignments.get(playerId);
    if (!tasks) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.completed) return;

    // Check if player is near the task station
    const station = TASK_STATIONS.find(s => s.id === task.station);
    if (!station) return;

    const dx = (player.position.x - station.position.x) * GAME.TILE_SIZE;
    const dy = (player.position.y - station.position.y) * GAME.TILE_SIZE;
    if (Math.sqrt(dx * dx + dy * dy) > GAME.TASK_RANGE_PX * 2) return;

    task.completed = true;
    player.tasksCompleted.push(taskId);

    // Only crewmate tasks count toward progress
    if (player.role === PlayerRole.CREWMATE) {
      this.completedTasks++;
    }

    this.io.to(this.lobbyCode).emit(SocketEvents.TASK_UPDATE, {
      progress: this.completedTasks,
      total: this.totalTasks,
    });

    this.checkWinConditions();
  }

  // ─── VENTS ───
  handleVent(playerId: string, ventId: string, targetVentId?: string) {
    if (this.phase !== GamePhase.PLAYING) return;
    const player = this.players.get(playerId);
    if (!player || player.role !== PlayerRole.IMPOSTOR || !player.isAlive) return;

    const vent = VENTS.find(v => v.id === ventId);
    if (!vent) return;

    // Check proximity to vent
    const dx = (player.position.x - vent.position.x) * GAME.TILE_SIZE;
    const dy = (player.position.y - vent.position.y) * GAME.TILE_SIZE;
    if (Math.sqrt(dx * dx + dy * dy) > GAME.VENT_RANGE_PX * 2) return;

    if (targetVentId) {
      // Travel to connected vent
      if (!vent.connections.includes(targetVentId)) return;
      const targetVent = VENTS.find(v => v.id === targetVentId);
      if (!targetVent) return;
      player.position = { x: targetVent.position.x, y: targetVent.position.y };
    }
  }

  // ─── SABOTAGE ───
  handleSabotage(playerId: string, type: SabotageType, targetRoom?: RoomName) {
    if (this.phase !== GamePhase.PLAYING) return;
    const player = this.players.get(playerId);
    if (!player || player.role !== PlayerRole.IMPOSTOR || !player.isAlive) return;
    if (this.sabotage.active) return;
    if (Date.now() - this.lastSabotageTime < GAME.SABOTAGE_COOLDOWN_MS) return;

    this.sabotage = {
      type,
      active: true,
      countdown: type === SabotageType.REACTOR ? GAME.SABOTAGE_REACTOR_SECS
        : type === SabotageType.O2 ? GAME.SABOTAGE_O2_SECS : 0,
      targetRoom,
      fixProgress: {},
    };
    this.lastSabotageTime = Date.now();

    this.io.to(this.lobbyCode).emit(SocketEvents.SABOTAGE_ACTIVE, {
      type,
      countdown: this.sabotage.countdown,
      targetRoom,
    });

    // If countdown sabotage, start timer
    if (this.sabotage.countdown > 0) {
      this.sabotageInterval = setInterval(() => {
        if (!this.sabotage.active) {
          if (this.sabotageInterval) clearInterval(this.sabotageInterval);
          return;
        }
        this.sabotage.countdown--;
        if (this.sabotage.countdown <= 0) {
          // Impostors win!
          this.winner = 'impostors';
          this.phase = GamePhase.GAME_OVER;
          this.endGame();
          if (this.sabotageInterval) clearInterval(this.sabotageInterval);
        }
      }, 1000);
    }

    // Door lock
    if (type === SabotageType.DOORS && targetRoom) {
      this.doors.push({
        room: targetRoom,
        locked: true,
        unlockTime: Date.now() + GAME.DOOR_LOCK_SECS * 1000,
      });
      this.io.to(this.lobbyCode).emit(SocketEvents.DOOR_LOCKED, { room: targetRoom });
      setTimeout(() => {
        this.doors = this.doors.filter(d => d.room !== targetRoom);
        this.sabotage = { type: null, active: false, countdown: 0, fixProgress: {} };
        this.io.to(this.lobbyCode).emit(SocketEvents.DOOR_UNLOCKED, { room: targetRoom });
      }, GAME.DOOR_LOCK_SECS * 1000);
    }
  }

  handleFixSabotage(playerId: string, type: SabotageType) {
    if (!this.sabotage.active || this.sabotage.type !== type) return;
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    // For reactor: need 2 players
    if (type === SabotageType.REACTOR) {
      this.sabotage.fixProgress[playerId] = Date.now();
      const recentFixes = Object.values(this.sabotage.fixProgress).filter(t => Date.now() - t < 2000);
      if (recentFixes.length >= 2) {
        this.fixSabotage();
      }
      return;
    }

    // For others: single player fix
    this.fixSabotage();
  }

  private fixSabotage() {
    this.sabotage = { type: null, active: false, countdown: 0, fixProgress: {} };
    if (this.sabotageInterval) {
      clearInterval(this.sabotageInterval);
      this.sabotageInterval = null;
    }
    this.io.to(this.lobbyCode).emit(SocketEvents.SABOTAGE_FIXED, {});
  }

  // ─── WIN CONDITIONS ───
  private checkWinConditions(): boolean {
    // Task win (crewmates)
    if (this.totalTasks > 0 && this.completedTasks >= this.totalTasks) {
      this.winner = 'crewmates';
      this.phase = GamePhase.GAME_OVER;
      this.endGame();
      return true;
    }

    // Count alive
    let aliveCrewmates = 0;
    let aliveImpostors = 0;
    for (const [, player] of this.players) {
      if (!player.isAlive) continue;
      if (player.role === PlayerRole.IMPOSTOR) aliveImpostors++;
      else aliveCrewmates++;
    }

    // All impostors ejected
    if (aliveImpostors === 0) {
      this.winner = 'crewmates';
      this.phase = GamePhase.GAME_OVER;
      this.endGame();
      return true;
    }

    // Impostors >= crewmates
    if (aliveImpostors >= aliveCrewmates) {
      this.winner = 'impostors';
      this.phase = GamePhase.GAME_OVER;
      this.endGame();
      return true;
    }

    return false;
  }

  private endGame() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.sabotageInterval) {
      clearInterval(this.sabotageInterval);
      this.sabotageInterval = null;
    }
    if (this.voteInterval) {
      clearInterval(this.voteInterval);
      this.voteInterval = null;
    }

    const allRoles = Object.fromEntries(
      Array.from(this.players.entries()).map(([id, p]) => [id, p.role!])
    );

    this.io.to(this.lobbyCode).emit(SocketEvents.GAME_OVER, {
      winner: this.winner,
      allRoles,
      taskProgress: this.completedTasks,
      totalTasks: this.totalTasks,
    });
  }

  handleDisconnect(playerId: string) {
    const player = this.players.get(playerId);
    if (player) {
      player.isAlive = false;
      player.isGhost = true;
    }
    this.checkWinConditions();
  }

  shouldEnd(): boolean {
    // Check if all players disconnected
    let anyConnected = false;
    for (const [id] of this.players) {
      if (this.io.sockets.sockets.has(id)) {
        anyConnected = true;
        break;
      }
    }
    return !anyConnected;
  }
}
