
import { events } from '../../core/EventBus';
import type { SpinResult } from '../../types';
import type { ReelEngine } from '../../reels/ReelEngine';

export class WinPresentationController {
  private time = 0;
  private active = false;

  constructor(private reels: ReelEngine, private getLastResult: () => SpinResult | null) {
    events.on('RESULT_READY', () => {
      const r = this.getLastResult();
      if (!r) return;
      this.time = 0;
      this.active = true;
      this.reels.clearHighlights();
      r.winLines.forEach((wl) => this.reels.highlightWinFromResult(r, wl));
    });
  }

  update(delta: number) {
    if (!this.active) return;
    this.time += delta / 60;
    if (this.time >= 2) {
      this.active = false;
      this.reels.clearHighlights();
      events.emit('WIN_PRESENTATION_DONE', undefined);
    }
  }
}
