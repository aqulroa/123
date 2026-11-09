export type Action = 'throttle' | 'brake' | 'left' | 'right';

const KEYMAP: Record<string, Action> = {
  KeyW: 'throttle',
  ArrowUp: 'throttle',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** Keyboard state plus edge-triggered presses for discrete actions. */
export class Input {
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private keyHandlers = new Map<string, () => void>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (action) {
        if (!this.held.has(action)) this.pressed.add(action);
        this.held.add(action);
        e.preventDefault();
      }
      if (!e.repeat) this.keyHandlers.get(e.code)?.();
    });
    target.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (action) this.held.delete(action);
    });
    target.addEventListener('blur', () => this.held.clear());
  }

  isDown(action: Action): boolean {
    return this.held.has(action);
  }

  /** True once per physical key press. */
  consume(action: Action): boolean {
    const was = this.pressed.has(action);
    this.pressed.delete(action);
    return was;
  }

  onKey(code: string, handler: () => void): void {
    this.keyHandlers.set(code, handler);
  }
}
