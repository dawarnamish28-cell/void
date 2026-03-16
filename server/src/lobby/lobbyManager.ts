import { v4 as uuid } from 'uuid';
import { Lobby, LobbyPlayer } from '../../../shared/types.ts';
import { COLOR_NAMES, GAME, GamePhase } from '../../../shared/constants.ts';

export class LobbyManager {
  private lobbies = new Map<string, Lobby>();

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private getAvailableColor(lobby: Lobby): string {
    const usedColors = new Set(lobby.players.map(p => p.color));
    for (const color of COLOR_NAMES) {
      if (!usedColors.has(color)) return color;
    }
    return COLOR_NAMES[0];
  }

  createLobby(hostId: string, hostName: string): Lobby {
    let code = this.generateCode();
    while (this.lobbies.has(code)) {
      code = this.generateCode();
    }

    const lobby: Lobby = {
      code,
      hostId,
      players: [{
        id: hostId,
        name: hostName,
        color: COLOR_NAMES[0],
        isHost: true,
        isReady: false,
      }],
      maxPlayers: GAME.MAX_PLAYERS,
      impostorCount: 1,
      isPublic: true,
      gamePhase: GamePhase.LOBBY,
    };

    this.lobbies.set(code, lobby);
    return lobby;
  }

  joinLobby(code: string, playerId: string, playerName: string): Lobby | { error: string } {
    const lobby = this.lobbies.get(code.toUpperCase());
    if (!lobby) return { error: 'Lobby not found' };
    if (lobby.gamePhase !== GamePhase.LOBBY) return { error: 'Game already in progress' };
    if (lobby.players.length >= lobby.maxPlayers) return { error: 'Lobby is full' };
    if (lobby.players.find(p => p.id === playerId)) return { error: 'Already in lobby' };

    const color = this.getAvailableColor(lobby);
    lobby.players.push({
      id: playerId,
      name: playerName,
      color,
      isHost: false,
      isReady: false,
    });

    return lobby;
  }

  leaveLobby(code: string, playerId: string): Lobby | null {
    const lobby = this.lobbies.get(code);
    if (!lobby) return null;

    lobby.players = lobby.players.filter(p => p.id !== playerId);

    if (lobby.players.length === 0) {
      this.lobbies.delete(code);
      return null;
    }

    // Transfer host
    if (lobby.hostId === playerId) {
      lobby.hostId = lobby.players[0].id;
      lobby.players[0].isHost = true;
    }

    return lobby;
  }

  selectColor(code: string, playerId: string, color: string): Lobby | null {
    const lobby = this.lobbies.get(code);
    if (!lobby) return null;
    if (!COLOR_NAMES.includes(color)) return null;

    const isColorTaken = lobby.players.some(p => p.color === color && p.id !== playerId);
    if (isColorTaken) return null;

    const player = lobby.players.find(p => p.id === playerId);
    if (player) {
      player.color = color;
    }

    return lobby;
  }

  setImpostorCount(code: string, hostId: string, count: number): Lobby | null {
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.hostId !== hostId) return null;
    if (count < 1 || count > 3) return null;
    lobby.impostorCount = count;
    return lobby;
  }

  kickPlayer(code: string, hostId: string, targetId: string): Lobby | null {
    const lobby = this.lobbies.get(code);
    if (!lobby || lobby.hostId !== hostId) return null;
    if (targetId === hostId) return null;

    lobby.players = lobby.players.filter(p => p.id !== targetId);
    return lobby;
  }

  getLobby(code: string): Lobby | null {
    return this.lobbies.get(code) || null;
  }

  getPublicLobbies(): Lobby[] {
    const lobbies: Lobby[] = [];
    for (const lobby of this.lobbies.values()) {
      if (lobby.isPublic && lobby.gamePhase === GamePhase.LOBBY) {
        lobbies.push(lobby);
      }
    }
    return lobbies;
  }
}
