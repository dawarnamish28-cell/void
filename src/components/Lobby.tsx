import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { socketClient } from '../socket/socketClient';
import { SocketEvents, PLAYER_COLORS, COLOR_NAMES, GAME, GamePhase } from '@shared/constants';

export default function Lobby() {
  const lobby = useGameStore(s => s.lobby);
  const playerName = useGameStore(s => s.playerName);
  const setPhase = useGameStore(s => s.setPhase);
  const setLobby = useGameStore(s => s.setLobby);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const messages = useGameStore(s => s.messages);
  const addMessage = useGameStore(s => s.addMessage);

  const myId = socketClient.id;
  const isHost = lobby?.hostId === myId;
  const myPlayer = lobby?.players.find(p => p.id === myId);
  const usedColors = new Set(lobby?.players.map(p => p.color) || []);

  useEffect(() => {
    const handler = (data: { seconds: number }) => {
      setCountdown(data.seconds);
    };
    socketClient.on(SocketEvents.COUNTDOWN, handler);
    return () => socketClient.off(SocketEvents.COUNTDOWN, handler);
  }, []);

  const selectColor = (color: string) => {
    socketClient.emit(SocketEvents.SELECT_COLOR, { color });
  };

  const setImpostorCount = (count: number) => {
    socketClient.emit(SocketEvents.SET_IMPOSTOR_COUNT, { count });
  };

  const kickPlayer = (targetId: string) => {
    socketClient.emit(SocketEvents.KICK_PLAYER, { targetId });
  };

  const startGame = () => {
    socketClient.emit(SocketEvents.START_GAME);
  };

  const leaveLobby = () => {
    socketClient.emit(SocketEvents.LEAVE_LOBBY);
    setLobby(null);
    setPhase(GamePhase.LOGIN);
  };

  const sendChat = () => {
    if (!chatInput.trim()) return;
    socketClient.emit(SocketEvents.CHAT_MESSAGE, { text: chatInput.trim() });
    setChatInput('');
  };

  if (!lobby) return null;

  return (
    <div className="w-full h-full flex" style={{ background: 'radial-gradient(ellipse at center, #12121f 0%, #0a0a12 70%)' }}>
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: Math.random() * 2 + 1 + 'px',
            height: Math.random() * 2 + 1 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            opacity: Math.random() * 0.5 + 0.1,
          }} />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col w-full h-full p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={leaveLobby} className="btn-void text-sm">← Leave</button>
          <div className="text-center">
            <h2 className="text-2xl font-bold font-mono tracking-wider">LOBBY</h2>
            <div className="flex items-center gap-2 justify-center mt-1">
              <span className="text-void-muted text-sm">Code:</span>
              <span className="text-void-accent font-mono text-xl tracking-[0.3em] font-bold">{lobby.code}</span>
            </div>
          </div>
          <div className="text-void-muted text-sm font-mono">
            {lobby.players.length}/{lobby.maxPlayers}
          </div>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left: Players & Colors */}
          <div className="flex-1 flex flex-col gap-4">
            {/* Players list */}
            <div className="glass-panel rounded-xl p-4 flex-1 overflow-auto">
              <h3 className="text-sm font-mono text-void-muted mb-3 uppercase tracking-wider">Players</h3>
              <div className="grid grid-cols-2 gap-2">
                {lobby.players.map(player => (
                  <div
                    key={player.id}
                    className="flex items-center gap-3 bg-void-bg rounded-lg px-3 py-2 border border-void-border"
                  >
                    {/* Bean avatar */}
                    <div className="w-8 h-10 rounded-full relative" style={{ backgroundColor: PLAYER_COLORS[player.color] }}>
                      <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-blue-200 rounded-full opacity-80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {player.name}
                        {player.isHost && <span className="ml-1 text-void-warning text-xs">★</span>}
                      </div>
                      <div className="text-xs text-void-muted capitalize">{player.color}</div>
                    </div>
                    {isHost && player.id !== myId && (
                      <button
                        onClick={() => kickPlayer(player.id)}
                        className="text-void-danger hover:text-red-400 text-xs"
                        title="Kick"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Color selection */}
            <div className="glass-panel rounded-xl p-4">
              <h3 className="text-sm font-mono text-void-muted mb-3 uppercase tracking-wider">Choose Color</h3>
              <div className="flex flex-wrap gap-2">
                {COLOR_NAMES.map(color => {
                  const isUsed = usedColors.has(color) && myPlayer?.color !== color;
                  const isSelected = myPlayer?.color === color;
                  return (
                    <button
                      key={color}
                      onClick={() => !isUsed && selectColor(color)}
                      disabled={isUsed}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        isSelected ? 'border-white scale-125' :
                        isUsed ? 'border-void-border opacity-30 cursor-not-allowed' :
                        'border-transparent hover:border-white/50 hover:scale-110'
                      }`}
                      style={{ backgroundColor: PLAYER_COLORS[color] }}
                      title={color}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Chat & Settings */}
          <div className="w-80 flex flex-col gap-4">
            {/* Host settings */}
            {isHost && (
              <div className="glass-panel rounded-xl p-4">
                <h3 className="text-sm font-mono text-void-muted mb-3 uppercase tracking-wider">Settings</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Impostors:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(n => (
                      <button
                        key={n}
                        onClick={() => setImpostorCount(n)}
                        className={`w-8 h-8 rounded text-sm font-bold ${
                          lobby.impostorCount === n
                            ? 'bg-void-danger text-white'
                            : 'bg-void-bg border border-void-border hover:border-void-accent'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat */}
            <div className="glass-panel rounded-xl p-4 flex-1 flex flex-col min-h-0">
              <h3 className="text-sm font-mono text-void-muted mb-3 uppercase tracking-wider">Chat</h3>
              <div className="flex-1 overflow-auto space-y-1 mb-3">
                {messages.map(msg => (
                  <div key={msg.id} className="text-xs">
                    <span className="font-bold" style={{ color: msg.isSystem ? '#f39c12' : PLAYER_COLORS[msg.playerColor] || msg.playerColor }}>
                      {msg.playerName}:
                    </span>
                    <span className="ml-1 text-void-text/80">{msg.text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  className="flex-1 bg-void-bg border border-void-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-void-accent"
                  placeholder="Type..."
                  maxLength={200}
                />
                <button onClick={sendChat} className="btn-primary text-sm px-3 py-1.5">Send</button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Start button */}
        <div className="mt-4 text-center">
          {countdown !== null ? (
            <div className="text-4xl font-bold font-mono text-void-warning animate-pulse-red">
              Starting in {countdown}...
            </div>
          ) : isHost ? (
            <button
              onClick={startGame}
              disabled={lobby.players.length < GAME.MIN_PLAYERS}
              className={`btn-success py-3 px-12 text-xl font-bold tracking-wider ${
                lobby.players.length < GAME.MIN_PLAYERS ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              START GAME ({lobby.players.length}/{GAME.MIN_PLAYERS} min)
            </button>
          ) : (
            <p className="text-void-muted font-mono">Waiting for host to start...</p>
          )}
        </div>
      </div>
    </div>
  );
}
