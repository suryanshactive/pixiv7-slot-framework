import { events } from '../core/EventBus';
import type { SpinResult } from '../types';

type StateName = 'IDLE' | 'SPINNING' | 'RESULT' | 'WIN_PRESENTATION';

// 🔒 Global, HMR-safe ownership
let ACTIVE_ID = 0;
let NEXT_ID = 1;

/**
 * Free Spins controller (HMR-safe, re-entrant-safe)
 * - Strict singleton via global ACTIVE_ID check
 * - Starts exactly one FS from IDLE
 * - Decrements exactly once when launching that FS
 * - Uses `inFlight` lock to avoid double-starts
 * - Accumulates awards even during FS; ends cleanly at 0
 */
export class FreeSpinsFeature {
  private instanceId = NEXT_ID++;

  private active = false;
  private remaining = 0;
  private isBusy = false;   // true when state != IDLE
  private inFlight = false; // true between SPIN_REQUESTED and next IDLE

  // bind handlers so we can stop them if needed (not strictly required with ACTIVE_ID guard)
  private onStateChanged = ({ state }: { state: StateName }) => {
    if (this.instanceId !== ACTIVE_ID) return;            // ignore stale instance

    this.isBusy = (state !== 'IDLE');

    if (state === 'IDLE') {
      // The previous spin completed (base or FS)
      this.inFlight = false;
      this.maybeStartNext();
    }
  };

  private onAward = ({ count }: { count: number }) => {
    if (this.instanceId !== ACTIVE_ID) return;            // ignore stale instance
    if (count <= 0) return;

    this.remaining += count;
    this.active = true;
    events.emit('HUD_UPDATE', { freeSpinsRemaining: this.remaining });

    // Do NOT start here; we start only from IDLE via STATE_CHANGED to avoid races.
  };

  constructor(private getLastResult: () => SpinResult | null) {
    // Claim ownership
    ACTIVE_ID = this.instanceId;

    // Register listeners
    events.on('STATE_CHANGED', this.onStateChanged);
    events.on('FREE_SPINS_AWARDED', this.onAward);
  }

  /** Start one FS if allowed; decrement exactly once. */
  private maybeStartNext() {
    if (this.instanceId !== ACTIVE_ID) return;            // ignore stale instance
    if (!this.active) return;
    if (this.isBusy) return;       // only start from IDLE
    if (this.inFlight) return;     // already launching one

    if (this.remaining <= 0) {
      // Exit FS mode
      this.active = false;
      events.emit('HUD_UPDATE', { freeSpinsRemaining: 0 });
      return;
    }

    // ✅ Launch exactly one FS
    this.inFlight = true;
    this.remaining--;
    events.emit('HUD_UPDATE', { freeSpinsRemaining: this.remaining });

    // Mark the upcoming spin as free (accounting + award suppression)
    events.emit('FREE_SPIN_SPIN_START', { remainingAfter: this.remaining });

    // Kick the spin; flow: SPIN → RESULT → WIN_PRESENTATION → IDLE (which re-enters here)
    events.emit('SPIN_REQUESTED', undefined);
  }
}