// src/core/EventBus.ts
import { utils } from 'pixi.js';
import type { SpinResult } from '../types';

export type GameEvents = {
  'SPIN_REQUESTED': void;
  'SPIN_STARTED': void;
  'SPIN_RESULT': SpinResult;
  'STOP_REQUESTED': void;
  'RESULT_READY': void;
  'WIN_PRESENTATION_DONE': void;

  'FREE_SPINS_AWARDED': { count: number };

  // ✅ NEW: fired when the feature actually starts a free spin
  'FREE_SPIN_SPIN_START': { remainingAfter: number };

  'FREE_SPINS_COUNT_CHANGED': { remaining: number };

  // ✅ already in your build: used by HUD/FS to know if IDLE or busy
  'STATE_CHANGED': { state: 'IDLE' | 'SPINNING' | 'RESULT' | 'WIN_PRESENTATION' };

  'HUD_UPDATE': Partial<{ balance: number; bet: number; win: number; freeSpinsRemaining: number }>;
};

export class EventBus<TEvents extends Record<string, any>> {
  private emitter = new utils.EventEmitter();
  on<K extends keyof TEvents>(event: K, fn: (payload: TEvents[K]) => void) { this.emitter.on(event as string, fn as any); }
  once<K extends keyof TEvents>(event: K, fn: (payload: TEvents[K]) => void) { this.emitter.once(event as string, fn as any); }
  off<K extends keyof TEvents>(event: K, fn: (payload: TEvents[K]) => void) { this.emitter.off(event as string, fn as any); }
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]) { this.emitter.emit(event as string, payload); }
}

export const events = new EventBus<GameEvents>();