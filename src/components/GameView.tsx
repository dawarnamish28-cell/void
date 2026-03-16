import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { socketClient } from '../socket/socketClient';
import { SocketEvents, GAME, PlayerRole, SabotageType } from '@shared/constants';
import { TASK_STATIONS, VENTS } from '@shared/map';
import { renderGame } from '../game/renderer';
import { InputManager, isWalkable } from '../game/input';
import TopBar from './HUD/TopBar';
import TaskList from './HUD/TaskList';
import MiniMap from './HUD/MiniMap';
import ActionButtons from './HUD/ActionButtons';
import TaskModal from './Tasks/TaskModal';

export default function GameView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<InputManager | null>(null);
  const animRef = useRef<number>(0);
  
  const mapData = useGameStore(s => s.mapData);
  const players = useGameStore(s => s.players);
  const bodies = useGameStore(s => s.bodies);
  const myRole = useGameStore(s => s.myRole);
  const myTasks = useGameStore(s => s.myTasks);
  const sabotage = useGameStore(s => s.sabotage);
  const activeTask = useGameStore(s => s.activeTask);
  const setMyPosition = useGameStore(s => s.setMyPosition);
  const setMyDirection = useGameStore(s => s.setMyDirection);
  const setNearbyKillTarget = useGameStore(s => s.setNearbyKillTarget);
  const setNearbyBody = useGameStore(s => s.setNearbyBody);
  const setNearbyTask = useGameStore(s => s.setNearbyTask);
  const setNearbyVent = useGameStore(s => s.setNearbyVent);
  const setNearbyEmergencyButton = useGameStore(s => s.setNearbyEmergencyButton);

  const myId = socketClient.id || '';
  const me = players.find(p => p.id === myId);
  const isGhost = me ? !me.isAlive : false;
  const isImpostor = myRole === PlayerRole.IMPOSTOR;

  // Calculate FOV radius
  const fovRadius = (() => {
    if (isGhost) return 99999;
    let base = GAME.FOV_RADIUS_NORMAL;
    if (isImpostor) base += GAME.IMPOSTOR_FOV_BONUS;
    if (sabotage.active && sabotage.type === SabotageType.LIGHTS && !isImpostor) {
      return GAME.FOV_RADIUS_LIGHTS_OUT;
    }
    return base;
  })();

  // Handle movement
  const handleMove = useCallback((dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => {
    if (!mapData || !me || !me.isAlive) return;
    
    const newX = me.position.x + dx;
    const newY = me.position.y + dy;
    
    if (isWalkable(newX, newY, mapData)) {
      socketClient.emit(SocketEvents.PLAYER_MOVE, { x: newX, y: newY, direction: dir });
      setMyPosition({ x: newX, y: newY });
      setMyDirection(dir);
    } else if (isWalkable(newX, me.position.y, mapData)) {
      socketClient.emit(SocketEvents.PLAYER_MOVE, { x: newX, y: me.position.y, direction: dir });
      setMyPosition({ x: newX, y: me.position.y });
      setMyDirection(dir);
    } else if (isWalkable(me.position.x, newY, mapData)) {
      socketClient.emit(SocketEvents.PLAYER_MOVE, { x: me.position.x, y: newY, direction: dir });
      setMyPosition({ x: me.position.x, y: newY });
      setMyDirection(dir);
    }
  }, [mapData, me]);

  // Check proximity
  useEffect(() => {
    if (!me || !me.isAlive) return;
    const TILE = GAME.TILE_SIZE;

    // Kill target
    if (isImpostor) {
      let closest: string | null = null;
      let closestDist = GAME.KILL_RANGE_PX;
      for (const p of players) {
        if (p.id === myId || !p.isAlive) continue;
        const dx = (p.position.x - me.position.x) * TILE;
        const dy = (p.position.y - me.position.y) * TILE;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = p.id;
        }
      }
      setNearbyKillTarget(closest);
    }

    // Nearby body
    let nearestBody: string | null = null;
    let nearestBodyDist = GAME.REPORT_RANGE_PX;
    for (const b of bodies) {
      const dx = (b.position.x - me.position.x) * TILE;
      const dy = (b.position.y - me.position.y) * TILE;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestBodyDist) {
        nearestBodyDist = dist;
        nearestBody = b.id;
      }
    }
    setNearbyBody(nearestBody);

    // Nearby task
    let nearestTask: any = null;
    let nearestTaskDist = GAME.TASK_RANGE_PX * 1.5;
    for (const ts of TASK_STATIONS) {
      const myTask = myTasks.find(t => t.station === ts.id && !t.completed);
      if (!myTask) continue;
      const dx = (ts.position.x - me.position.x) * TILE;
      const dy = (ts.position.y - me.position.y) * TILE;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestTaskDist) {
        nearestTaskDist = dist;
        nearestTask = myTask;
      }
    }
    setNearbyTask(nearestTask);

    // Nearby vent (impostors only)
    if (isImpostor) {
      let nearVent: string | null = null;
      for (const v of VENTS) {
        const dx = (v.position.x - me.position.x) * TILE;
        const dy = (v.position.y - me.position.y) * TILE;
        if (Math.sqrt(dx * dx + dy * dy) < GAME.VENT_RANGE_PX * 1.5) {
          nearVent = v.id;
          break;
        }
      }
      setNearbyVent(nearVent);
    }

    // Emergency button
    const btn = mapData?.emergencyButton;
    if (btn) {
      const dx = (btn.x - me.position.x) * TILE;
      const dy = (btn.y - me.position.y) * TILE;
      setNearbyEmergencyButton(Math.sqrt(dx * dx + dy * dy) < GAME.TASK_RANGE_PX * 2);
    }
  }, [me?.position.x, me?.position.y, players, bodies, myTasks]);

  // Input setup
  useEffect(() => {
    const input = new InputManager();
    inputRef.current = input;
    input.start(handleMove);
    return () => input.stop();
  }, [handleMove]);

  // Disable input when task modal is open
  useEffect(() => {
    inputRef.current?.setEnabled(!activeTask);
  }, [activeTask]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapData) return;

    const ctx = canvas.getContext('2d')!;

    const render = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;

      const currentPlayers = useGameStore.getState().players;
      const currentBodies = useGameStore.getState().bodies;
      const currentSabotage = useGameStore.getState().sabotage;

      renderGame(
        ctx, canvas, mapData,
        currentPlayers, currentBodies,
        myId, fovRadius, isGhost,
        currentSabotage.type,
      );

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [mapData, myId, fovRadius, isGhost]);

  // Key bindings for actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const key = e.key.toLowerCase();
      const state = useGameStore.getState();

      if (key === 'q' && isImpostor && state.nearbyKillTarget) {
        socketClient.emit(SocketEvents.KILL_PLAYER, { targetId: state.nearbyKillTarget });
      }
      if (key === 'r' && state.nearbyBody) {
        socketClient.emit(SocketEvents.REPORT_BODY, { bodyId: state.nearbyBody });
      }
      if (key === 'f' && state.nearbyTask && !state.activeTask) {
        useGameStore.getState().setActiveTask(state.nearbyTask);
      }
      if (key === 'e' && isImpostor && state.nearbyVent) {
        const vent = VENTS.find(v => v.id === state.nearbyVent);
        if (vent && vent.connections.length > 0) {
          socketClient.emit(SocketEvents.USE_VENT, { ventId: state.nearbyVent, targetVentId: vent.connections[0] });
        }
      }
      if (key === 'escape' && state.activeTask) {
        useGameStore.getState().setActiveTask(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImpostor]);

  return (
    <div className="w-full h-full flex flex-col bg-void-bg">
      {/* Top Bar */}
      <TopBar />

      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar: Mini-map */}
        <div className="w-48 flex-shrink-0 border-r border-void-border">
          <MiniMap />
        </div>

        {/* Game Canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full block" />
          
          {/* Task Modal Overlay */}
          {activeTask && <TaskModal />}
        </div>

        {/* Right Sidebar: Task List */}
        <div className="w-56 flex-shrink-0 border-l border-void-border">
          <TaskList />
        </div>
      </div>

      {/* Bottom Bar: Action Buttons */}
      <ActionButtons />
    </div>
  );
}
