// src/reels/ReelEngine.ts
import * as PIXI from 'pixi.js';
import type { GameConfig, SpinResult } from '../types';
import { SymbolFactory } from './SymbolFactory';

interface ReelRuntime {
  container: PIXI.Container;
  sprites: PIXI.Sprite[];
  stripIndex: number;            // topmost logical index into strip (what y=0 shows)
  started: boolean;              // spin-up done for this reel
  snapped: boolean;              // final landed (stop plan finished)
  baseVelocity: number;          // velocity at start
  velocity: number;              // current velocity
  targetStops: number[] | null;  // server window [top, mid, bottom]
  targetStartIndex: number;      // index in strip where [top,mid,bottom] starts (-1 if not found)
  stopping: boolean;             // true during deceleration phase
  decelStartAtMs: number;        // time when decel started
  startGateMs: number;           // time gate for sequential spin-up (r * startStaggerMs)

  // step-based stop plan (how many strip steps until target slice hits the mask)
  stopStepsTotal: number;        // planned total steps to go
  stopStepsRemaining: number;    // steps left; decremented on each strip wrap (top moves down by 1)
}

export class ReelEngine extends PIXI.Container {
  private reels: ReelRuntime[] = [];
  // --- highlight state ---
  private _winning = new Set<PIXI.Sprite>();
  private _glows = new Map<PIXI.Sprite, PIXI.Graphics>();
  private _pulseCb: ((delta: number) => void) | null = null;
  // geometry
  private symbolW = 140;
  private symbolH = 140;
  private gap = 10;
  private factory: SymbolFactory;
  private maskGfx: PIXI.Graphics | null = null;

  // timing knobs
  private spinMinMs = 2000;       // earliest the FIRST reel may decelerate
  private spinDecelMs = 600;      // deceleration shaping window
  private startStaggerMs = 100;   // start r → r+1
  private stopStaggerMs = 150;    // stop r → r+1
  private lapsBeforeStop = 1;     // extra full strip rotations before landing (feel)

  // runtime
  private elapsedMs = 0;          // global spin timer
  private slamRequested = false;  // user pressed STOP
  private stopCursor = 0;         // the next reel index allowed to enter stopping
  private nextStopUnlockAtMs = 0; // time gate for sequential stop

  // direction is DOWN (positive y)
  private readonly unit = (this.symbolH + this.gap);

  constructor(private app: PIXI.Application, private config: GameConfig) {
    super();

    // read optional spin tuning
    const s = config.spin ?? {};
    this.spinMinMs      = s.minSpinMs      ?? this.spinMinMs;
    this.spinDecelMs    = s.decelMs        ?? this.spinDecelMs;
    this.startStaggerMs = (s as any).startStaggerMs ?? this.startStaggerMs;
    this.stopStaggerMs  = (s as any).stopStaggerMs  ?? this.stopStaggerMs;
    this.lapsBeforeStop = (s as any).lapsBeforeStop ?? this.lapsBeforeStop;

    this.factory = new SymbolFactory(app, this.symbolW, this.symbolH);
    this.buildReels();
    this.buildMask();
  }

  // ---------------------------------------------------------
  // Mask so we see exactly rows × reels (5 × 3 visual window)
  // ---------------------------------------------------------
  private buildMask() {
    if (this.maskGfx) {
      this.removeChild(this.maskGfx);
      this.maskGfx.destroy();
      this.maskGfx = null;
    }
    const totalW = this.config.reels * (this.symbolW + this.gap) - this.gap;
    const totalH = this.config.rows  * (this.symbolH + this.gap) - this.gap;

    const m = new PIXI.Graphics();
    m.beginFill(0xffffff);
    m.drawRect(0, 0, totalW, totalH);
    m.endFill();
    this.addChild(m);
    this.mask = m;
    this.maskGfx = m;
  }

  // ---------------------------------------------------------
  // Build sprite pools (rows + buffer) per reel; textures recycled
  // ---------------------------------------------------------
  private buildReels() {
    const cols = this.config.reels;
    const rows = this.config.rows;
    const buffer = 2;

    for (let r = 0; r < cols; r++) {
      const reelC = new PIXI.Container();
      reelC.x = r * (this.symbolW + this.gap);
      this.addChild(reelC);

      const sprites: PIXI.Sprite[] = [];
      const totalSprites = rows + buffer;
      for (let i = 0; i < totalSprites; i++) {
        const s = new PIXI.Sprite();
        s.y = i * this.unit; // 0,1,2,... top → bottom
        s.width = this.symbolW;
        s.height = this.symbolH;
        sprites.push(s);
        reelC.addChild(s);
      }

      this.reels.push({
        container: reelC,
        sprites,
        stripIndex: 0,
        started: false,
        snapped: false,
        baseVelocity: 0,
        velocity: 0,
        targetStops: null,
        targetStartIndex: -1,
        stopping: false,
        decelStartAtMs: 0,
        startGateMs: 0,

        stopStepsTotal: 0,
        stopStepsRemaining: 0,
      });

      this.refreshReelTextures(r);
    }
  }

