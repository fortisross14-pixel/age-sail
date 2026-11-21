/**
 * What needs the player before the turn ends: a pure reading of the game state, with no rules in it.
 * Urgent items make End Turn ask first; the rest are listed beside them.
 */
import { TECHS } from '../data/tech';
import { techAvailable } from '../sim/game';
import { objectiveDone } from '../sim/objectives';
import type { GameState, World } from '../sim/types';

/** Where an item (or an objective's "Show me") takes the player. */
export interface Target {
  /** with the Fleets screen: open this fleet's own page */
  fleetOpen?: number;
  drawer?: 'cities' | 'markets' | 'fleets' | 'court' | 'research' | 'chronicle';
  courtTab?: 'people' | 'petitioners' | 'peoples' | 'crowns' | 'dynasty' | 'europe';
  fleet?: number;
  party?: number;
  colony?: string;
  researchTab?: 'subjects' | 'laws' | 'expedition';
}

export interface Attention {
  /** stable while the same thing is waiting, so the player is asked about it only once */
  id: string;
  text: string;
  urgent: boolean;
  go: Target;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function attention(g: GameState, world: World): Attention[] {
  const out: Attention[] = [];
  const leading = new Set(g.parties.map((p) => p.leader));

  if (!objectiveDone(g, 'explorer')) {
    out.push({ id: 'no-explorer', urgent: true, go: { drawer: 'fleets', fleetOpen: g.fleets.find((f) => f.leader == null && f.at != null)?.id }, text: 'No explorer is commissioned: your ships cannot leave charted waters.' });
  }
  if (!g.research.current && TECHS.some((t) => techAvailable(g, t.id))) {
    out.push({ id: 'research', urgent: true, go: { drawer: 'research' }, text: 'Your scholars have nothing to study.' });
  }
  for (const p of g.people) {
    if (!p.alive || p.ready !== 0 || p.fleet != null || leading.has(p.id)) continue;
    if (p.rank !== 'explorer' && p.rank !== 'merchant') continue;
    out.push({ id: `leader-${p.id}`, urgent: true, go: { drawer: 'fleets', fleetOpen: g.fleets.find((f) => f.leader == null && f.at === p.city)?.id }, text: `${p.name}, ${p.rank}, is ready and has no fleet to lead.` });
  }
  for (const f of g.fleets) {
    if (f.at || f.order || f.route?.active || f.standing) continue;
    if (f.moves > 0) out.push({ id: `adrift-${f.id}`, urgent: true, go: { fleet: f.id }, text: `${f.name} is at sea without orders.` });
  }
  for (const p of g.parties) {
    if (p.moves > 0 && !p.order) out.push({ id: `party-${p.id}`, urgent: true, go: { party: p.id }, text: `${p.name} waits ashore without orders.` });
  }
  for (const c of g.colonies) {
    if (c.last.besieged) out.push({ id: `siege-${c.id}`, urgent: true, go: { drawer: 'cities', colony: c.id }, text: `${c.name} is under siege.` });
    else if (c.last.hungry) out.push({ id: `hungry-${c.id}`, urgent: true, go: { drawer: 'cities', colony: c.id }, text: `${c.name} is going hungry.` });
  }

  for (const r of g.rebels) {
    const c = g.colonies.find((x) => x.map === r.map && x.hex === r.target);
    if (c) out.push({ id: `rebels-${r.id}`, urgent: true, go: { drawer: 'cities', colony: c.id }, text: `${r.name} is marching on ${c.name}.` });
  }

  // worth a look, but no reason to stop the turn
  for (const f of g.fleets) {
    if (!f.at && f.supplies <= 2) out.push({ id: `stores-${f.id}`, urgent: false, go: { fleet: f.id }, text: `${f.name} has food for ${plural(Math.max(0, f.supplies), 'season', 'seasons')}.` });
  }
  const home = new Set(world.old.ports.filter((p) => p.kind === 'home').map((p) => p.id));
  const docked = g.fleets.filter((f) => f.at && home.has(f.at) && !f.order && !f.route?.active);
  if (docked.length) out.push({ id: 'docked', urgent: false, go: { drawer: 'fleets' }, text: `${plural(docked.length, 'fleet lies', 'fleets lie')} idle in your ports.` });
  const yards = Object.values(g.cities).filter((c) => !c.project && c.buildings.docks > 0).length;
  if (yards) out.push({ id: 'yards', urgent: false, go: { drawer: 'cities' }, text: `${plural(yards, 'shipyard stands', 'shipyards stand')} idle.` });
  if (g.petitioners.length) out.push({ id: 'petitioners', urgent: false, go: { drawer: 'court', courtTab: 'petitioners' }, text: `${plural(g.petitioners.length, 'petitioner waits', 'petitioners wait')} at court.` });
  if (g.dynasty.offers.length) out.push({ id: 'offers', urgent: false, go: { drawer: 'court', courtTab: 'dynasty' }, text: `${plural(g.dynasty.offers.length, 'offer', 'offers')} of marriage wait for an answer.` });
  const leaving = g.people.filter((p) => p.alive && p.loyalty <= 20).length;
  if (leaving) out.push({ id: 'disloyal', urgent: false, go: { drawer: 'court', courtTab: 'people' }, text: `${plural(leaving, 'courtier is', 'courtiers are')} ready to leave your service.` });
  return out;
}
