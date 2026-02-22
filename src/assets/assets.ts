
import * as PIXI from 'pixi.js';
export async function loadCoreAssets() {
  PIXI.Assets.addBundle('core', {});
  await PIXI.Assets.loadBundle('core');
}
