
import * as PIXI from 'pixi.js';
import { loadConfig } from './core/Config';
import { loadCoreAssets } from './assets/assets';
import { Game } from './Game';

async function main() {
  await loadCoreAssets();
  const app = new PIXI.Application({ background: '#0f1226', resizeTo: window, antialias: true });
  document.getElementById('app')!.appendChild(app.view as HTMLCanvasElement);
  const cfg = await loadConfig();
  const game = new Game(app, cfg);
  (window as any).game = game;
}

main();
