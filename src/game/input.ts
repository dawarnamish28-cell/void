import { GAME } from '@shared/constants';
import { TileType, MapData } from '@shared/types';

// Target: ~5.5 tiles/sec at any FPS
// At 60fps: 5.5/60 = 0.0917 tiles/frame
// PLAYER_SPEED=4, so factor per second = 5.5/4 = 1.375
const TILES_PER_SEC = 5.5;

export class InputManager {
  private keys = new Set<string>();
  private onMoveCallback: ((dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => void) | null = null;
  private animFrame: number | null = null;
  private enabled = true;
  private lastTime = 0;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  start(onMove: (dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => void) {
    this.onMoveCallback = onMove;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.lastTime = performance.now();
    this.loop(performance.now());
  }

  stop() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.keys.clear();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    this.keys.add(e.key.toLowerCase());
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase());
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key);
  }

  private loop(now: number) {
    this.animFrame = requestAnimationFrame((t) => this.loop(t));

    if (!this.enabled || !this.onMoveCallback) {
      this.lastTime = now;
      return;
    }

    // Delta time in seconds (clamped to avoid huge jumps)
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    let dx = 0;
    let dy = 0;
    let dir: 'up' | 'down' | 'left' | 'right' = 'down';

    if (this.keys.has('w') || this.keys.has('arrowup')) { dy = -1; dir = 'up'; }
    if (this.keys.has('s') || this.keys.has('arrowdown')) { dy = 1; dir = 'down'; }
    if (this.keys.has('a') || this.keys.has('arrowleft')) { dx = -1; dir = 'left'; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { dx = 1; dir = 'right'; }

    if (dx !== 0 || dy !== 0) {
      // Normalize diagonal
      if (dx !== 0 && dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;
      }
      // Delta-time based movement: consistent speed regardless of FPS
      const speed = TILES_PER_SEC * dt;
      this.onMoveCallback(dx * speed, dy * speed, dir);
    }
  }
}

// Check if a position is walkable
export function isWalkable(x: number, y: number, mapData: MapData): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || tx >= mapData.width || ty < 0 || ty >= mapData.height) return false;
  const tile = mapData.tiles[ty]?.[tx];
  return tile !== TileType.WALL && tile !== TileType.EMPTY && tile !== undefined;
}
