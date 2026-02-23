import * as PIXI from 'pixi.js';
import { events } from '../core/EventBus';

export class HUD extends PIXI.Container {
  private balanceText: PIXI.Text;
  private betText: PIXI.Text;
  private winText: PIXI.Text;
  private freeSpinsText: PIXI.Text;

  private spinButton: PIXI.Container;
  private spinLabel: PIXI.Text;

  private currentBalance = 1000;
  private currentBet = 1;
  private currentWin = 0;
  private freeSpinsRemaining = 0;

  private isSpinning = false;

  constructor(width: number) {
    super();

    const title = new PIXI.Text('SLOT', new PIXI.TextStyle({ fill: 0xffffff, fontSize: 18, letterSpacing: 2 }));
    this.addChild(title);

    this.balanceText = new PIXI.Text('', new PIXI.TextStyle({ fill: 0xbfe9ff, fontSize: 14 }));
    this.betText     = new PIXI.Text('', new PIXI.TextStyle({ fill: 0xbfe9ff, fontSize: 14 }));
    this.winText     = new PIXI.Text('', new PIXI.TextStyle({ fill: 0xbfe9ff, fontSize: 14 }));
    this.freeSpinsText = new PIXI.Text('', new PIXI.TextStyle({ fill: 0xffcc66, fontSize: 14 }));

    this.balanceText.position.set(0, 28);
    this.betText.position.set(0, 48);
    this.winText.position.set(0, 68);
    this.freeSpinsText.position.set(0, 88);

    this.addChild(this.balanceText, this.betText, this.winText, this.freeSpinsText);

    // Button
    this.spinButton = new PIXI.Container();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x4ade80);
    bg.drawRoundedRect(0, 0, 120, 44, 50);
    bg.endFill();

    this.spinLabel = new PIXI.Text('SPIN', new PIXI.TextStyle({ fill: 0x0a0a0a, fontWeight: '700', fontSize: 16 }));
    this.spinLabel.anchor.set(0.5);
    this.spinLabel.position.set(60, 22);

    this.spinButton.addChild(bg, this.spinLabel);
    this.spinButton.position.set(width - 140, 16);
    this.addChild(this.spinButton);

    this.spinButton.eventMode = 'static';
    this.spinButton.on('pointerdown', () => {
      if (this.isSpinning) {
        // STOP while spinning
        events.emit('STOP_REQUESTED', undefined);
      } else {
        // Start spin if allowed
        if (this.spinEnabled()) {
          events.emit('SPIN_REQUESTED', undefined);
        }
      }
    });

    // HUD and state events
    events.on('HUD_UPDATE', (payload) => {
      if (payload.balance !== undefined) this.currentBalance = payload.balance;
      if (payload.bet !== undefined)     this.currentBet = payload.bet;
      if (payload.win !== undefined)     this.currentWin = payload.win;
      if (payload.freeSpinsRemaining !== undefined) this.freeSpinsRemaining = payload.freeSpinsRemaining;
      this.renderTexts();
    });

    events.on('STATE_CHANGED', ({ state }) => {
      this.isSpinning = (state === 'SPINNING' || state === 'RESULT');
      this.updateSpinButtonState(bg);
    });

    this.renderTexts();
    this.updateSpinButtonState(bg);
  }

  private spinEnabled() {
    // Allow STOP during spinning regardless of balance/free spins.
    if (this.isSpinning) return true;
    // Otherwise, only allow SPIN when not in free spins and enough balance.
    return this.freeSpinsRemaining <= 0 && this.currentBalance >= this.currentBet;
  }

  private updateSpinButtonState(bg: PIXI.Graphics) {
    // Label
    this.spinLabel.text = this.isSpinning ? 'STOP' : 'SPIN';
    this.isSpinning ? bg.beginFill(0xff0000) : bg.beginFill(0x4ade80);
    bg.drawRoundedRect(0, 0, 120, 44, 50);
    bg.endFill();
    // Visual enabled state only relevant for SPIN
    const enableSpin = !this.isSpinning && this.spinEnabled();
    this.spinButton.alpha = (this.isSpinning || enableSpin) ? 1 : 0.5;
  }

  private renderTexts() {
    this.balanceText.text = `Balance: ${this.currentBalance}`;
    this.betText.text = `Bet: ${this.currentBet}`;
    this.winText.text = `Win: ${this.currentWin}`;
    this.freeSpinsText.text = this.freeSpinsRemaining > 0 ? `Free Spins: ${this.freeSpinsRemaining}` : '';
  }
}