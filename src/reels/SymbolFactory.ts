
import * as PIXI from 'pixi.js';

export class SymbolFactory {
  private cache = new Map<string, PIXI.RenderTexture>();
  private colors: Record<string, number> = {
    A: 0x2dd4bf,
    K: 0xf59e0b,
    Q: 0x60a5fa,
    J: 0x34d399,
    WILD: 0xec4899,
    SCATTER: 0x22d3ee,
  };

  constructor(
    private app: PIXI.Application,
    private width: number,
    private height: number
  ) {}

  getTextureFor(symbol: string): PIXI.Texture {
    const existing = this.cache.get(symbol);
    if (existing) return existing;

    const g = new PIXI.Graphics();
    const color = this.colors[symbol] ?? 0x64748b;
    g.beginFill(color, 1);
    g.drawRoundedRect(0, 0, this.width, this.height, Math.min(this.width, this.height) * 0.15);
    g.endFill();

    const text = new PIXI.Text(
      symbol,
      new PIXI.TextStyle({
        fill: 0xffffff,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial',
        fontSize: Math.floor(this.height * 0.48),
        fontWeight: '900',
        stroke: 0x000000,
        strokeThickness: 3,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 4,
        dropShadowDistance: 2,
        dropShadowAlpha: 0.35,
        align: 'center',
      })
    );
    text.anchor.set(0.5);
    text.position.set(this.width / 2, this.height / 2);

    const container = new PIXI.Container();
    container.addChild(g, text);

    const rt = PIXI.RenderTexture.create({ width: this.width, height: this.height });
    this.app.renderer.render(container, { renderTexture: rt });

    this.cache.set(symbol, rt);
    return rt;
  }

  destroy() {
    this.cache.forEach((rt) => rt.destroy());
    this.cache.clear();
  }
}