  private refreshReelTextures(reelIndex: number) {
    const reel = this.reels[reelIndex];
    const strip = this.config.reelStrips[reelIndex];
    for (let i = 0; i < reel.sprites.length; i++) {
      const logicalIndex = (reel.stripIndex + i) % strip.length;
      const si = strip[logicalIndex];
      const name = this.config.symbols[si];
      reel.sprites[i].texture = this.factory.getTextureFor(name);
      reel.sprites[i].tint = 0xffffff;
    }
  }

  // ---------------------------------------------------------
  // Layout helper
  // ---------------------------------------------------------
  layoutCenter(containerWidth: number) {
    const reelsWidth = this.config.reels * (this.symbolW + this.gap) - this.gap;
    this.x = Math.round((containerWidth - reelsWidth) / 2);
    this.y = 100;
  }

  // ---------------------------------------------------------
  // Spin control
  // ---------------------------------------------------------
  startSpin() {
    this.elapsedMs = 0;
    this.slamRequested = false;
    this.stopCursor = 0;
    this.nextStopUnlockAtMs = 0;

    for (let r = 0; r < this.reels.length; r++) {
      const reel = this.reels[r];
      reel.started = false;
      reel.snapped = false;
      reel.stopping = false;
      reel.targetStops = null;
      reel.targetStartIndex = -1;
      reel.baseVelocity = 45 + Math.random() * 10; // tune as needed
      reel.velocity = 0; // until spin-up gate opens
      reel.decelStartAtMs = 0;
      reel.startGateMs = r * this.startStaggerMs; // sequential spin-up

      reel.stopStepsTotal = 0;
      reel.stopStepsRemaining = 0;
    }
  }

  /** Called when server result arrives */
  applyResult(result: SpinResult) {
    for (let r = 0; r < this.reels.length; r++) {
      const target = result.reels[r]; // [top, mid, bottom]
      const strip = this.config.reelStrips[r];
      this.reels[r].targetStops = target;
      this.reels[r].targetStartIndex = this.findSlice(strip, target, this.config.rows);
      // NOTE: the step plan is computed when the reel actually starts stopping
    }
  }

  /** SLAM stop: direct grid reveal is allowed here (no spinning alignment needed). */
  slamStop() {
    this.slamRequested = true;

    // Ensure any reel not started yet starts right away
    for (const reel of this.reels) {
      if (!reel.started) {
        reel.started = true;
        reel.velocity = reel.baseVelocity;
      }
    }

    // Allow the current stopCursor reel to decel immediately
    this.nextStopUnlockAtMs = this.elapsedMs;
  }

