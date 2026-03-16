import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { socketClient } from '../../socket/socketClient';
import { SocketEvents, PlayerRole, SabotageType, PLAYER_COLORS, RoomName } from '@shared/constants';
import { VENTS } from '@shared/map';

export default function ActionButtons() {
  const myRole = useGameStore(s => s.myRole);
  const players = useGameStore(s => s.players);
  const nearbyKillTarget = useGameStore(s => s.nearbyKillTarget);
  const nearbyBody = useGameStore(s => s.nearbyBody);
  const nearbyTask = useGameStore(s => s.nearbyTask);
  const nearbyVent = useGameStore(s => s.nearbyVent);
  const activeTask = useGameStore(s => s.activeTask);
  const setActiveTask = useGameStore(s => s.setActiveTask);
  const sabotage = useGameStore(s => s.sabotage);
  const killCooldown = useGameStore(s => s.killCooldown);
  const [showSabotageMenu, setShowSabotageMenu] = useState(false);

  const myId = socketClient.id || '';
  const me = players.find(p => p.id === myId);
  const isImpostor = myRole === PlayerRole.IMPOSTOR;
  const isAlive = me?.isAlive ?? false;

  const handleKill = () => {
    if (nearbyKillTarget) {
      socketClient.emit(SocketEvents.KILL_PLAYER, { targetId: nearbyKillTarget });
    }
  };

  const handleReport = () => {
    if (nearbyBody) {
      socketClient.emit(SocketEvents.REPORT_BODY, { bodyId: nearbyBody });
    }
  };

  const handleUseTask = () => {
    if (nearbyTask && !activeTask) {
      setActiveTask(nearbyTask);
    }
  };

  const handleVent = () => {
    if (nearbyVent) {
      const vent = VENTS.find(v => v.id === nearbyVent);
      if (vent && vent.connections.length > 0) {
        socketClient.emit(SocketEvents.USE_VENT, { ventId: nearbyVent, targetVentId: vent.connections[0] });
      }
    }
  };

  const handleSabotage = (type: SabotageType, room?: RoomName) => {
    socketClient.emit(SocketEvents.TRIGGER_SABOTAGE, { type, targetRoom: room });
    setShowSabotageMenu(false);
  };

  const handleFixSabotage = () => {
    if (sabotage.active && sabotage.type) {
      socketClient.emit(SocketEvents.FIX_SABOTAGE, { type: sabotage.type });
    }
  };

  // Player dots at bottom
  const alivePlayers = players.filter(p => p.isAlive);

  return (
    <div className="h-14 flex items-center justify-between px-4 bg-void-panel border-t border-void-border flex-shrink-0 relative">
      {/* Player dots */}
      <div className="flex items-center gap-1.5">
        {players.map(p => (
          <div
            key={p.id}
            className={`w-5 h-5 rounded-full border transition-all ${
              p.isAlive ? 'border-white/20' : 'border-void-muted/20 opacity-30'
            } ${p.id === myId ? 'ring-2 ring-white/40' : ''}`}
            style={{ backgroundColor: PLAYER_COLORS[p.color] || '#888' }}
            title={`${p.name} ${p.isAlive ? '' : '(dead)'}`}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Fix sabotage */}
        {sabotage.active && sabotage.type && isAlive && (
          <button
            onClick={handleFixSabotage}
            className="btn-void bg-void-warning border-void-warning text-black font-bold text-sm px-4 py-1.5 animate-pulse-red"
          >
            🔧 FIX ({sabotage.type?.toUpperCase()})
          </button>
        )}

        {/* Report body */}
        {nearbyBody && isAlive && (
          <button
            onClick={handleReport}
            className="btn-danger font-bold text-sm px-4 py-1.5 neon-glow-red"
          >
            🚨 REPORT [R]
          </button>
        )}

        {/* Use task */}
        {nearbyTask && !activeTask && isAlive && (
          <button
            onClick={handleUseTask}
            className="btn-void bg-void-accent border-void-accent text-white font-bold text-sm px-4 py-1.5"
          >
            ⚡ USE [F]
          </button>
        )}

        {/* Impostor buttons */}
        {isImpostor && isAlive && (
          <>
            {/* Kill */}
            <button
              onClick={handleKill}
              disabled={!nearbyKillTarget}
              className={`font-bold text-sm px-4 py-1.5 rounded transition-all ${
                nearbyKillTarget
                  ? 'bg-red-600 text-white hover:bg-red-500 neon-glow-red border border-red-500'
                  : 'bg-void-bg text-void-muted border border-void-border cursor-not-allowed opacity-50'
              }`}
            >
              🔪 KILL [Q]
            </button>

            {/* Vent */}
            {nearbyVent && (
              <button
                onClick={handleVent}
                className="btn-void bg-emerald-800 border-emerald-600 text-emerald-200 font-bold text-sm px-4 py-1.5"
              >
                🕳️ VENT [E]
              </button>
            )}

            {/* Sabotage */}
            <div className="relative">
              <button
                onClick={() => setShowSabotageMenu(!showSabotageMenu)}
                className="btn-void bg-purple-900 border-purple-600 text-purple-200 font-bold text-sm px-4 py-1.5"
              >
                💀 SABOTAGE [X]
              </button>

              {showSabotageMenu && (
                <div className="absolute bottom-full mb-2 right-0 glass-panel rounded-lg p-2 space-y-1 w-48 animate-slide-up">
                  <button onClick={() => handleSabotage(SabotageType.LIGHTS)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-void-border transition-colors">
                    ⚡ Lights
                  </button>
                  <button onClick={() => handleSabotage(SabotageType.REACTOR)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-void-border transition-colors text-void-danger">
                    ☢️ Reactor
                  </button>
                  <button onClick={() => handleSabotage(SabotageType.O2)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-void-border transition-colors text-void-warning">
                    💨 O2
                  </button>
                  <button onClick={() => handleSabotage(SabotageType.COMMS)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-void-border transition-colors">
                    📡 Comms
                  </button>
                  <button onClick={() => handleSabotage(SabotageType.DOORS, RoomName.CAFETERIA)} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-void-border transition-colors">
                    🚪 Doors
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Ghost indicator */}
      {!isAlive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-void-muted/40 font-mono text-sm">👻 GHOST MODE</span>
        </div>
      )}
    </div>
  );
}
