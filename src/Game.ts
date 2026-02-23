// src/Game.ts
import * as PIXI from 'pixi.js';
import type { GameConfig, SpinResult } from './types';
import { events } from './core/EventBus';
import { ReelEngine } from './reels/ReelEngine';
import { HUD } from './hud/HUD';
import { SpinService } from './services/SpinService';
import { StateMachine } from './state/StateMachine';
import { IdleStateController } from './state/states/Idle';
import { SpinningStateController } from './state/states/Spinning';
import { ResultStateController } from './state/states/Result';
import { WinPresentationController } from './state/states/WinPresentation';
import { FreeSpinsFeature } from './features/FreeSpinsFeature';

export class Game {
    private containers = {
        game: new PIXI.Container(),
        background: new PIXI.Container(),
        reels: new PIXI.Container(),
        hud: new PIXI.Container(),
    };

    private lastResult: SpinResult | null = null;

    // Add a field near other fields
    private currentSpinIsFree = false;

    private reelEngine: ReelEngine;

    private spinService: SpinService;

    private controllers: Array<{ update?: (delta: number) => void }> = [];

    // Simple local accounting
    private balance: number;
    private bet: number;
    private inFreeSpin: boolean = false;

    // Responsive layout: design reference size
    private designW = 900;
    private designH = 600;

    constructor(private app: PIXI.Application, private config: GameConfig) {
        // --- Accounting state ---
        this.balance = 1000;                   // demo starting balance
        this.bet = config.defaultBet;
        this.inFreeSpin = false;
        this.currentSpinIsFree = false;        // per-spin flag (prevents bet deduction on FS)

        // --- Stage hierarchy ---
        // Background sits directly on stage and always fills the viewport
        app.stage.addChild(this.containers.background);

        // The game container holds content authored in design units (scaled/centered on resize)
        app.stage.addChild(this.containers.game);
        this.containers.game.addChild(this.containers.reels);
        this.containers.game.addChild(this.containers.hud);

        // --- Background (full viewport) ---
        this.rebuildBackground();

        // --- Services & controllers ---
        this.spinService = new SpinService(config);

        // Reel engine in design space
        this.reelEngine = new ReelEngine(app, config);
        this.containers.reels.addChild(this.reelEngine);
        this.reelEngine.y = 120;

        // HUD (designed for designW width)
        const hud = new HUD(this.designW);
        this.containers.hud.addChild(hud);
        this.containers.hud.y = 5;
        this.containers.hud.x = 20;

        // Initial HUD snapshot
        events.emit('HUD_UPDATE', {
            balance: this.balance,
            bet: this.bet,
            win: 0,
            freeSpinsRemaining: 0,
        });

        // State machine + controllers (event-driven)
        const _stateMachine = new StateMachine();
        const idle = new IdleStateController(this.spinService);
        const spinning = new SpinningStateController(this.reelEngine, () => this.lastResult);
        const result = new ResultStateController(() => this.lastResult);
        const winPres = new WinPresentationController(this.reelEngine, () => this.lastResult);
        const fs = new FreeSpinsFeature(() => this.lastResult);
        this.controllers.push(spinning, winPres);

        // --- Event wiring ---

        // Keep last spin payload
        events.on('SPIN_RESULT', (payload) => {
            this.lastResult = payload;
        });

        // Free-spins per-spin flag: mark this upcoming spin as free

        events.on('FREE_SPIN_SPIN_START', () => { this.currentSpinIsFree = true; });

        events.on('SPIN_STARTED', () => {
            if (!this.currentSpinIsFree) {
                this.balance = Math.max(0, this.balance - this.bet);
                events.emit('HUD_UPDATE', { balance: this.balance, win: 0 });
            }
        });

        events.on('RESULT_READY', () => {
            this.currentSpinIsFree = false;
        });



        // Track FS remaining to know if we are inside free-spin mode
        events.on('HUD_UPDATE', (p) => {
            if (p.freeSpinsRemaining !== undefined) {
                this.inFreeSpin = p.freeSpinsRemaining > 0;
            }
        });

        // --- Layout & resize ---
        this.layout(); // scales/centers game container using designW/designH
        window.addEventListener('resize', () => this.layout());

        // --- Ticker ---
        app.ticker.add((delta) => {
            for (const c of this.controllers) c.update?.(delta);
        });
    }

    private rebuildBackground() {
        this.containers.background.removeChildren();
        const bg = new PIXI.Graphics();
        bg.beginFill(0x111827);
        bg.drawRect(0, 0, this.app.renderer.width, this.app.renderer.height);
        bg.endFill();
        this.containers.background.addChild(bg);
    }

    private layout() {
        // Rebuild full-viewport background
        this.rebuildBackground();

        // Compute uniform scale to fit designW x designH into the window
        this.designH = this.containers.game.height / this.containers.game.scale.y;
        this.designW = this.containers.game.width / this.containers.game.scale.x;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / this.designW, vh / this.designH);

        // Scale and center the game container
        this.containers.game.scale.set(scale, scale);
        const gx = Math.floor((vw - this.designW * scale) / 2);
        const gy = Math.floor((vh - this.designH * scale) / 2);
        this.containers.game.position.set(gx, gy);

        // Center the reels inside the design area
        this.reelEngine.layoutCenter(this.designW);
    }
}