  /** Ticker update — returns true when all reels have snapped (landed). */
  update(delta: number): boolean {
    const dtSec = delta / 60;
    const dtMs = dtSec * 1000;
    this.elapsedMs += dtMs;

    const rows = this.config.rows;
    let allSnapped = true;

    for (let r = 0; r < this.reels.length; r++) {
      const reel = this.reels[r];
      const strip = this.config.reelStrips[r];

      // 1) Spin-up per reel (sequential start)
      if (!reel.started && this.elapsedMs >= reel.startGateMs) {
        reel.started = true;
        reel.velocity = reel.baseVelocity;
      }

      // 2) Decide if this reel can ENTER stopping (sequential stop)
      const canThisReelTryToStop =
        reel.started &&
        !reel.snapped &&
        r === this.stopCursor &&
        reel.targetStops !== null &&
        (
          this.slamRequested || (this.elapsedMs >= Math.max(this.spinMinMs, this.nextStopUnlockAtMs))
        );

      if (canThisReelTryToStop && !reel.stopping) {
        reel.stopping = true;
        reel.decelStartAtMs = this.elapsedMs;

        if (this.slamRequested) {
          // On slam, reveal immediately
          this.forceSnapNow(r);
          // Advance gating below (in snapped section)
        } else {
          // Build step-based stop plan NOW from the current top index
          const targetIdx = reel.targetStartIndex; // set in applyResult
          if (targetIdx >= 0) {
            const len = strip.length;
            const currentTop = reel.stripIndex;
            const stepsToTarget = (targetIdx - currentTop + len) % len;
            reel.stopStepsTotal = stepsToTarget + Math.max(0, this.lapsBeforeStop) * len;
            reel.stopStepsRemaining = reel.stopStepsTotal;
          } else {
            // target slice not found: do at least one lap then forced snap
            const len = strip.length;
            reel.stopStepsTotal = Math.max(len, rows);
            reel.stopStepsRemaining = reel.stopStepsTotal;
          }
        }
      }

      // 3) Motion (always DOWN)
      const dy = reel.velocity * dtSec * this.unit;
      let wrappedCount = 0; // how many strip steps we advanced this frame

      if (dy !== 0) {
        for (const s of reel.sprites) s.y += dy;

        // Recycle beyond BOTTOM, increment top stripIndex & count steps
        const bottomLimit = (rows + 1) * this.unit;
        for (let i = 0; i < reel.sprites.length; i++) {
          const s = reel.sprites[i];
          if (s.y >= bottomLimit) {
            s.y -= reel.sprites.length * this.unit;

            // one row scrolled down → top logical index advances by 1
            reel.stripIndex = (reel.stripIndex + 1) % strip.length;
            wrappedCount++;

            const logicalIndex = (reel.stripIndex + i) % strip.length;
            const si = strip[logicalIndex];
            const name = this.config.symbols[si];
            s.texture = this.factory.getTextureFor(name);
            s.tint = 0xffffff;
          }
        }
      }

      // 4) Step-based stop plan reduction and deceleration shaping
      if (reel.stopping && !this.slamRequested) {
        if (wrappedCount > 0 && reel.stopStepsRemaining > 0) {
          reel.stopStepsRemaining = Math.max(0, reel.stopStepsRemaining - wrappedCount);
        }

        // Decelerate by progress through the plan (never reach 0 until we land)
        if (reel.stopStepsTotal > 0) {
          const progress = 1 - (reel.stopStepsRemaining / reel.stopStepsTotal);
          // Ease-out (cubic) feel
          const ease = 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3);
          const crawl = 8; // minimal visible motion
          const v = reel.baseVelocity * (1 - ease);
          reel.velocity = Math.max(crawl, v);
        }

        // Land exactly when steps are exhausted
        if (reel.stopStepsRemaining === 0) {
          this.snapToCurrentIndex(r);
        }
      }

      // 5) If this reel has snapped, advance sequential stop gating
      if (reel.snapped) {
        if (this.stopCursor === r) {
          this.stopCursor = Math.min(this.stopCursor + 1, this.reels.length);
          this.nextStopUnlockAtMs = this.elapsedMs + this.stopStaggerMs;
        }
      } else {
        allSnapped = false;
      }
    }

