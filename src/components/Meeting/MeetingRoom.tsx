import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { socketClient } from '../../socket/socketClient';
import { SocketEvents, PLAYER_COLORS, GamePhase } from '@shared/constants';

export default function MeetingRoom() {
  const players = useGameStore(s => s.players);
  const vote = useGameStore(s => s.vote);
  const messages = useGameStore(s => s.messages);
  const addMessage = useGameStore(s => s.addMessage);
  const phase = useGameStore(s => s.phase);
  const [chatInput, setChatInput] = useState('');
  const [myVote, setMyVote] = useState<string | null>(null);

  const myId = socketClient.id || '';
  const me = players.find(p => p.id === myId);
  const isAlive = me?.isAlive ?? false;
  const isVoting = phase === GamePhase.VOTING;
  const isDiscussion = phase === GamePhase.MEETING;

  const handleVote = (targetId: string | 'skip') => {
    if (!isAlive || myVote) return;
    setMyVote(targetId);
    socketClient.emit(SocketEvents.CAST_VOTE, { targetId });
  };

  const sendChat = () => {
    if (!chatInput.trim() || !isAlive) return;
    socketClient.emit(SocketEvents.CHAT_MESSAGE, { text: chatInput.trim() });
    setChatInput('');
  };

  const votedPlayers = new Set(Object.keys(vote?.votes || {}));

  return (
    <div className="w-full h-full flex flex-col" style={{ background: 'radial-gradient(ellipse at center, #1a1020 0%, #0a0a12 70%)' }}>
      {/* Header */}
      <div className="text-center py-4 border-b border-void-border">
        <h1 className="text-2xl font-bold font-mono text-void-accent">
          {isDiscussion ? '💬 DISCUSSION' : isVoting ? '🗳️ VOTING TIME' : '📢 MEETING'}
        </h1>
        {vote && (
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="text-sm text-void-muted">
              Called by: <span className="text-void-accent">{vote.callerName}</span>
            </span>
            {vote.reason === 'body' && vote.bodyColor && (
              <span className="text-sm text-void-danger">
                Body found: <span style={{ color: PLAYER_COLORS[vote.bodyColor] }}>{vote.bodyColor}</span>
              </span>
            )}
            <span className={`text-lg font-bold font-mono ${
              (vote.timeLeft || 0) <= 5 ? 'text-void-danger animate-pulse-red' : 'text-void-warning'
            }`}>
              ⏱ {vote.timeLeft}s
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Player tiles */}
        <div className="flex-1 p-4 overflow-auto">
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {players.map(player => {
              const hasVoted = votedPlayers.has(player.id);
              const isVotedByMe = myVote === player.id;

              return (
                <button
                  key={player.id}
                  onClick={() => isVoting && player.isAlive && player.id !== myId && handleVote(player.id)}
                  disabled={!isVoting || !isAlive || !player.isAlive || !!myVote || player.id === myId}
                  className={`glass-panel rounded-xl p-3 text-center transition-all ${
                    !player.isAlive ? 'opacity-30' :
                    isVotedByMe ? 'ring-2 ring-void-danger neon-glow-red' :
                    isVoting && !myVote && player.id !== myId ? 'hover:border-void-accent hover:scale-105 cursor-pointer' :
                    ''
                  }`}
                >
                  {/* Bean avatar */}
                  <div className="w-12 h-14 mx-auto mb-2 rounded-full relative" style={{ backgroundColor: PLAYER_COLORS[player.color] }}>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-blue-200 rounded-full opacity-80" />
                    {!player.isAlive && (
                      <div className="absolute inset-0 flex items-center justify-center text-2xl">💀</div>
                    )}
                  </div>
                  <div className="text-sm font-medium truncate">{player.name}</div>
                  <div className="text-xs text-void-muted capitalize">{player.color}</div>
                  
                  {/* Vote indicator */}
                  {hasVoted && (
                    <div className="mt-1 text-xs text-void-success font-mono">✓ voted</div>
                  )}
                  {isVotedByMe && (
                    <div className="mt-1 text-xs text-void-danger font-bold">YOUR VOTE</div>
                  )}
                </button>
              );
            })}

            {/* Skip vote button */}
            {isVoting && isAlive && !myVote && (
              <button
                onClick={() => handleVote('skip')}
                className="glass-panel rounded-xl p-3 text-center hover:border-void-accent hover:scale-105 transition-all"
              >
                <div className="w-12 h-14 mx-auto mb-2 rounded-full bg-void-bg border-2 border-void-border flex items-center justify-center text-2xl">
                  ⏭️
                </div>
                <div className="text-sm font-medium">Skip Vote</div>
              </button>
            )}
            {myVote === 'skip' && (
              <div className="glass-panel rounded-xl p-3 text-center ring-2 ring-void-warning">
                <div className="w-12 h-14 mx-auto mb-2 rounded-full bg-void-bg border-2 border-void-warning flex items-center justify-center text-2xl">
                  ⏭️
                </div>
                <div className="text-sm font-medium">Skip Vote</div>
                <div className="mt-1 text-xs text-void-warning font-bold">YOUR VOTE</div>
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="w-80 border-l border-void-border flex flex-col p-3">
          <h3 className="text-xs font-mono text-void-muted uppercase tracking-wider mb-2">💬 Chat</h3>
          <div className="flex-1 overflow-auto space-y-1 mb-2">
            {messages.map(msg => (
              <div key={msg.id} className="text-xs">
                <span className="font-bold" style={{ color: msg.isSystem ? '#f39c12' : PLAYER_COLORS[msg.playerColor] || msg.playerColor }}>
                  {msg.playerName}:
                </span>
                <span className="ml-1 text-void-text/80">{msg.text}</span>
              </div>
            ))}
          </div>
          {isAlive && (
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                className="flex-1 bg-void-bg border border-void-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-void-accent"
                placeholder="Type..."
                maxLength={200}
              />
              <button onClick={sendChat} className="btn-primary text-xs px-2 py-1.5">Send</button>
            </div>
          )}
          {!isAlive && (
            <p className="text-center text-void-muted text-xs font-mono">👻 Ghosts cannot chat</p>
          )}
        </div>
      </div>
    </div>
  );
}
