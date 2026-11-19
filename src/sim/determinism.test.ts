import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mulberry32, hashSeed } from './rng';
import { generateWorld } from './mapgen';

describe('determinism', () => {
  // Every shared seed and every save depends on these exact numbers. If this fails, the RNG
  // changed: bump GEN_VERSION in version.ts (saves rebuild their world from the seed).
  it('pins the first outputs of the RNG', () => {
    const r = mulberry32(1492);
    expect([r(), r(), r()].map((x) => Math.round(x * 1e9))).toEqual(PINNED_RNG);
    expect([hashSeed(1492), hashSeed(1492, 7, 3), hashSeed(0)]).toEqual(PINNED_HASH);
  });

  it('pins the world generated for seed 1492', () => {
    // If generation changed on purpose, update this digest and bump GEN_VERSION.
    expect(digest(1492)).toBe(PINNED_WORLD);
  });

  it('makes a valid, distinct world for each of 25 seeds', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 25; seed++) {
      const w = generateWorld(seed);
      seen.add(digest(seed, w));
      expect(w.new.nations.length, `seed ${seed} nations`).toBeGreaterThanOrEqual(6);
      expect(w.new.portals.length, `seed ${seed} portals`).toBeGreaterThan(0);
      expect(w.old.portals.length, `seed ${seed} portals`).toBeGreaterThan(0);
      const land = w.new.terrain.filter((t) => t > 1).length / w.new.terrain.length;
      expect(land, `seed ${seed} land share`).toBeGreaterThan(0.3);
      expect(land, `seed ${seed} land share`).toBeLessThan(0.55);
    }
    expect(seen.size).toBe(25);
  });
});

function digest(seed: number, w = generateWorld(seed)) {
  return createHash('sha1').update(w.old.terrain).update(w.old.realm).update(w.new.terrain).update(w.new.resource)
    .update(JSON.stringify([w.old.ports, w.new.ports, w.new.nations, w.new.rumours])).digest('hex');
}

const PINNED_RNG = [626777223, 453098907, 782630688];
const PINNED_HASH = [1359080152, 904822223, 84702589];
const PINNED_WORLD = '9f202b081a8c2b51e8954d916346bb5b99837804';
