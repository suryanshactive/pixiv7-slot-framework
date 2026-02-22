// src/types.ts

export interface WinLine {
  /** Payline index (if you visualize lines later) */
  lineIndex: number;
  /** Index into config.symbols for the symbol that won */
  symbolIndex: number;
  /** Number of consecutive reels included in the win */
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

  /** Sum of all wins for this spin (line wins + scatters + features, as applicable) */
  totalWin: number;

  /** Player balance AFTER this spin is applied on the server (for demo we keep this local) */
  balanceAfter: number;

  /** If present, indicates a free-spins award on this spin */
  freeSpinsAwarded?: number;

  /** If present, indicates remaining free spins (some backends echo this) */
  freeSpinsRemaining?: number;
}

export interface GameConfig {
  /** Number of reels (3–5 per assignment) */
  reels: number;

  /** Number of visible rows (3 per assignment) */
  rows: number;

  /** Symbol names; indices are used inside reelStrips + results */
  symbols: string[];

  /**
   * Each reel’s strip is an array of symbol indices.
   * Must be config.reels arrays in total.
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
   * This is read by SpinService to annotate the mocked server payload at scheduled spins.
   */
  freeSpinsAwardEvery?: number;
}