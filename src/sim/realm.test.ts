import { describe, it, expect } from 'vitest';
import { newGame, endTurn, startProject, mainPort } from './game';
import { generateOldWorld } from './mapgen';
import { OLD } from './hex';
import { CROWNS, rivalsOf, type CrownId } from '../data/rivals';
import { CITIES } from '../data/europe';
import { realmAt } from '../data/realms';
import { isWater } from '../data/terrain';

describe('M9: your realm', () => {
  const m = generateOldWorld(1492);
  const cities = m.ports.filter((p) => p.realm);

  it('places every city on its own hex, with at least one empty hex between any two', () => {
    expect(cities.length).toBe(CITIES.length);
    for (const a of cities) {
      expect(a.hex, a.name).toBeGreaterThanOrEqual(0);
      expect(isWater(m.terrain[a.hex]), a.name).toBe(false);
      for (const b of cities) if (a !== b) expect(OLD.distance(a.hex, b.hex), `${a.name}–${b.name}`).toBeGreaterThanOrEqual(2);
    }
    const sev = cities.find((c) => c.id === 'seville')!, cad = cities.find((c) => c.id === 'cadiz')!;
    expect(OLD.distance(sev.hex, cad.hex)).toBeGreaterThanOrEqual(2);
  });

  it('draws realms over the land: each city stands in its own realm', () => {
    for (const c of cities) expect(realmAt(m.realm[c.hex]), c.name).toBe(c.realm);
    const held = [...m.realm].filter((r) => r > 0).length;
    expect(held).toBeGreaterThan(600);
    // the generated African coast belongs to its peoples
    for (let i = 0; i < OLD.N; i++) if (OLD.lat(i) < 28) expect(m.realm[i]).toBe(0);
  });

  for (const spec of CROWNS) {
    it(`plays as ${spec.name}: home cities, ships in the main port, four rivals`, () => {
      const { world, state } = newGame(7, 1650, spec.id as CrownId);
      expect(state.crown).toBe(spec.id);
      expect(mainPort(state)).toBe(spec.home);
      const home = world.old.ports.filter((p) => p.kind === 'home');
      expect(home.every((p) => p.realm === spec.id)).toBe(true);
      expect(Object.keys(state.cities).sort()).toEqual(home.map((p) => p.id).sort());
      expect(state.fleets.every((f) => f.at === spec.home)).toBe(true);
      expect(state.units.filter((u) => u.city === spec.home).length).toBeGreaterThanOrEqual(2);
      expect(rivalsOf(spec.id).map((r) => r.id)).not.toContain(spec.id);
      expect(state.chronicle.some((c) => /the Crown/i.test(c.text))).toBe(false);
      for (let t = 0; t < 30; t++) endTurn(world, state);
      // the rival crowns get going; you never appear among them
      expect(state.rivalColonies.some((c) => c.crown === spec.id)).toBe(false);
      expect(state.rivalColonies.length + state.rivalShips.length).toBeGreaterThan(0);
    });
  }

  it('inland cities build but have no docks, and their units march to the nearest port', () => {
    const { world, state } = newGame(7, 1650, 'france');
    const paris = state.cities.paris;
    expect(paris.inland).toBe(true);
    expect(startProject(state, 'paris', { kind: 'building', building: 'docks' }).ok).toBe(false);
    expect(startProject(state, 'paris', { kind: 'unit', unit: 'colonist' }).ok).toBe(true);
    endTurn(world, state);
    const u = state.units[state.units.length - 1];
    expect(u.city).not.toBe('paris');
    expect(world.old.ports.find((p) => p.id === u.city)?.inland).toBeFalsy();
  });

  it('national edges: Portugal knows charts, the Dutch trade and build cheaper', () => {
    expect(newGame(7, 1650, 'portugal').state.research.known).toEqual(['portolan', 'lateen']);
    expect(newGame(7, 1650, 'france').state.people.length).toBe(11);
  });
});
