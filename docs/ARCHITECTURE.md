Goals

Slot feel over frames: spin ↓ → decelerate → land by spinning through the strip (no teleport).
Deterministic, never‑hang reels (works under low FPS/HMR).
Event‑driven and config‑tuned (timings in game.json).

`Design

Pixi v7 scene: Background + Game (design units) → Reels, WinLayer, HUD.
Mask on reels → exact 5×3 view.
SymbolFactory builds cached RenderTexture symbols (no runtime atlas needed).
Event Bus + State Machine:
SPIN_REQUESTED → SPIN_STARTED → SPIN_RESULT → RESULT_READY → WIN_PRESENTATION_DONE.

Reel Engine (Core)

Offset‑accumulator scroll per reel: add dy to offsetY; for each full unit, advance one strip step and refresh textures. This is FPS‑independent and never misses steps.
Sequential spin‑up/stop (staggered).
Stop plan (step‑based): when result arrives, compute how many strip steps to the target slice (+ optional laps). Decelerate by plan progress, then do a tiny micro‑snap (≤150 ms) to finish.
Slam stop: immediate direct grid reveal for the current reel, then proceed in order.
Safety nets: fallback target if result slice is malformed + hard cap (maxSpinMs) to guarantee landing.

HUD & Input

SPIN ↔ STOP button (color toggle).
Balance/bet/win and free‑spins via HUD_UPDATE.
STOP emits STOP_REQUESTED → engine executes slam path.

Win Highlight

Winners: bright glow + tint + pulse; others dim.
clearHighlights() resets all visuals.

Config (key knobs in game.json → spin)

minSpinMs, decelMs, startStaggerMs, stopStaggerMs, lapsBeforeStop,
landingMs/landingStyle/landingOvershootPx, maxSpinMs.

Trade‑offs

Event‑driven = decoupled & testable, with small boilerplate.
Fallback targets hide data errors (logged in console).
Glow as Graphics is simple (not the most GPU‑optimal) but fine for scope.

If I Had More Time

Payline overlay (path‑based highlighting & animations).
Blur symbol frames for more refined reel spining,
Richer VFX/audio
Some tweens like bounce effect on reel stopping.
Intro outro popups for freegame begins or end with what values awarded
Game logo


## Self‑Critique (What I’m Not Fully Satisfied With)

One part of the implementation I am not fully satisfied with is the Win Highlight logic being embedded directly inside the ReelEngine. While it works, it mixes rendering‑layer concerns with reel‑motion logic, which breaks clean separation of responsibilities. 

With more time, I would extract all win‑highlight visuals (glow, pulse, tint, dimming) into a dedicated `WinHighlighter` system or overlay layer. That would keep ReelEngine focused only on spinning/landing rules and make highlight animations easier to maintain, test, and extend (e.g., line paths, scatter animations, symbol‑specific effects).

The ReelEngine has grown complex due to handling spin, deceleration, landing, slam stop, and polish inside one class; with more time I would modularize these behaviors into smaller subsystems.