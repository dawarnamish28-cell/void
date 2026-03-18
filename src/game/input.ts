import { GAME } from '@shared/constants';
import { TileType, MapData } from '@shared/types';

const TILE = GAME.TILE_SIZE;

export class InputManager {
  private keys = new Set<string>();
  private onMoveCallback: ((dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => void) | null = null;
  private animFrame: number | null = null;
  private enabled = true;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  start(onMove: (dx: number, dy: number, dir: 'up' | 'down' | 'left' | 'right') => void) {
    this.onMoveCallback = onMove;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.loop();
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
    // Don't capture when typing in input
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    this.keys.add(e.key.toLowerCase());
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase());
  }

  isKeyDown(key: string): boolean {
    return this.keys.has(key);
  }

  private loop() {
    this.animFrame = requestAnimationFrame(() => this.loop());

    if (!this.enabled || !this.onMoveCallback) return;

    let dx = 0;
    let dy = 0;
    let dir: 'up' | 'down' | 'left' | 'right' = 'down';

    if (this.keys.has('w') || this.keys.has('arrowup')) { dy = -1; dir = 'up'; }
    if (this.keys.has('s') || this.keys.has('arrowdown')) { dy = 1; dir = 'down'; }
    if (this.keys.has('a') || this.keys.has('arrowleft')) { dx = -1; dir = 'left'; }
    if (this.keys.has('d') || this.keys.has('arrowright')) { dx = 1; dir = 'right'; }

    if (dx !== 0 || dy !== 0) {
      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;
      }
      this.onMoveCallback(dx * GAME.PLAYER_SPEED * 0.15, dy * GAME.PLAYER_SPEED * 0.15, dir);
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
