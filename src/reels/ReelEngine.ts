// src/reels/ReelEngine.ts
import * as PIXI from 'pixi.js';
import type { GameConfig, SpinResult } from '../types';
import { SymbolFactory } from './SymbolFactory';

interface ReelRuntime {
  container: PIXI.Container;
  sprites: PIXI.Sprite[];
  stripIndex: number;        // topmost strip index
  velocity: number;
  targetStops: number[] | null; // 3 target symbols from server for this reel
  stopping: boolean;
}

export class ReelEngine extends PIXI.Container {
  private reels: ReelRuntime[] = [];
  private symbolW = 140;
  private symbolH = 140;
  private gap = 10;
  private factory: SymbolFactory;

  private maskGfx: PIXI.Graphics | null = null;

  constructor(private app: PIXI.Application, private config: GameConfig) {
    super();
    this.factory = new SymbolFactory(app, this.symbolW, this.symbolH);
    this.buildReels();
    this.buildMask(); // ensure only 3 rows are visible
  }

  private buildMask() {
    if (this.maskGfx) {
      this.removeChild(this.maskGfx);
      this.maskGfx.destroy();
      this.maskGfx = null;
    }
    const totalW = this.config.reels * (this.symbolW + this.gap) - this.gap;
    const totalH = this.config.rows * (this.symbolH + this.gap) - this.gap;

    const m = new PIXI.Graphics();
    m.beginFill(0xffffff);
    m.drawRect(0, 0, totalW, totalH);
    m.endFill();
    this.addChild(m);
    this.mask = m;
    this.maskGfx = m;
  }

  private buildReels() {
    const cols = this.config.reels;
    const rows = this.config.rows;
    const buffer = 2; // extra offscreen symbols for recycling

    for (let r = 0; r < cols; r++) {
      const reelC = new PIXI.Container();
      reelC.x = r * (this.symbolW + this.gap);
      reelC.y = 0;
      this.addChild(reelC);

      const sprites: PIXI.Sprite[] = [];
      const totalSprites = rows + buffer; // we draw 3 rows but keep extras for recycling
      for (let i = 0; i < totalSprites; i++) {
        const s = new PIXI.Sprite();
        s.y = i * (this.symbolH + this.gap);
        s.width = this.symbolW;
        s.height = this.symbolH;
        sprites.push(s);
        reelC.addChild(s);
      }

      this.reels.push({
        container: reelC,
        sprites,
        stripIndex: 0,
        velocity: 0,
        targetStops: null,
        stopping: false,
      });

      this.refreshReelTextures(r);
    }
  }

  private refreshReelTextures(reelIndex: number) {
    const reel = this.reels[reelIndex];
    const strip = this.config.reelStrips[reelIndex];
    for (let i = 0; i < reel.sprites.length; i++) {
      const logicalIndex = (reel.stripIndex + i) % strip.length;
      const symbolIndex = strip[logicalIndex];
      const symbolName = this.config.symbols[symbolIndex];
      reel.sprites[i].texture = this.factory.getTextureFor(symbolName);
      reel.sprites[i].tint = 0xffffff;
    }
  }

  layoutCenter(containerWidth: number) {
    const reelsWidth = this.config.reels * (this.symbolW + this.gap) - this.gap;
    this.x = Math.round((containerWidth - reelsWidth) / 2);
    this.y = 100;
  }

  startSpin() {
    for (const reel of this.reels) {
      reel.velocity = 45 + Math.random() * 10; // base speed; delta scales in update
      reel.stopping = false;
      reel.targetStops = null;
    }
  }

  /** Provide server result; engine will decelerate and snap into stop positions. */
  applyResult(result: SpinResult) {
    for (let r = 0; r < this.reels.length; r++) {
      const target = result.reels[r]; // [top, mid, bottom] symbol indices for this reel
      this.reels[r].targetStops = target;
      this.reels[r].stopping = true;
    }
  }

  /** Immediately stop all reels. If result hasn't arrived yet, they will snap upon applyResult. */
  slamStop() {
    for (const reel of this.reels) {
      reel.stopping = true;
      reel.velocity = 0;
    }
  }

