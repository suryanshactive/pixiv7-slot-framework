// src/types.ts

export interface WinLine {
  /** Payline index (if you visualize lines later) */
  lineIndex: number;
  /** Index into config.symbols for the symbol that won */
  symbolIndex: number;
  count: number;
  /** Payout amount for this line (already evaluated by server logic in real implementations) */
  payout: number;
}

export interface SpinResult {
  /**
   * Reels stop layout as symbol indices into config.symbols.
   * Shape: [reelIndex][rowIndex] => symbolIndex
   * Example for a 5×3: 5 arrays, each with 3 numbers.
   */
  reels: number[][];
  winLines: WinLine[];

  /** Sum of all wins for this spin */
  totalWin: number;

  /** Player balance AFTER this spin (in a real game: server-derived) */
  balanceAfter: number;

  /** If present, indicates a free-spins award on this spin */
  freeSpinsAwarded?: number;

  /** Some backends echo remaining free spins; we don’t rely on it */
  freeSpinsRemaining?: number;
}

/**
 * Optional spin-tuning. All fields are optional; defaults are applied in code.
 * direction is currently “down” in the engine, but kept here for future use.
 */
export interface SpinTuning {
  /** Minimum time before the first reel is allowed to begin deceleration (ms) */
  minSpinMs?: number;

  /** Time for a single reel to decelerate from base speed to stop (ms) */
  decelMs?: number;

  /** Delay between starting reel r and r+1 (ms) */
  startStaggerMs?: number;

  /** Delay between stopping reel r and r+1 (ms) */
  stopStaggerMs?: number;

  /** Optional extra full-strip rotations after the result arrives (feel) */
  lapsBeforeStop?: number;

  /** Future toggle if you want to support “up” in addition to “down” */
  direction?: 'down' | 'up';
}

export interface GameConfig {
  reels: number;
  rows: number;

  /** Symbol names; indices are used in reelStrips & results */
  symbols: string[];

  /**
   * Each reel’s strip is an array of symbol indices.
   * Must contain exactly `reels` arrays.
   */
  reelStrips: number[][];

  /** Number of free spins to award when triggered */
  freeSpinsCount: number;

  /** Bet options displayed in HUD */
  betOptions: number[];

  /** Default bet */
  defaultBet: number;

  /**
   * OPTIONAL: Award free spins every N base spins (1-based scheduling).
   *  - If undefined or 0 → disabled (no scheduled awards).
   *  - If 25 → awards on 25th, 50th, 75th... base spin.
   * Used by SpinService to annotate mocked payloads.
   */
  freeSpinsAwardEvery?: number;

  /**
   * OPTIONAL: Spin timing/behavior tuning (all fields optional).
   * Defaults are applied in ReelEngine if omitted.
   */
  spin?: SpinTuning;
}