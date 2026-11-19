import { Texture } from 'pixi.js';

export interface SpriteInfo { name: string; w: number; h: number }
export type Manifest = Record<string, SpriteInfo[]>;

export interface Assets {
  img: Record<string, HTMLImageElement>;
  tex: (key: string) => Texture;
  manifest: Manifest;
  url: (key: string) => string;
}

const base = import.meta.env.BASE_URL;
export const spriteUrl = (key: string) => `${base}sprites/${key}.png`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Could not load ${src}`));
    im.src = src;
  });
}

export async function loadAssets(): Promise<Assets> {
  const manifest: Manifest = await (await fetch(`${base}sprites/manifest.json`)).json();
  const keys = Object.entries(manifest).flatMap(([sheet, items]) => items.map((i) => `${sheet}/${i.name}`));
  const img: Record<string, HTMLImageElement> = {};
  await Promise.all([
    ...keys.map(async (k) => { img[k] = await loadImage(spriteUrl(k)); }),
    (async () => { img.parchment = await loadImage(`${base}sprites/parchment.jpg`); })(),
  ]);
  const cache = new Map<string, Texture>();
  const tex = (key: string) => {
    let t = cache.get(key);
    if (!t) {
      t = Texture.from(img[key]);
      cache.set(key, t);
    }
    return t;
  };
  return { img, tex, manifest, url: spriteUrl };
}
