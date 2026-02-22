
import type { GameConfig } from '../types';
export async function loadConfig(): Promise<GameConfig> {
  const res = await fetch('/config/game.json');
  if (!res.ok) throw new Error('Failed to load config');
  const cfg = (await res.json()) as GameConfig;
  if (cfg.reelStrips.length !== cfg.reels) throw new Error('Config error: reelStrips length mismatch');
  cfg.reelStrips.forEach((strip, i) => strip.forEach((s) => {
    if (s < 0 || s >= cfg.symbols.length) throw new Error('Config invalid symbol index');
  }));
  return cfg;
}
