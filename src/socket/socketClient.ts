import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Function>>();

  connect() {
    if (this.socket?.connected) return;

    // Determine server URL
    let url: string;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      url = 'http://localhost:3001';
    } else if (host.startsWith('3000-')) {
      // Sandbox: replace 3000 with 3001 in the hostname
      url = window.location.protocol + '//' + host.replace('3000-', '3001-');
    } else {
      url = window.location.origin;
    }

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[SOCKET] Connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
    });

    // Re-attach all listeners
    for (const [event, callbacks] of this.listeners) {
      for (const cb of callbacks) {
        this.socket.on(event, cb as any);
      }
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit(event: string, data?: any, callback?: Function) {
    if (!this.socket?.connected) {
      console.warn('[SOCKET] Not connected, cannot emit:', event);
      return;
    }
    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    this.socket?.on(event, callback as any);
  }

  off(event: string, callback?: Function) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
      this.socket?.off(event, callback as any);
    } else {
      this.listeners.delete(event);
      this.socket?.off(event);
    }
  }

  get id(): string | undefined {
    return this.socket?.id;
  }

  get connected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketClient = new SocketClient();
