import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Function>>();
  private connectionListeners = new Set<(connected: boolean) => void>();

  connect() {
    if (this.socket) return;

    // Always connect through the same origin - Vite proxy handles routing to the server
    const url = window.location.origin;
    console.log('[SOCKET] Connecting to:', url);

    this.socket = io(url, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[SOCKET] Connected:', this.socket?.id);
      this.notifyConnectionListeners(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
      this.notifyConnectionListeners(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[SOCKET] Connection error:', err.message);
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('[SOCKET] Reconnected after', attemptNumber, 'attempts');
      this.notifyConnectionListeners(true);
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
      // If there's a callback, notify it of error
      if (callback) {
        callback({ error: 'Not connected to server. Please wait...' });
      }
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

  onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.add(listener);
    // Immediately notify of current state
    listener(this.connected);
    return () => { this.connectionListeners.delete(listener); };
  }

  private notifyConnectionListeners(connected: boolean) {
    for (const listener of this.connectionListeners) {
      listener(connected);
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
