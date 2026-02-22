// src/services/SpinService.ts
import type { SpinResult, GameConfig } from '../types';
import { MOCK_RESULTS } from '../mock/spins';
import { events } from '../core/EventBus';

/**
 * Deterministic server-like stub:
 * - Cycles through precomputed MOCK_RESULTS (no RNG at request time).
 * - Schedules a free-spins award every N base spins (freeSpinsAwardEvery).
 * - Suppresses awards ONLY during free spins (not for any non-IDLE state).
 */
export class SpinService {
  private static spinIndex = 0;

  private readonly awardEvery: number; // 0 => disabled
  private readonly awardCount: number;

  // Award suppression ON only when inside Free Spins mode
  private suppressAwards = false;

  constructor(cfg: GameConfig | undefined) {
    this.awardEvery = Math.max(0, cfg?.freeSpinsAwardEvery ?? 0);
    this.awardCount = cfg?.freeSpinsCount ?? 0;

    // Turn suppression ON when a free spin is about to begin
    events.on('FREE_SPIN_SPIN_START', () => {
      this.suppressAwards = true;
    });

    // Keep suppression ON while there are free spins remaining,
    // and turn it OFF when we are fully out (remaining === 0).
    events.on('HUD_UPDATE', (p) => {
      if (p.freeSpinsRemaining !== undefined) {
        this.suppressAwards = p.freeSpinsRemaining > 0;
      }
    });
  }

  async requestSpin(): Promise<SpinResult> {
    const base = structuredClone(
      MOCK_RESULTS[SpinService.spinIndex % MOCK_RESULTS.length]
    );

    const absoluteIndex = SpinService.spinIndex + 1; // 1-based for readability
    SpinService.spinIndex++;

    // Schedule awards only on BASE spins (i.e., not suppressed)
    if (!this.suppressAwards && this.awardEvery > 0 && absoluteIndex % this.awardEvery === 0) {
      base.freeSpinsAwarded = this.awardCount;
    } else {
      // Clean any stale fields from the mock
      delete (base as any).freeSpinsAwarded;
      delete (base as any).freeSpinsRemaining;
    }

    return Promise.resolve(base);
  }
}