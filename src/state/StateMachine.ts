import { events } from '../core/EventBus';

export type CoreState = 'IDLE' | 'SPINNING' | 'RESULT' | 'WIN_PRESENTATION';

export class StateMachine {
  private current: CoreState = 'IDLE';
  get state() { return this.current; }

  constructor() {
    events.on('SPIN_REQUESTED',        () => this.transition('SPINNING'));
    events.on('SPIN_RESULT',           () => this.transition('RESULT'));
    events.on('RESULT_READY',          () => this.transition('WIN_PRESENTATION'));
    events.on('WIN_PRESENTATION_DONE', () => this.transition('IDLE'));
  }

  private transition(next: CoreState) {
    if (this.current === next) return;            // ✅ prevent double emits
    this.current = next;
    events.emit('STATE_CHANGED', { state: next }); // HUD/FS rely on this
  }
}