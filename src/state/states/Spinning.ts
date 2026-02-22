import { events } from '../../core/EventBus';
import type { SpinResult } from '../../types';
import type { ReelEngine } from '../../reels/ReelEngine';

export class SpinningStateController {
  private pendingResult: SpinResult | null = null;

  constructor(private reels: ReelEngine, private getLastResult: () => SpinResult | null) {
    events.on('SPIN_STARTED', () => {
      this.pendingResult = null;
      this.reels.startSpin();
    });

    events.on('SPIN_RESULT', (r) => {
      this.pendingResult = r;
      this.reels.applyResult(r);
    });

    // Slam stop while spinning
    events.on('STOP_REQUESTED', () => {
      this.reels.slamStop();
    });
  }

  update(delta: number) {
    const allStopped = this.reels.update(delta);
    if (allStopped && this.pendingResult) {
      events.emit('RESULT_READY', undefined);
      this.pendingResult = null;
    }
  }
}
