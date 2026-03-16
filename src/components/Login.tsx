import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { socketClient } from '../socket/socketClient';
import { SocketEvents, GamePhase } from '@shared/constants';

export default function Login() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [joinCode, setJoinCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useGameStore(s => s.setAuth);
  const setPhase = useGameStore(s => s.setPhase);
  const setLobby = useGameStore(s => s.setLobby);

  useEffect(() => {
    const unsub = socketClient.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected) {
        setError('');
      }
    });
    return unsub;
  }, []);

  const validate = (): boolean => {
    if (!name.trim() || name.length > 16) {
      setError('Name must be 1-16 characters');
      return false;
    }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 14) {
      setError('You must be 14 or older to play.');
      return false;
    }
    if (!isConnected) {
      setError('Connecting to server... Please wait.');
      return false;
    }
    setError('');
    return true;
  };

  const handleCreate = () => {
    if (!validate()) return;
    setIsLoading(true);
    setAuth(name.trim(), parseInt(age));
    socketClient.emit(SocketEvents.CREATE_LOBBY, { name: name.trim(), age: parseInt(age) }, (res: any) => {
      setIsLoading(false);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.lobby) {
        setLobby(res.lobby);
        setPhase(GamePhase.LOBBY);
      } else {
        setError('Failed to create lobby. Try again.');
      }
    });
  };

  const handleJoin = () => {
    if (!validate()) return;
    if (!joinCode.trim()) {
      setError('Please enter a lobby code');
      return;
    }
    setIsLoading(true);
    setAuth(name.trim(), parseInt(age));
    socketClient.emit(SocketEvents.JOIN_LOBBY, { code: joinCode.trim().toUpperCase(), name: name.trim(), age: parseInt(age) }, (res: any) => {
      setIsLoading(false);
      if (res?.error) {
        setError(res.error);
        return;
      }
      if (res?.lobby) {
        setLobby(res.lobby);
        setPhase(GamePhase.LOBBY);
      } else {
        setError('Failed to join lobby. Try again.');
      }
    });
  };

  return (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, #12121f 0%, #0a0a12 70%)' }}>
      {/* Stars background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() * 3 + 1 + 'px',
              height: Math.random() * 3 + 1 + 'px',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              opacity: Math.random() * 0.7 + 0.1,
              animation: `pulse-red ${Math.random() * 3 + 2}s ease-in-out infinite`,
              animationDelay: Math.random() * 2 + 's',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 glass-panel rounded-2xl p-8 w-full max-w-md animate-float-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold tracking-wider mb-2" style={{ 
            fontFamily: 'Courier Prime, monospace',
            background: 'linear-gradient(135deg, #6c5ce7, #e74c3c)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
          }}>
            VOID
          </h1>
          <p className="text-void-muted text-sm tracking-widest uppercase">Space Deception Game</p>
          {/* Connection status */}
          <div className={`mt-2 text-xs font-mono flex items-center justify-center gap-1.5 ${
            isConnected ? 'text-void-success' : 'text-void-warning'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-void-success' : 'bg-void-warning animate-pulse'}`} />
            {isConnected ? 'Connected to server' : 'Connecting to server...'}
          </div>
        </div>

        {mode === 'menu' ? (
          <div className="space-y-4">
            {/* Name input */}
            <div>
              <label className="block text-sm font-medium text-void-muted mb-1 font-mono">PLAYER NAME</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 16))}
                className="w-full bg-void-bg border border-void-border rounded-lg px-4 py-3 text-void-text focus:outline-none focus:border-void-accent transition-colors font-mono"
                placeholder="Enter your name..."
                maxLength={16}
              />
            </div>

            {/* Age input */}
            <div>
              <label className="block text-sm font-medium text-void-muted mb-1 font-mono">AGE</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-void-bg border border-void-border rounded-lg px-4 py-3 text-void-text focus:outline-none focus:border-void-accent transition-colors font-mono"
                placeholder="14+"
                min={14}
              />
            </div>

            {error && (
              <div className="bg-void-danger/20 border border-void-danger/40 rounded-lg px-4 py-2 text-void-danger text-sm animate-shake">
                {error}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={() => { if (validate()) setMode('create'); }}
                disabled={isLoading}
                className="w-full btn-primary py-3 text-lg font-bold tracking-wider disabled:opacity-50"
              >
                CREATE GAME
              </button>
              <button
                onClick={() => { if (validate()) setMode('join'); }}
                disabled={isLoading}
                className="w-full btn-void py-3 text-lg tracking-wider disabled:opacity-50"
              >
                JOIN GAME
              </button>
            </div>
          </div>
        ) : mode === 'create' ? (
          <div className="space-y-4 animate-fade-in">
            <button onClick={() => { setMode('menu'); setError(''); }} className="text-void-muted hover:text-void-text transition-colors text-sm">
              ← Back
            </button>
            <p className="text-center text-void-muted">Creating lobby as <span className="text-void-accent font-bold">{name}</span></p>
            {error && (
              <div className="bg-void-danger/20 border border-void-danger/40 rounded-lg px-4 py-2 text-void-danger text-sm">
                {error}
              </div>
            )}
            <button 
              onClick={handleCreate} 
              disabled={isLoading || !isConnected}
              className="w-full btn-primary py-3 text-lg font-bold tracking-wider disabled:opacity-50"
            >
              {isLoading ? 'CREATING...' : !isConnected ? 'CONNECTING...' : 'HOST LOBBY'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <button onClick={() => { setMode('menu'); setError(''); }} className="text-void-muted hover:text-void-text transition-colors text-sm">
              ← Back
            </button>
            <div>
              <label className="block text-sm font-medium text-void-muted mb-1 font-mono">LOBBY CODE</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                className="w-full bg-void-bg border border-void-border rounded-lg px-4 py-3 text-void-text text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-void-accent transition-colors font-mono"
                placeholder="------"
                maxLength={6}
              />
            </div>
            {error && (
              <div className="bg-void-danger/20 border border-void-danger/40 rounded-lg px-4 py-2 text-void-danger text-sm">
                {error}
              </div>
            )}
            <button 
              onClick={handleJoin} 
              disabled={isLoading || !isConnected}
              className="w-full btn-success py-3 text-lg font-bold tracking-wider disabled:opacity-50"
            >
              {isLoading ? 'JOINING...' : !isConnected ? 'CONNECTING...' : 'JOIN LOBBY'}
            </button>
          </div>
        )}

        <p className="text-center text-void-muted/50 text-xs mt-6 font-mono">v1.0 • {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
