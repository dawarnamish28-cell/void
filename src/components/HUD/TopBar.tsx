import { useGameStore } from '../../store/gameStore';
import { socketClient } from '../../socket/socketClient';
import { SocketEvents, PLAYER_COLORS, SabotageType } from '@shared/constants';
import { getRoomAtPosition } from '@shared/map';

export default function TopBar() {
  const players = useGameStore(s => s.players);
  const sabotage = useGameStore(s => s.sabotage);
  const nearbyEmergencyButton = useGameStore(s => s.nearbyEmergencyButton);
  const myId = socketClient.id || '';
  const me = players.find(p => p.id === myId);

  const roomName = me ? getRoomAtPosition(Math.floor(me.position.x), Math.floor(me.position.y)) : null;

  const callMeeting = () => {
    socketClient.emit(SocketEvents.CALL_MEETING);
  };

  const sabotageLabels: Record<string, string> = {
    [SabotageType.LIGHTS]: '⚡ LIGHTS SABOTAGED',
    [SabotageType.REACTOR]: '☢️ REACTOR MELTDOWN',
    [SabotageType.O2]: '💨 OXYGEN DEPLETING',
    [SabotageType.COMMS]: '📡 COMMS DISRUPTED',
    [SabotageType.DOORS]: '🚪 DOORS LOCKED',
  };

  return (
    <div className="h-10 flex items-center justify-between px-4 bg-void-panel border-b border-void-border flex-shrink-0">
      {/* Room name */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-void-muted uppercase tracking-wider">
          📍 {roomName || 'Unknown'}
        </span>
      </div>

      {/* Sabotage alert */}
      {sabotage.active && sabotage.type && (
        <div className="flex items-center gap-2 animate-pulse-red">
          <span className="text-void-danger font-bold text-sm font-mono">
            {sabotageLabels[sabotage.type] || 'SABOTAGE!'}
          </span>
          {sabotage.countdown > 0 && (
            <span className="text-void-danger font-mono text-lg font-bold">
              {sabotage.countdown}s
            </span>
          )}
        </div>
      )}

      {/* Emergency meeting button */}
      <button
        onClick={callMeeting}
        disabled={!nearbyEmergencyButton || !me?.isAlive}
        className={`px-3 py-1 rounded text-xs font-bold font-mono transition-all ${
          nearbyEmergencyButton && me?.isAlive
            ? 'bg-void-danger text-white hover:bg-red-500 neon-glow-red'
            : 'bg-void-bg text-void-muted border border-void-border cursor-not-allowed opacity-50'
        }`}
      >
        🚨 EMERGENCY
      </button>
    </div>
  );
}
