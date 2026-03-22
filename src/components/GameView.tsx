import { useEffect, useRef, useCallback, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { socketClient } from '../socket/socketClient';
import { SocketEvents, GAME, PlayerRole, SabotageType, PLAYER_COLORS, RoomName } from '@shared/constants';
import { TASK_STATIONS, VENTS, ROOM_DEFS, getRoomAtPosition } from '@shared/map';
import { renderGame, updateInterpolationTargets } from '../game/renderer';
import { InputManager, isWalkable } from '../game/input';
import { MapData, Position, PlayerView } from '@shared/types';
import TaskModal from './Tasks/TaskModal';

// Throttle server updates
const MOVE_EMIT_INTERVAL = 33; // ~30 updates/sec

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<InputManager | null>(null);
  const animRef = useRef<number>(0);
  const lastEmitRef = useRef<number>(0);
  const [showSabMenu, setShowSabMenu] = useState(false);
  const [showTaskList, setShowTaskList] = useState(true);

  // ─── LOCAL POSITION (never overwritten by server) ───
  // This is the single source of truth for OUR player's position.
  // Server position is IGNORED for the local player.
  const localPosRef = useRef<Position>({ x: 22, y: 16 });
  const localDirRef = useRef<'up' | 'down' | 'left' | 'right'>('down');
  const localPosInited = useRef(false);

  // Read from store (but NOT for position of local player)
  const mapData = useGameStore(s => s.mapData);
  const myRole = useGameStore(s => s.myRole);
  const myTasks = useGameStore(s => s.myTasks);
  const sabotage = useGameStore(s => s.sabotage);
  const activeTask = useGameStore(s => s.activeTask);
  const taskProgress = useGameStore(s => s.taskProgress);
  const totalTasks = useGameStore(s => s.totalTasks);
  const nearbyKillTarget = useGameStore(s => s.nearbyKillTarget);
  const nearbyBody = useGameStore(s => s.nearbyBody);
  const nearbyTask = useGameStore(s => s.nearbyTask);
  const nearbyVent = useGameStore(s => s.nearbyVent);
  const nearbyEmergencyButton = useGameStore(s => s.nearbyEmergencyButton);

  const myId = socketClient.id || '';
  const isImpostor = myRole === PlayerRole.IMPOSTOR;

  // Derive these from store players for HUD (not movement)
  const players = useGameStore(s => s.players);
  const bodies = useGameStore(s => s.bodies);
  const me = players.find(p => p.id === myId);
  const isGhost = me ? !me.isAlive : false;
  const isAlive = me?.isAlive ?? false;
  const progressPct = totalTasks > 0 ? (taskProgress / totalTasks) * 100 : 0;

  // Init local position from server the FIRST time we get our player data
  useEffect(() => {
    if (me && !localPosInited.current) {
      localPosRef.current = { ...me.position };
      localDirRef.current = me.direction || 'down';
      localPosInited.current = true;
    }
  }, [me]);

  // Room name from local position
  const roomName = getRoomAtPosition(
    Math.floor(localPosRef.current.x),
    Math.floor(localPosRef.current.y)
  );

  // FOV radius
  const fovRadius = (() => {
    if (isGhost) return 99999;
    let base = GAME.FOV_RADIUS_NORMAL;
    if (isImpostor) base += GAME.IMPOSTOR_FOV_BONUS;
    if (sabotage.active && sabotage.type === SabotageType.LIGHTS && !isImpostor) {
      return GAME.FOV_RADIUS_LIGHTS_OUT;
    }
    return base;
  })();

  // ─── MOVEMENT (reads from ref, not React state — never stale) ───
  const handleMoveRef = useRef<((dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => void) | null>(null);

  // Update the move handler ref (NOT a useCallback — no deps, no recreation)
  useEffect(() => {
    handleMoveRef.current = (dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => {
      const store = useGameStore.getState();
      const md = store.mapData;
      if (!md) return;
      // Check alive from store
      const meNow = store.players.find(p => p.id === socketClient.id);
      if (!meNow || !meNow.isAlive) return;

      const pos = localPosRef.current;
      const newX = pos.x + dx;
      const newY = pos.y + dy;

      let finalX = pos.x;
      let finalY = pos.y;

      if (isWalkable(newX, newY, md)) {
        finalX = newX;
        finalY = newY;
      } else if (isWalkable(newX, pos.y, md)) {
        finalX = newX;
      } else if (isWalkable(pos.x, newY, md)) {
        finalY = newY;
      }

      if (finalX !== pos.x || finalY !== pos.y) {
        // Update local ref immediately (no React re-render needed for movement!)
        localPosRef.current = { x: finalX, y: finalY };
        localDirRef.current = dir;

        // Throttle server emissions
        const now = performance.now();
        if (now - lastEmitRef.current >= MOVE_EMIT_INTERVAL) {
          socketClient.emit(SocketEvents.PLAYER_MOVE, { x: finalX, y: finalY, direction: dir });
          lastEmitRef.current = now;
        }
      }
    };
  }, []);

  // ─── INPUT MANAGER (created ONCE, never recreated) ───
  useEffect(() => {
    const input = new InputManager();
    inputRef.current = input;
    // Pass a stable wrapper that delegates to the ref
    input.start((dx, dy, dir) => {
      handleMoveRef.current?.(dx, dy, dir);
    });
    return () => input.stop();
  }, []); // Empty deps = created once

  useEffect(() => {
    inputRef.current?.setEnabled(!activeTask);
  }, [activeTask]);

  // ─── PROXIMITY CHECKS (use local position ref) ───
  // Run in the render loop instead of React effects to avoid stale closures
  const proximityRef = useRef<number>(0);

  // ─── CANVAS RENDER LOOP ───
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const render = () => {
      const state = useGameStore.getState();
      const md = state.mapData;
      if (!md) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      // Resize canvas only when needed
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      // Build the player list for rendering:
      // For the LOCAL player, use localPosRef (our predicted position).
      // For OTHER players, use their server positions.
      const sid = socketClient.id || '';
      const renderPlayers: PlayerView[] = state.players.map(p => {
        if (p.id === sid) {
          return {
            ...p,
            position: { ...localPosRef.current },
            direction: localDirRef.current,
          };
        }
        return p;
      });

      updateInterpolationTargets(renderPlayers);

      // Compute FOV
      const meNow = state.players.find(p => p.id === sid);
      const ghost = meNow ? !meNow.isAlive : false;
      const imp = state.myRole === PlayerRole.IMPOSTOR;
      let fov = GAME.FOV_RADIUS_NORMAL;
      if (ghost) fov = 99999;
      else {
        if (imp) fov += GAME.IMPOSTOR_FOV_BONUS;
        if (state.sabotage.active && state.sabotage.type === SabotageType.LIGHTS && !imp) {
          fov = GAME.FOV_RADIUS_LIGHTS_OUT;
        }
      }

      renderGame(ctx, canvas, md, renderPlayers, state.bodies, sid, fov, ghost, state.sabotage.type);

      // ─── PROXIMITY CHECKS (every 3rd frame to reduce overhead) ───
      proximityRef.current++;
      if (proximityRef.current % 3 === 0 && meNow && meNow.isAlive) {
        const TS = GAME.TILE_SIZE;
        const myX = localPosRef.current.x;
        const myY = localPosRef.current.y;

        // Kill target
        if (imp) {
          let closest: string | null = null;
          let closestDist = GAME.KILL_RANGE_PX;
          for (const p of state.players) {
            if (p.id === sid || !p.isAlive) continue;
            const d = Math.hypot((p.position.x - myX) * TS, (p.position.y - myY) * TS);
            if (d < closestDist) { closestDist = d; closest = p.id; }
          }
          if (closest !== state.nearbyKillTarget) useGameStore.getState().setNearbyKillTarget(closest);
        }

        // Body
        let nearestBody: string | null = null;
        let nearestBodyDist = GAME.REPORT_RANGE_PX;
        for (const b of state.bodies) {
          const d = Math.hypot((b.position.x - myX) * TS, (b.position.y - myY) * TS);
          if (d < nearestBodyDist) { nearestBodyDist = d; nearestBody = b.id; }
        }
        if (nearestBody !== state.nearbyBody) useGameStore.getState().setNearbyBody(nearestBody);

        // Task
        let nearestTask: any = null;
        let nearestTaskDist = GAME.TASK_RANGE_PX * 1.5;
        for (const ts of TASK_STATIONS) {
          const mt = state.myTasks.find(t => t.station === ts.id && !t.completed);
          if (!mt) continue;
          const d = Math.hypot((ts.position.x - myX) * TS, (ts.position.y - myY) * TS);
          if (d < nearestTaskDist) { nearestTaskDist = d; nearestTask = mt; }
        }
        const curTask = state.nearbyTask;
        if ((nearestTask?.id || null) !== (curTask?.id || null)) {
          useGameStore.getState().setNearbyTask(nearestTask);
        }

        // Vent
        if (imp) {
          let nearVent: string | null = null;
          for (const v of VENTS) {
            const d = Math.hypot((v.position.x - myX) * TS, (v.position.y - myY) * TS);
            if (d < GAME.VENT_RANGE_PX * 1.5) { nearVent = v.id; break; }
          }
          if (nearVent !== state.nearbyVent) useGameStore.getState().setNearbyVent(nearVent);
        }

        // Emergency button
        const btn = md.emergencyButton;
        const d = Math.hypot((btn.x - myX) * TS, (btn.y - myY) * TS);
        const near = d < GAME.TASK_RANGE_PX * 2;
        if (near !== state.nearbyEmergencyButton) useGameStore.getState().setNearbyEmergencyButton(near);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []); // Empty deps — everything read from refs/store.getState()

  // ─── KEY BINDINGS ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      const s = useGameStore.getState();
      const imp = s.myRole === PlayerRole.IMPOSTOR;
      if (k === 'q' && imp && s.nearbyKillTarget) socketClient.emit(SocketEvents.KILL_PLAYER, { targetId: s.nearbyKillTarget });
      if (k === 'r' && s.nearbyBody) socketClient.emit(SocketEvents.REPORT_BODY, { bodyId: s.nearbyBody });
      if (k === 'f' && s.nearbyTask && !s.activeTask) useGameStore.getState().setActiveTask(s.nearbyTask);
      if (k === 'e' && imp && s.nearbyVent) {
        const vent = VENTS.find(v => v.id === s.nearbyVent);
        if (vent?.connections.length) socketClient.emit(SocketEvents.USE_VENT, { ventId: s.nearbyVent, targetVentId: vent.connections[0] });
      }
      if (k === 'escape' && s.activeTask) useGameStore.getState().setActiveTask(null);
      if (k === 'tab') { e.preventDefault(); setShowTaskList(prev => !prev); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Action handlers
  const handleKill = () => {
    const s = useGameStore.getState();
    if (s.nearbyKillTarget) socketClient.emit(SocketEvents.KILL_PLAYER, { targetId: s.nearbyKillTarget });
  };
  const handleReport = () => {
    const s = useGameStore.getState();
    if (s.nearbyBody) socketClient.emit(SocketEvents.REPORT_BODY, { bodyId: s.nearbyBody });
  };
  const handleUse = () => {
    const s = useGameStore.getState();
    if (s.nearbyTask && !s.activeTask) useGameStore.getState().setActiveTask(s.nearbyTask);
  };
  const handleVent = () => {
    const s = useGameStore.getState();
    if (s.nearbyVent) {
      const vent = VENTS.find(v => v.id === s.nearbyVent);
      if (vent?.connections.length) socketClient.emit(SocketEvents.USE_VENT, { ventId: s.nearbyVent, targetVentId: vent.connections[0] });
    }
  };
  const handleSabotage = (type: SabotageType, room?: RoomName) => {
    socketClient.emit(SocketEvents.TRIGGER_SABOTAGE, { type, targetRoom: room });
    setShowSabMenu(false);
  };
  const handleFixSabotage = () => {
    const s = useGameStore.getState();
    if (s.sabotage.active && s.sabotage.type) socketClient.emit(SocketEvents.FIX_SABOTAGE, { type: s.sabotage.type });
  };
  const handleMeeting = () => { socketClient.emit(SocketEvents.CALL_MEETING); };

  return (
    <div className="w-full h-full relative bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ═══ HUD ═══ */}

      {/* Top-left: Task bar + list */}
      <div className="absolute top-3 left-3 z-10" style={{ maxWidth: '280px' }}>
        <div className="bg-black/70 rounded-lg px-3 py-2 mb-1 backdrop-blur-sm border border-white/10">
          <div className="flex justify-between text-[11px] text-green-300 mb-1 font-mono">
            <span>Tasks</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-900 rounded-full border border-gray-700">
            <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        {showTaskList && (
          <div className="bg-black/60 rounded-lg px-3 py-2 backdrop-blur-sm border border-white/10 max-h-52 overflow-y-auto">
            {myTasks.map(task => (
              <div key={task.id} className={`text-[11px] py-0.5 font-mono ${task.completed ? 'text-green-500/50 line-through' : 'text-yellow-300/90'}`}>
                {task.room}: {task.label}
              </div>
            ))}
            {isImpostor && <div className="text-[9px] text-red-400/50 mt-1 italic">Sabotage and kill everyone</div>}
          </div>
        )}
      </div>

      {/* Top-right: Emergency button */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {nearbyEmergencyButton && isAlive && (
          <button onClick={handleMeeting}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-red-900/50 animate-pulse border-2 border-red-400">
            !
          </button>
        )}
      </div>

      {/* Sabotage alert */}
      {sabotage.active && sabotage.type && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-red-900/80 backdrop-blur-sm px-6 py-2 rounded-lg border border-red-500/50 animate-pulse">
            <div className="text-red-200 font-bold text-sm font-mono text-center">
              {sabotage.type === SabotageType.REACTOR && '☢️ REACTOR MELTDOWN'}
              {sabotage.type === SabotageType.O2 && '💨 OXYGEN DEPLETING'}
              {sabotage.type === SabotageType.LIGHTS && '⚡ LIGHTS SABOTAGED'}
              {sabotage.type === SabotageType.COMMS && '📡 COMMS DISRUPTED'}
              {sabotage.type === SabotageType.DOORS && '🚪 DOORS LOCKED'}
              {sabotage.countdown > 0 && <span className="ml-2 text-xl">{sabotage.countdown}s</span>}
            </div>
          </div>
        </div>
      )}

      {/* Bottom center: Room name */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10">
        <div className="text-white/40 text-sm font-mono tracking-widest">{roomName || ''}</div>
      </div>

      {/* Bottom-right: Action buttons */}
      <div className="absolute bottom-4 right-4 z-10 flex items-end gap-3">
        {sabotage.active && sabotage.type && isAlive && (
          <button onClick={handleFixSabotage}
            className="w-16 h-16 rounded-full bg-yellow-600 hover:bg-yellow-500 flex flex-col items-center justify-center text-white font-bold shadow-lg border-2 border-yellow-400 animate-pulse">
            <span className="text-lg">🔧</span>
            <span className="text-[8px]">FIX</span>
          </button>
        )}
        {nearbyBody && isAlive && (
          <button onClick={handleReport}
            className="w-16 h-16 rounded-full bg-red-700 hover:bg-red-600 flex flex-col items-center justify-center text-white font-bold shadow-lg shadow-red-900/50 border-2 border-red-400">
            <span className="text-lg">🚨</span>
            <span className="text-[8px]">REPORT</span>
          </button>
        )}
        {nearbyTask && !activeTask && isAlive && (
          <button onClick={handleUse}
            className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30 flex flex-col items-center justify-center text-white font-bold shadow-lg backdrop-blur-sm border-2 border-white/30">
            <span className="text-lg">👆</span>
            <span className="text-[8px]">USE</span>
          </button>
        )}
        {isImpostor && isAlive && (
          <>
            {nearbyVent && (
              <button onClick={handleVent}
                className="w-14 h-14 rounded-full bg-green-900 hover:bg-green-800 flex flex-col items-center justify-center text-green-200 font-bold shadow-lg border-2 border-green-600">
                <span className="text-sm">🕳️</span>
                <span className="text-[7px]">VENT</span>
              </button>
            )}
            <button onClick={handleKill} disabled={!nearbyKillTarget}
              className={`w-16 h-16 rounded-full flex flex-col items-center justify-center font-bold shadow-lg border-2 transition-all ${
                nearbyKillTarget
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-400 shadow-red-900/50'
                  : 'bg-gray-800/50 text-gray-500 border-gray-700 cursor-not-allowed'
              }`}>
              <span className="text-lg">🔪</span>
              <span className="text-[8px]">KILL</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowSabMenu(!showSabMenu)}
                className="w-14 h-14 rounded-full bg-purple-900 hover:bg-purple-800 flex flex-col items-center justify-center text-purple-200 font-bold shadow-lg border-2 border-purple-600">
                <span className="text-sm">💀</span>
                <span className="text-[7px]">SABOTAGE</span>
              </button>
              {showSabMenu && (
                <div className="absolute bottom-full mb-2 right-0 bg-gray-900/95 backdrop-blur-sm rounded-lg p-2 w-44 border border-gray-700 shadow-xl">
                  {[
                    { type: SabotageType.LIGHTS, icon: '⚡', label: 'Lights' },
                    { type: SabotageType.REACTOR, icon: '☢️', label: 'Reactor', cls: 'text-red-400' },
                    { type: SabotageType.O2, icon: '💨', label: 'O2', cls: 'text-yellow-400' },
                    { type: SabotageType.COMMS, icon: '📡', label: 'Comms' },
                    { type: SabotageType.DOORS, icon: '🚪', label: 'Doors' },
                  ].map(s => (
                    <button key={s.type} onClick={() => handleSabotage(s.type, s.type === SabotageType.DOORS ? RoomName.CAFETERIA : undefined)}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs hover:bg-white/10 ${s.cls || 'text-gray-300'}`}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Ghost indicator */}
      {!isAlive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
          <div className="text-white/10 font-mono text-3xl font-bold">GHOST</div>
        </div>
      )}

      {activeTask && <TaskModal />}
    </div>
  );
}
