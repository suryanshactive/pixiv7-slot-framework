// src/core/Config.ts
import type { GameConfig, SpinTuning } from '../types';

export async function loadConfig(): Promise<GameConfig> {
  const res = await fetch('/config/game.json');
  if (!res.ok) throw new Error('Failed to load config');

  const cfg = (await res.json()) as GameConfig;

  // Basic structural checks
  if (!Number.isInteger(cfg.reels) || cfg.reels <= 0) {
    throw new Error('Config error: reels must be a positive integer');
  }
  if (!Number.isInteger(cfg.rows) || cfg.rows <= 0) {
    throw new Error('Config error: rows must be a positive integer');
  }
  if (!Array.isArray(cfg.symbols) || cfg.symbols.length === 0) {
    throw new Error('Config error: symbols must be a non-empty array of strings');
  }
  if (!Array.isArray(cfg.reelStrips) || cfg.reelStrips.length !== cfg.reels) {
    throw new Error('Config error: reelStrips length must equal reels');
  }
  // Validate indices
  cfg.reelStrips.forEach((strip, r) => {
    if (!Array.isArray(strip) || strip.length === 0) {
      throw new Error(`Config error: reelStrips[${r}] must be a non-empty array`);
    }
    strip.forEach((sIdx, i) => {
      if (!Number.isInteger(sIdx) || sIdx < 0 || sIdx >= cfg.symbols.length) {
        throw new Error(`Config error: invalid symbol index at reel ${r}, pos ${i}`);
      }
    });
  });

  // Optional: normalize/validate spin block if present
  if (cfg.spin) {
    const s: SpinTuning = cfg.spin;
    const checkNum = (v: unknown, name: string) => {
      if (v === undefined) return;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw new Error(`Config error: spin.${name} must be a non-negative number`);
      }
    };
    checkNum(s.minSpinMs, 'minSpinMs');
    checkNum(s.decelMs, 'decelMs');
    checkNum(s.startStaggerMs, 'startStaggerMs');
    checkNum(s.stopStaggerMs, 'stopStaggerMs');
    checkNum(s.lapsBeforeStop, 'lapsBeforeStop');
    if (s.direction && s.direction !== 'down' && s.direction !== 'up') {
      throw new Error('Config error: spin.direction must be "down" or "up"');
    }
  }

  return cfg;
}