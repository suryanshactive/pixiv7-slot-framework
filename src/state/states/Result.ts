
import { events } from '../../core/EventBus';
import type { SpinResult } from '../../types';

export class ResultStateController {
  constructor(private getLastResult: () => SpinResult | null) {
    events.on('RESULT_READY', () => {
      const r = this.getLastResult();
      if (!r) return;
      events.emit('HUD_UPDATE', { win: r.totalWin });
      if (r.freeSpinsAwarded) {
        events.emit('FREE_SPINS_AWARDED', { count: r.freeSpinsAwarded });
      }
    });
  }
}