    return allSnapped;
  }

  // ---------------------------------------------------------
  // Snap helpers
  // ---------------------------------------------------------
  /** Snap by aligning to the current stripIndex (window is already aligned via steps). */
  private snapToCurrentIndex(reelIndex: number) {
    const reel = this.reels[reelIndex];
    // position sprites exactly into slots
    for (let i = 0; i < reel.sprites.length; i++) {
      reel.sprites[i].y = i * this.unit;
    }
    // refresh textures for perfect consistency
    this.refreshReelTextures(reelIndex);

    reel.velocity = 0;
    reel.stopping = false;
    reel.snapped = true;
    reel.targetStops = null;
    reel.stopStepsTotal = 0;
    reel.stopStepsRemaining = 0;
  }

  /** Force set the visible 3 rows to the target window (used on SLAM or as fallback). */
  private forceSnapNow(reelIndex: number) {
    const reel = this.reels[reelIndex];
    const target = reel.targetStops!;
    const rows = this.config.rows;

    if (reel.targetStartIndex >= 0) {
      reel.stripIndex = reel.targetStartIndex;
      for (let i = 0; i < reel.sprites.length; i++) {
        reel.sprites[i].y = i * this.unit;
      }
      this.refreshReelTextures(reelIndex);
    } else {
      // Exceptional fallback: directly paint the visible 3 rows to target
      for (let i = 0; i < rows; i++) {
        const s = reel.sprites[i];
        const si = target[i];
        s.texture = this.factory.getTextureFor(this.config.symbols[si]);
        s.y = i * this.unit;
        s.tint = 0xffffff;
      }
      for (let i = rows; i < reel.sprites.length; i++) {
        reel.sprites[i].y = i * this.unit;
      }
    }

    reel.velocity = 0;
    reel.stopping = false;
    reel.snapped = true;
    reel.targetStops = null;
    reel.stopStepsTotal = 0;
    reel.stopStepsRemaining = 0;
  }

  // ---------------------------------------------------------
  // Utility
  // ---------------------------------------------------------
  private findSlice(strip: number[], target: number[], rows: number): number {
    const len = strip.length;
    for (let start = 0; start < len; start++) {
      let ok = true;
      for (let i = 0; i < rows; i++) {
        if (strip[(start + i) % len] !== target[i]) { ok = false; break; }
      }
      if (ok) return start;
    }
    return -1;
  }

  // ---------------------------------------------------------
  // Win highlight helpers (unchanged)
  // ---------------------------------------------------------
  /**
 * Highlight a win using the actual landed result.
 * Call this AFTER RESULT_READY, passing the last SpinResult and the line info.
 */
  public highlightWinFromResult(result: import('../types').SpinResult, line: { lineIndex: number; symbolIndex: number; count: number }) {
    this.clearHighlights();

    const rows = this.config.rows;
    const needed = Math.min(line.count, this.reels.length);
    let hits = 0;

    // 1) Collect winners from left to right using the landed grid (result.reels[r][row])
    for (let r = 0; r < this.reels.length && hits < needed; r++) {
      const col = result.reels?.[r];
      if (!Array.isArray(col) || col.length !== rows) continue;

      // find the row in this reel that matches the winning symbol
      let rowIdx = -1;
      for (let row = 0; row < rows; row++) {
        if (col[row] === line.symbolIndex) {
          rowIdx = row;
          break;
        }
      }
      if (rowIdx === -1) continue; // no matching symbol in this reel

      const spr = this.reels[r].sprites[rowIdx];
      this.applyWinnerStyle(r, spr);
      this._winning.add(spr);
      hits++;
    }

    // 2) Dim everything else to make winners pop
    this.dimNonWinners();
  }

  /** Strong, casino-like styling for a winning symbol on a reel. */
  private applyWinnerStyle(reelIndex: number, spr: PIXI.Sprite) {
    // Reset to a clean baseline first
    spr.tint = 0xffffff;
    spr.alpha = 1;
    spr.scale.set(1);

    // Glow: a rounded rect behind the sprite (in the reel container)
    // We draw it at (0, sprite.y) because each reel column is a separate container.
    const glow = new PIXI.Graphics();
    glow.beginFill(0xfff455, 0.65)
      .drawRoundedRect(-4, spr.y - 4, this.symbolW + 8, this.symbolH + 8, 10)
      .endFill();
    glow.blendMode = PIXI.BLEND_MODES.ADD;

    const reelC = this.reels[reelIndex].container;
    // Put glow just behind the sprite: add glow first, then ensure sprite is later in children order.
    reelC.addChild(glow);
    // Re-add sprite to be on top (optional; keep z-order simple without filters)
    if (spr.parent === reelC) {
      reelC.removeChild(spr);
      reelC.addChild(spr);
    }
    this._glows.set(spr, glow);

    // Winner tint that stands out (rich yellow) and no dimming
    spr.tint = 0xfff455;     // bright, warm yellow
    spr.alpha = 1;

    // Start a subtle pulse on winners (scale 1.00 ↔ 1.07)
    this.startPulse();
  }

  private startPulse() {
    if (this._pulseCb) return;
    let t = 0;
    this._pulseCb = (delta: number) => {
      t += delta;
      const s = 1 + 0.07 * Math.sin(t * 0.12); // tune speed/amplitude
      for (const spr of this._winning) {
        spr.scale.set(s, s);
      }
    };
    this.app.ticker.add(this._pulseCb);
  }

  /** Dim all non-winning sprites so winners dominate visually. */
  private dimNonWinners() {
    for (const reel of this.reels) {
      for (const spr of reel.sprites) {
        if (!this._winning.has(spr)) {
          spr.tint = 0x9aa3af; // cool gray
          spr.alpha = 0.33;    // strong dim
          spr.scale.set(1, 1);
        }
      }
    }
  }

  /** Reset all visual changes (call before next spin or when hiding wins). */
  public clearHighlights() {
    // stop pulsing
    if (this._pulseCb) {
      this.app.ticker.remove(this._pulseCb);
      this._pulseCb = null;
    }

    // remove glows
    for (const [spr, glow] of this._glows) {
      if (glow.parent) glow.parent.removeChild(glow);
      glow.destroy();
    }
    this._glows.clear();

    // reset sprites
    for (const reel of this.reels) {
      for (const spr of reel.sprites) {
        spr.tint = 0xffffff;
        spr.alpha = 1;
        spr.scale.set(1, 1);
      }
    }
    this._winning.clear();
  }

  // ---------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------
  destroy(options?: PIXI.IDestroyOptions | boolean) {
    super.destroy(options);
    this.factory.destroy();
    if (this.maskGfx) {
      this.maskGfx.destroy();
      this.maskGfx = null;
    }
  }
}