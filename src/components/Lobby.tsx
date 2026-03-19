import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { socketClient } from '../socket/socketClient';
import { SocketEvents, PLAYER_COLORS, COLOR_NAMES, GAME, GamePhase } from '@shared/constants';

// Draw an Among Us character on canvas
function drawLobbyCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, name: string, isHost: boolean, scale: number = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const bodyW = 20;
  const bodyH = 28;
  const legH = 8;
  const topY = -bodyH / 2;
  const botY = bodyH / 2;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, botY + legH + 3, bodyW + 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Backpack
  ctx.fillStyle = darken(color, 0.25);
  ctx.beginPath();
  ctx.roundRect(bodyW - 4, topY + 10, 9, 18, 4);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, topY + bodyW, bodyW, Math.PI, 0, false);
  ctx.lineTo(bodyW, botY);
  ctx.lineTo(bodyW, botY + legH);
  ctx.arc(bodyW / 2 + 2, botY + legH, bodyW / 2 - 2, 0, Math.PI, false);
  ctx.lineTo(2, botY);
  ctx.lineTo(-2, botY);
  ctx.arc(-bodyW / 2 - 2, botY + legH, bodyW / 2 - 2, 0, Math.PI, false);
  ctx.lineTo(-bodyW, botY);
  ctx.lineTo(-bodyW, topY + bodyW);
  ctx.closePath();
  ctx.fill();

  // Shading
  const grad = ctx.createLinearGradient(0, topY, 0, botY + legH);
  grad.addColorStop(0, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Visor
  ctx.fillStyle = '#7ec8e3';
  ctx.beginPath();
  ctx.ellipse(3, topY + bodyW - 3, 12, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,240,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(6, topY + bodyW - 6, 5, 3, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Name
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 0, topY - 8);

  // Host crown
  if (isHost) {
    ctx.fillStyle = '#ffd700';
    ctx.font = '12px sans-serif';
    ctx.fillText('♛', 0, topY - 20);
  }

  ctx.restore();
}

function darken(hex: string, amt: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * (1 - amt))},${Math.round(g * (1 - amt))},${Math.round(b * (1 - amt))})`;
}

export default function Lobby() {
  const lobby = useGameStore(s => s.lobby);
  const playerName = useGameStore(s => s.playerName);
  const setPhase = useGameStore(s => s.setPhase);
  const setLobby = useGameStore(s => s.setLobby);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const messages = useGameStore(s => s.messages);
  const addMessage = useGameStore(s => s.addMessage);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const myId = socketClient.id;
  const isHost = lobby?.hostId === myId;
  const myPlayer = lobby?.players.find(p => p.id === myId);
  const usedColors = new Set(lobby?.players.map(p => p.color) || []);

  useEffect(() => {
    const handler = (data: { seconds: number }) => setCountdown(data.seconds);
    socketClient.on(SocketEvents.COUNTDOWN, handler);
    return () => socketClient.off(SocketEvents.COUNTDOWN, handler);
  }, []);

  // Draw lobby scene on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !lobby) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const W = canvas.width = canvas.parentElement?.clientWidth || 600;
      const H = canvas.height = canvas.parentElement?.clientHeight || 400;

      // Background: spaceship interior
      ctx.fillStyle = '#0f1818';
      ctx.fillRect(0, 0, W, H);

      // Floor tiles
      const tileSize = 32;
      for (let y = H * 0.4; y < H; y += tileSize) {
        for (let x = 0; x < W; x += tileSize) {
          const alt = ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0);
          ctx.fillStyle = alt ? '#1a2a2a' : '#162525';
          ctx.fillRect(x, y, tileSize, tileSize);
          ctx.strokeStyle = 'rgba(255,255,255,0.03)';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x, y, tileSize, tileSize);
        }
      }

      // Back wall
      ctx.fillStyle = '#1a2828';
      ctx.fillRect(0, 0, W, H * 0.42);
      ctx.fillStyle = '#223333';
      ctx.fillRect(0, H * 0.38, W, H * 0.04);

      // Wall panels
      for (let i = 0; i < 6; i++) {
        const px = W * 0.05 + i * (W * 0.15);
        ctx.fillStyle = 'rgba(30,50,50,0.4)';
        ctx.fillRect(px, H * 0.05, W * 0.12, H * 0.3);
        ctx.strokeStyle = 'rgba(60,80,80,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, H * 0.05, W * 0.12, H * 0.3);
      }

      // Green crates (decorative)
      const crates = [
        { x: W * 0.1, y: H * 0.35, w: 50, h: 45 },
        { x: W * 0.15, y: H * 0.32, w: 45, h: 40 },
        { x: W * 0.75, y: H * 0.34, w: 50, h: 45 },
        { x: W * 0.82, y: H * 0.33, w: 45, h: 42 },
      ];
      for (const c of crates) {
        ctx.fillStyle = '#2a4a2a';
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = '#3a6a3a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c.x, c.y, c.w, c.h);
        ctx.strokeStyle = '#3a6a3a';
        ctx.beginPath();
        ctx.moveTo(c.x + c.w * 0.3, c.y);
        ctx.lineTo(c.x + c.w * 0.3, c.y + c.h);
        ctx.moveTo(c.x + c.w * 0.7, c.y);
        ctx.lineTo(c.x + c.w * 0.7, c.y + c.h);
        ctx.stroke();
      }

      // Draw players in a circle/cluster
      const players = lobby.players;
      const centerX = W / 2;
      const centerY = H * 0.65;
      const radius = Math.min(W * 0.2, 120);

      for (let i = 0; i < players.length; i++) {
        const angle = (2 * Math.PI * i) / Math.max(players.length, 1) - Math.PI / 2;
        const px = centerX + Math.cos(angle) * radius;
        const py = centerY + Math.sin(angle) * radius * 0.6;
        const color = PLAYER_COLORS[players[i].color] || '#888';
        drawLobbyCharacter(ctx, px, py, color, players[i].name, players[i].isHost, 1.2);
      }

      // Viewport frame (rounded metallic border)
      ctx.strokeStyle = '#2a3a3a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.roundRect(4, 4, W - 8, H - 8, 16);
      ctx.stroke();
      ctx.strokeStyle = '#1a2828';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(8, 8, W - 16, H - 16, 14);
      ctx.stroke();

      // Rivets on frame
      ctx.fillStyle = '#3a4a4a';
      const rivetPositions = [
        [16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16],
        [W / 2, 12], [W / 2, H - 12], [12, H / 2], [W - 12, H / 2],
      ];
      for (const [rx, ry] of rivetPositions) {
        ctx.beginPath();
        ctx.arc(rx, ry, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();
    const interval = setInterval(draw, 100); // Refresh occasionally for smooth look
    return () => clearInterval(interval);
  }, [lobby]);

  const selectColor = (color: string) => socketClient.emit(SocketEvents.SELECT_COLOR, { color });
  const setImpostorCount = (count: number) => socketClient.emit(SocketEvents.SET_IMPOSTOR_COUNT, { count });
  const kickPlayer = (targetId: string) => socketClient.emit(SocketEvents.KICK_PLAYER, { targetId });
  const startGame = () => socketClient.emit(SocketEvents.START_GAME);
  const leaveLobby = () => { socketClient.emit(SocketEvents.LEAVE_LOBBY); setLobby(null); setPhase(GamePhase.LOGIN); };
  const sendChat = () => { if (!chatInput.trim()) return; socketClient.emit(SocketEvents.CHAT_MESSAGE, { text: chatInput.trim() }); setChatInput(''); };

  if (!lobby) return null;

  return (
    <div className="w-full h-full flex flex-col" style={{ background: '#080c0c' }}>
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: Math.random() * 2 + 0.5 + 'px',
            height: Math.random() * 2 + 0.5 + 'px',
            left: Math.random() * 100 + '%',
            top: Math.random() * 100 + '%',
            opacity: Math.random() * 0.4 + 0.05,
            animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
          }} />
        ))}
      </div>

      <div className="relative z-10 flex-1 flex min-h-0">
        {/* Left: Settings overlay */}
        <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/10 text-[11px] text-gray-400 font-mono space-y-0.5 max-w-[200px]">
          <div>Impostors: <span className="text-white">{lobby.impostorCount}</span></div>
          <div>Discussion Time: <span className="text-white">{GAME.MEETING_DISCUSS_SECS}s</span></div>
          <div>Voting Time: <span className="text-white">{GAME.MEETING_VOTE_SECS}s</span></div>
          <div>Player Speed: <span className="text-white">{GAME.PLAYER_SPEED}x</span></div>
          <div>Kill Cooldown: <span className="text-white">{GAME.KILL_COOLDOWN_MS / 1000}s</span></div>
          <div>Crew Light: <span className="text-white">1x</span></div>
          <div>Impostor Light: <span className="text-white">1.5x</span></div>
          <div>Kill Distance: <span className="text-white">Normal</span></div>
          {isHost && (
            <div className="pt-2 border-t border-white/10 mt-2">
              <div className="text-gray-500 mb-1">Set Impostors:</div>
              <div className="flex gap-1">
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setImpostorCount(n)}
                    className={`w-6 h-6 rounded text-[10px] font-bold ${lobby.impostorCount === n ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>{n}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top-right: Info + buttons */}
        <div className="absolute top-4 right-4 z-20 flex items-start gap-3">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
            <div className="text-[10px] text-gray-400 font-mono">
              Code: <span className="text-cyan-300 font-bold tracking-[0.2em]">{lobby.code}</span>
            </div>
          </div>
          <button onClick={leaveLobby} className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10 text-gray-400 hover:text-white text-xs font-mono">
            ← Leave
          </button>
        </div>

        {/* Canvas scene (fills most of the screen) */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>

        {/* Right sidebar: Color picker + Chat */}
        <div className="w-64 flex-shrink-0 flex flex-col bg-black/40 backdrop-blur-sm border-l border-white/10">
          {/* Color picker */}
          <div className="p-3 border-b border-white/10">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2">Choose Color</div>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_NAMES.map(color => {
                const isUsed = usedColors.has(color) && myPlayer?.color !== color;
                const isSelected = myPlayer?.color === color;
                return (
                  <button key={color} onClick={() => !isUsed && selectColor(color)} disabled={isUsed}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${isSelected ? 'border-white scale-125 ring-2 ring-white/30' : isUsed ? 'border-gray-700 opacity-20 cursor-not-allowed' : 'border-transparent hover:border-white/40 hover:scale-110'}`}
                    style={{ backgroundColor: PLAYER_COLORS[color] }} title={color} />
                );
              })}
            </div>
          </div>

          {/* Players list */}
          <div className="p-3 border-b border-white/10 max-h-40 overflow-y-auto">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2">Players ({lobby.players.length}/{lobby.maxPlayers})</div>
            {lobby.players.map(p => (
              <div key={p.id} className="flex items-center gap-2 py-0.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLAYER_COLORS[p.color] }} />
                <span className="text-xs text-gray-300 flex-1 truncate">{p.name}</span>
                {p.isHost && <span className="text-yellow-400 text-[9px]">♛</span>}
                {isHost && p.id !== myId && (
                  <button onClick={() => kickPlayer(p.id)} className="text-red-500 hover:text-red-400 text-[10px]">✕</button>
                )}
              </div>
            ))}
          </div>

          {/* Chat */}
          <div className="flex-1 flex flex-col p-3 min-h-0">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider mb-2">Chat</div>
            <div className="flex-1 overflow-y-auto space-y-0.5 mb-2">
              {messages.map(msg => (
                <div key={msg.id} className="text-[10px]">
                  <span className="font-bold" style={{ color: msg.isSystem ? '#f39c12' : PLAYER_COLORS[msg.playerColor] || '#888' }}>{msg.playerName}:</span>
                  <span className="ml-1 text-gray-400">{msg.text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[11px] text-gray-200 focus:outline-none focus:border-cyan-600" placeholder="Type..." maxLength={200} />
              <button onClick={sendChat} className="bg-cyan-800 hover:bg-cyan-700 text-white text-[10px] px-2 py-1 rounded font-bold">→</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: START button area */}
      <div className="relative z-10 h-20 flex items-center justify-center bg-black/40 border-t border-white/10">
        {countdown !== null ? (
          <div className="text-5xl font-bold font-mono text-red-400 animate-pulse" style={{ fontFamily: 'Courier Prime, monospace' }}>
            {countdown}
          </div>
        ) : isHost ? (
          <button onClick={startGame} disabled={lobby.players.length < GAME.MIN_PLAYERS}
            className={`relative group ${lobby.players.length < GAME.MIN_PLAYERS ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <div className="text-4xl font-bold tracking-[0.15em] text-white" style={{ fontFamily: 'Courier Prime, monospace', textShadow: '2px 2px 0 #1a1a1a, 4px 4px 0 #0a0a0a' }}>
              START
            </div>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="text-gray-400 text-xs font-mono">👥 {lobby.players.length}/{lobby.maxPlayers}</span>
              {lobby.players.length < GAME.MIN_PLAYERS && (
                <span className="text-yellow-500 text-[10px] font-mono">(need {GAME.MIN_PLAYERS})</span>
              )}
            </div>
          </button>
        ) : (
          <div className="text-center">
            <div className="text-2xl text-gray-500 font-mono tracking-wider">Waiting for host...</div>
            <div className="text-gray-600 text-xs font-mono mt-1">👥 {lobby.players.length}/{lobby.maxPlayers}</div>
          </div>
        )}
      </div>
    </div>
  );
}
