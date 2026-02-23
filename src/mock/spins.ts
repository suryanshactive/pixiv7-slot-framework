
import type { SpinResult } from '../types';
export const MOCK_RESULTS: SpinResult[] = [
  { reels: [[0,1,2],[1,2,3],[2,3,0],[3,0,1],[0,2,3]], winLines: [], totalWin: 0, balanceAfter: 999 },
  { reels: [[0,4,2],[0,2,3],[0,3,1],[3,1,2],[2,1,3]], winLines: [{ lineIndex: 0, symbolIndex: 0, count: 3, payout: 5 }], totalWin: 5, balanceAfter: 1004 },
  { reels: [[5,1,2],[3,5,3],[2,3,5],[3,0,1],[0,2,3]], winLines: [], totalWin: 0, balanceAfter: 1004, freeSpinsAwarded: 5, freeSpinsRemaining: 5 },
  { reels: [[1,1,1],[3,4,2],[4,0,1],[2,3,4],[0,2,3]], winLines: [{ lineIndex: 0, symbolIndex: 0, count: 3, payout: 10 }], totalWin: 10, balanceAfter: 1004, freeSpinsRemaining: 4 },
  { reels: [[2,2,2],[3,3,3],[4,4,4],[2,3,4],[0,2,3]], winLines: [], totalWin: 0, balanceAfter: 1004, freeSpinsRemaining: 3 }
];
