import { useEffect, useRef } from 'react';
import { useGameStore } from './store/gameStore';
import { socketClient } from './socket/socketClient';
import { SocketEvents, GamePhase, PlayerRole } from '@shared/constants';
import Login from './components/Login';
import Lobby from './components/Lobby';
import RoleReveal from './components/RoleReveal';
import GameView from './components/GameView';
import MeetingRoom from './components/Meeting/MeetingRoom';
import GameOver from './components/GameOver';
import EjectionScreen from './components/EjectionScreen';

export default function App() {
  const phase = useGameStore(s => s.phase);
  const setPhase = useGameStore(s => s.setPhase);
  const setLobby = useGameStore(s => s.setLobby);
  const setRole = useGameStore(s => s.setRole);
  const setMapData = useGameStore(s => s.setMapData);
  const setPlayers = useGameStore(s => s.setPlayers);
  const setBodies = useGameStore(s => s.setBodies);
  const setMyTasks = useGameStore(s => s.setMyTasks);
  const setTaskProgress = useGameStore(s => s.setTaskProgress);
  const setSabotage = useGameStore(s => s.setSabotage);
  const setDoors = useGameStore(s => s.setDoors);
  const setVote = useGameStore(s => s.setVote);
  const setGameOver = useGameStore(s => s.setGameOver);
  const addMessage = useGameStore(s => s.addMessage);
  const setEjection = useGameStore(s => s.setEjection);
  const setLobbyList = useGameStore(s => s.setLobbyList);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    socketClient.connect();

    // Lobby updates
    socketClient.on(SocketEvents.LOBBY_UPDATE, (lobby: any) => {
      setLobby(lobby);
    });

    socketClient.on(SocketEvents.LOBBY_LIST, (lobbies: any) => {
      setLobbyList(lobbies);
    });

    // Role assigned
    socketClient.on(SocketEvents.ROLE_ASSIGNED, (data: { role: PlayerRole; impostors: string[] }) => {
      setRole(data.role, data.impostors);
      setPhase(GamePhase.ROLE_REVEAL);
    });

    // Game start (map data)
    socketClient.on(SocketEvents.GAME_START, (data: { mapData: any }) => {
      setMapData(data.mapData);
    });

    // Game state updates
    socketClient.on(SocketEvents.GAME_STATE, (state: any) => {
      if (state.phase) setPhase(state.phase);
      if (state.players) setPlayers(state.players);
      if (state.bodies) setBodies(state.bodies);
      if (state.myTasks) setMyTasks(state.myTasks);
      if (state.taskProgress !== undefined) setTaskProgress(state.taskProgress, state.totalTasks);
      if (state.sabotage) setSabotage(state.sabotage);
      if (state.doors) setDoors(state.doors);
      if (state.vote) setVote(state.vote);
      else setVote(null);
    });

    // Meeting called
    socketClient.on(SocketEvents.MEETING_CALLED, (data: any) => {
      addMessage({
        id: Date.now().toString(),
        playerId: 'system',
        playerName: 'System',
        playerColor: '#f39c12',
        text: data.reason === 'body' 
          ? `${data.callerName} reported a body!` 
          : `${data.callerName} called an Emergency Meeting!`,
        timestamp: Date.now(),
        isSystem: true,
      });
    });

    // Ejection result
    socketClient.on(SocketEvents.EJECTION_RESULT, (data: any) => {
      setEjection(data);
      setPhase(GamePhase.EJECTION);
    });

    // Chat
    socketClient.on(SocketEvents.CHAT_BROADCAST, (msg: any) => {
      addMessage(msg);
    });

    // Task update
    socketClient.on(SocketEvents.TASK_UPDATE, (data: { progress: number; total: number }) => {
      setTaskProgress(data.progress, data.total);
    });

    // Game over
    socketClient.on(SocketEvents.GAME_OVER, (data: any) => {
      setGameOver(data.winner, data.allRoles);
      setPhase(GamePhase.GAME_OVER);
    });

    // Countdown
    socketClient.on(SocketEvents.COUNTDOWN, (data: { seconds: number }) => {
      // Handled by lobby
    });

    // Errors
    socketClient.on(SocketEvents.ERROR, (data: { message: string }) => {
      console.error('[ERROR]', data.message);
    });

    return () => {
      socketClient.disconnect();
    };
  }, []);

  return (
    <div className="w-full h-full">
      {phase === GamePhase.LOGIN && <Login />}
      {phase === GamePhase.LOBBY && <Lobby />}
      {phase === GamePhase.ROLE_REVEAL && <RoleReveal />}
      {(phase === GamePhase.PLAYING) && <GameView />}
      {(phase === GamePhase.MEETING || phase === GamePhase.VOTING) && <MeetingRoom />}
      {phase === GamePhase.EJECTION && <EjectionScreen />}
      {phase === GamePhase.GAME_OVER && <GameOver />}
    </div>
  );
}
