import { useGameStore } from '../store/gameStore';
import { socketClient } from '../socket/socketClient';
import { SocketEvents, PLAYER_COLORS, PlayerRole, GamePhase } from '@shared/constants';

export default function GameOver() {
  const winner = useGameStore(s => s.winner);
  const allRoles = useGameStore(s => s.allRoles);
  const players = useGameStore(s => s.players);
  const lobby = useGameStore(s => s.lobby);
  const resetGame = useGameStore(s => s.resetGame);
  const setPhase = useGameStore(s => s.setPhase);
  const setLobby = useGameStore(s => s.setLobby);

  const isCrewmateWin = winner === 'crewmates';

  const handlePlayAgain = () => {
    resetGame();
    // Return to lobby
    setPhase(GamePhase.LOBBY);
  };

  const handleLeave = () => {
    socketClient.emit(SocketEvents.LEAVE_LOBBY);
    setLobby(null);
    resetGame();
    setPhase(GamePhase.LOGIN);
  };

  return (
    <div className="w-full h-full flex items-center justify-center" style={{
      background: isCrewmateWin
        ? 'radial-gradient(ellipse at center, #0a2a1a 0%, #0a0a12 70%)'
        : 'radial-gradient(ellipse at center, #2a0a0a 0%, #0a0a12 70%)',
    }}>
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: Math.random() * 2 + 1 + 'px',
            height: Math.random() * 2 + 1 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            opacity: Math.random() * 0.5 + 0.1,
          }} />
        ))}
      </div>

      <div className="relative z-10 glass-panel rounded-2xl p-8 max-w-2xl w-full mx-4 animate-float-in">
        {/* Winner announcement */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            {isCrewmateWin ? '🧑‍🚀' : '😈'}
          </div>
          <h1 className={`text-4xl font-bold font-mono mb-2 ${
            isCrewmateWin ? 'text-void-success' : 'text-void-danger'
          }`}>
            {isCrewmateWin ? 'CREWMATES WIN!' : 'IMPOSTORS WIN!'}
          </h1>
          <p className="text-void-muted">
            {isCrewmateWin
              ? 'The crew has prevailed against the threat!'
              : 'The impostors have taken over the ship!'}
          </p>
        </div>

        {/* Role reveal */}
        <div className="mb-8">
          <h2 className="text-sm font-mono text-void-muted uppercase tracking-wider mb-3 text-center">Role Reveal</h2>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-3">
            {players.map(player => {
              const role = allRoles?.[player.id];
              const isImpostor = role === PlayerRole.IMPOSTOR;
              const color = PLAYER_COLORS[player.color] || '#888';

              return (
                <div
                  key={player.id}
                  className={`rounded-xl p-3 text-center border ${
                    isImpostor ? 'border-void-danger/40 bg-void-danger/10' : 'border-void-border bg-void-bg/50'
                  }`}
                >
                  <div className="w-10 h-12 mx-auto mb-2 rounded-full relative" style={{ backgroundColor: color }}>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-3 bg-blue-200 rounded-full opacity-80" />
                    {!player.isAlive && (
                      <div className="absolute inset-0 flex items-center justify-center text-lg">💀</div>
                    )}
                  </div>
                  <div className="text-sm font-medium truncate">{player.name}</div>
                  <div className={`text-xs font-bold font-mono ${
                    isImpostor ? 'text-void-danger' : 'text-void-success'
                  }`}>
                    {isImpostor ? 'IMPOSTOR' : 'CREWMATE'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          <button onClick={handlePlayAgain} className="btn-primary py-3 px-8 font-bold text-lg tracking-wider">
            PLAY AGAIN
          </button>
          <button onClick={handleLeave} className="btn-void py-3 px-8 font-bold text-lg tracking-wider">
            LEAVE
          </button>
        </div>
      </div>
    </div>
  );
}