  /** Returns true when all reels fully stopped. */
  update(delta: number): boolean {
    const dt = delta / 60;
    const rows = this.config.rows;

    let allStopped = true;

    for (let r = 0; r < this.reels.length; r++) {
      const reel = this.reels[r];
      const strip = this.config.reelStrips[r];

      // Decelerate when we know a stop is coming
      if (reel.stopping && reel.targetStops) {
        reel.velocity = Math.max(0, reel.velocity - 90 * dt);
      }

      if (reel.velocity > 0) allStopped = false;

      // Move sprites by velocity
      const dy = reel.velocity * dt * (this.symbolH + this.gap);
      if (dy !== 0) {
        for (const s of reel.sprites) s.y += dy;

        // recycle offscreen sprites
        for (let i = 0; i < reel.sprites.length; i++) {
          const s = reel.sprites[i];
          if (s.y >= (rows + 1) * (this.symbolH + this.gap)) {
            s.y -= reel.sprites.length * (this.symbolH + this.gap);
            reel.stripIndex = (reel.stripIndex + 1) % strip.length;

            const logicalIndex = (reel.stripIndex + i) % strip.length;
            const symbolIndex = strip[logicalIndex];
            const symbolName = this.config.symbols[symbolIndex];
            s.texture = this.factory.getTextureFor(symbolName);
            s.tint = 0xffffff;
          }
        }
      }

      // Snap when we have a target and reels are no longer moving
      if (reel.stopping && reel.targetStops && reel.velocity === 0) {
        const len = strip.length;
        const target = reel.targetStops;
        let found = -1;

        // Try to find a contiguous 3-symbol slice in the strip matching [top, mid, bottom]
        for (let start = 0; start < len; start++) {
          let ok = true;
          for (let i = 0; i < rows; i++) {
            if (strip[(start + i) % len] !== target[i]) {
              ok = false;
              break;
            }
          }
          if (ok) {
            found = start;
            break;
          }
        }

        if (found >= 0) {
          // Strip-aligned snap
          reel.stripIndex = found;
          for (let i = 0; i < reel.sprites.length; i++) {
            reel.sprites[i].y = i * (this.symbolH + this.gap);
          }
          this.refreshReelTextures(r);
          reel.stopping = false;
          reel.targetStops = null;
        } else {
          // Fallback: force-snap the visible 3 to the target (reusing sprites)
          for (let i = 0; i < rows; i++) {
            const s = reel.sprites[i];
            const symbolIndex = target[i];
            const symbolName = this.config.symbols[symbolIndex];
            s.texture = this.factory.getTextureFor(symbolName);
            s.y = i * (this.symbolH + this.gap);
            s.tint = 0xffffff;
          }
          // position buffer sprites right after
          for (let i = rows; i < reel.sprites.length; i++) {
            const s = reel.sprites[i];
            s.y = i * (this.symbolH + this.gap);
          }
          // mark stopped
          reel.stopping = false;
          reel.targetStops = null;
        }
      }
    }

    return allStopped;
  }

  highlightWin(line: { lineIndex: number; symbolIndex: number; count: number }) {
    const targetSymbolIndex = line.symbolIndex;
    for (let r = 0; r < Math.min(line.count, this.reels.length); r++) {
      const reel = this.reels[r];
      const strip = this.config.reelStrips[r];
      const midSprite = reel.sprites[1]; // middle row
      const symbolAtMid = strip[(reel.stripIndex + 1) % strip.length];
      if (symbolAtMid === targetSymbolIndex) {
        midSprite.tint = 0xffff66;
      }
    }
  }

  clearHighlights() {
    for (const reel of this.reels) {
      for (const s of reel.sprites) s.tint = 0xffffff;
    }
  }

  destroy(options?: PIXI.IDestroyOptions | boolean) {
    super.destroy(options);
    this.factory.destroy();
    if (this.maskGfx) {
      this.maskGfx.destroy();
      this.maskGfx = null;
    }
  }
}