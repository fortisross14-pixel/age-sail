/**
 * The story engine. Stories are data (`src/data/stories/`): this file binds their subjects, checks
 * their conditions, fills their text, and carries out their effects. One story may come in a
 * season; a story not yet told always comes before one that has been; follow-ups arrive when due.
 */
import { STORIES, STORY_PACE } from '../data/stories';
import type { About, ChoiceDef, Cond, Effect, Family, Outcome, StoryDef } from '../data/stories/types';
import { HOUSES } from '../data/dynasty';
import { REALMS, realmSpec, type RealmId } from '../data/realms';
import { rivalSpec, crownSpec, rivalsOf, type CrownId } from '../data/rivals';
import { CITIES } from '../data/europe';
import { SKILL_INFO } from '../data/court';
import { isMilitary } from '../data/army';
import { SKILLS, Fog, yearOf, type GameEvent, type GameState, type Person, type World, type Skill, type TraitId } from './types';
import { mulberry32, hashSeed, int, pick, type Rng } from './rng';
import { GRIDS } from './hex';
import { personById, skill, ageOf, recallDeed } from './court';
import { REGION_OF } from '../data/trade';
import { allNations, remember, territory } from './natives';
import { score } from './colony';
import { rivalScore } from './rivals';
import { styled, titleOf, heirOf, chooseEraPath, royalAge } from './dynasty';

type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ctx = Record<string, string | number>;
const BY_ID = new Map(STORIES.map((s) => [s.id, s]));
export const storyById = (id: string) => BY_ID.get(id);
const CITY_NAME: Record<string, string> = Object.fromEntries(CITIES.map((c) => [c.id, c.name]));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------- who a story is about ----------

const leadsParty = (s: GameState, p: Person) => s.parties.some((x) => x.leader === p.id);
const PERSON: Record<string, (s: GameState, p: Person) => boolean> = {
  any: () => true,
  atCourt: (s, p) => p.fleet == null && !leadsParty(s, p) && p.rank !== 'governor',
  atSea: (_s, p) => p.fleet != null,
  explorer: (_s, p) => p.rank === 'explorer', merchant: (_s, p) => p.rank === 'merchant', governor: (_s, p) => p.rank === 'governor',
  ranked: (_s, p) => p.rank !== 'courtier', plain: (_s, p) => p.rank === 'courtier',
  young: (s, p) => ageOf(p, s.turn) < 35, old: (s, p) => ageOf(p, s.turn) >= 50,
  disloyal: (_s, p) => p.loyalty < 35, loyal: (_s, p) => p.loyalty >= 70,
  ambitious: (_s, p) => p.trait === 'ambitious', pious: (_s, p) => p.trait === 'pious', learned: (_s, p) => p.trait === 'learned', bold: (_s, p) => p.trait === 'bold',
  navigator: (_s, p) => p.skills.navigation >= 3, soldier: (_s, p) => p.skills.military >= 3, trader: (_s, p) => p.skills.commerce >= 3,
  builder: (_s, p) => p.skills.construction >= 3, envoy: (_s, p) => p.skills.diplomacy >= 3,
};
/** Find subjects for a story, or null when it has nobody to be about. */
function bind(w: World, s: GameState, about: About | undefined, rng: Rng): Ctx | null {
  const ctx: Ctx = { n: int(rng, 0, 999) };
  if (!about) return ctx;
  const garrison = (id: string) => s.units.some((u) => u.colony === id && isMilitary(u.type));
  if (about.fleet) {
    const FLEET: Record<string, (f: GameState['fleets'][number]) => boolean> = {
      any: () => true, atSea: (f) => !f.at, inPort: (f) => !!f.at && !!s.cities[f.at], led: (f) => f.leader != null, lowStores: (f) => f.supplies <= 2,
      deep: (f) => !!w[f.map].deep[f.hex], cargo: (f) => Object.values(f.cargo).some((n) => (n ?? 0) > 0), newWorld: (f) => f.map === 'new', big: (f) => f.ships.length >= 2,
    };
    const fs = s.fleets.filter((f) => about.fleet!.split(' ').every((k) => FLEET[k]?.(f) ?? true));
    if (!fs.length) return null;
    ctx.fleet = pick(rng, fs).id;
  }
  if (about.courtier) {
    const keys = about.courtier.split(' ');
    let ps = s.people.filter((p) => p.alive && keys.every((k) => (k === 'leader' ? true : PERSON[k]?.(s, p) ?? true)));
    if (keys.includes('leader')) { const f = s.fleets.find((x) => x.id === ctx.fleet); ps = ps.filter((p) => p.id === f?.leader); }
    if (!ps.length) return null;
    ctx.courtier = pick(rng, ps).id;
  }
  if (about.other) {
    const first = personById(s, Number(ctx.courtier));
    const keys = about.other.split(' ');
    const ps = s.people.filter((p) => p.alive && p.id !== first?.id && keys.every((k) =>
      k === 'rivalOf' ? !!first?.bonds.some((b) => b.with === p.id && b.kind === 'rival')
        : k === 'friendOf' ? !!first?.bonds.some((b) => b.with === p.id && b.kind === 'friend') : PERSON[k]?.(s, p) ?? true));
    if (!ps.length) return null;
    ctx.other = pick(rng, ps).id;
  }
  if (about.colony) {
    const COLONY: Record<string, (c: GameState['colonies'][number]) => boolean> = {
      any: () => true, disloyal: (c) => c.loyalty < 45, loyal: (c) => c.loyalty >= 70, big: (c) => c.pop >= 6, hungry: (c) => c.last.hungry,
      old: (c) => s.turn - c.founded >= 40, new: (c) => s.turn - c.founded < 12, chartered: (c) => c.charter, uncharted: (c) => !c.charter,
      garrison: (c) => garrison(c.id), nogarrison: (c) => !garrison(c.id),
      nearRival: (c) => s.rivalColonies.some((x) => x.map === c.map && GRIDS[c.map].distance(x.hex, c.hex) <= 6),
    };
    const cs = s.colonies.filter((c) => about.colony!.split(' ').every((k) => COLONY[k]?.(c) ?? true));
    if (!cs.length) return null;
    ctx.colony = pick(rng, cs).id;
  }
  const colony = s.colonies.find((c) => c.id === ctx.colony);
  if (about.people) {
    const keys = about.people.split(' ');
    const ns = allNations(w).filter((n) => {
      const st = s.natives[n.id];
      if (!st?.met) return false;
      return keys.every((k) => k === 'met' ? true : k === 'peace' ? st.relation === 'peace' : k === 'allied' ? st.relation === 'allied' : k === 'subject' ? st.relation === 'subject'
        : k === 'hostile' ? st.relation === 'war' || st.attitude <= -40 : k === 'friendly' ? st.attitude >= 40 && st.relation !== 'war' : k === 'post' ? st.post : k === 'mission' ? st.mission
          : k === 'feud' ? !!st.feud : k === 'strong' ? st.warriors >= 12 : k === 'weak' ? st.warriors < 6
            : k === 'neighbour' ? !!colony && n.map === colony.map && territory(n).some((h) => GRIDS[n.map].distance(h, colony.hex) <= 3) : true);
    });
    if (!ns.length) return null;
    ctx.people = pick(rng, ns).id;
  }
  if (about.crown) {
    const mine = score(s, w).total;
    const keys = about.crown.split(' ');
    const rs = rivalsOf(s.crown).filter((r) => {
      const st = s.rivals[r.id];
      return keys.every((k) => k === 'peace' ? st.relation === 'peace' : k === 'war' ? st.relation === 'war' : k === 'hostile' ? st.attitude < 0 : k === 'friendly' ? st.attitude >= 30
        : k === 'ahead' ? rivalScore(s, r.id).total > mine : k === 'behind' ? rivalScore(s, r.id).total <= mine
          : k === 'neighbour' ? !!colony && s.rivalColonies.some((x) => x.crown === r.id && x.map === colony.map && GRIDS[colony.map].distance(x.hex, colony.hex) <= 6) : true);
    });
    if (!rs.length) return null;
    ctx.crown = pick(rng, rs).id;
  }
  if (about.realm) {
    const rs = REALMS.filter((r) => r.id !== s.crown && (about.realm === 'tied' ? s.dynasty.ties.includes(r.id) : about.realm === 'untied' ? !s.dynasty.ties.includes(r.id) : true));
    if (!rs.length) return null;
    ctx.realm = pick(rng, rs).id;
  }
  if (about.coast) {
    const map = s.newWorldFound && rng() < 0.6 ? 'new' : 'old';
    const unknown = [...Array(GRIDS[map].N).keys()].filter((i) => s.fog[map][i] === Fog.Unknown && !(map === 'old' && GRIDS.old.lat(i) > 28) && w[map].terrain[i] > 1);
    if (unknown.length <= 50) return null;
    ctx.map = map; ctx.hex = pick(rng, unknown);
  }
  return ctx;
}

function holds(s: GameState, c: Cond, rng: Rng): boolean {
  const cmp = (v: number, op: string, n: number) => (op === '<' ? v < n : v >= n);
  switch (c[0]) {
    case 'year': return cmp(yearOf(s.turn), c[1], c[2]);
    case 'treasury': return cmp(s.treasury, c[1], c[2]);
    case 'prestige': return cmp(s.prestige, c[1], c[2]);
    case 'colonies': return cmp(s.colonies.length, c[1], c[2]);
    case 'fleets': return cmp(s.fleets.length, c[1], c[2]);
    case 'flag': return s.flags[c[1]] != null;
    case 'noflag': return s.flags[c[1]] == null;
    case 'crown': return (c.slice(1) as string[]).includes(s.crown);
    case 'tech': return s.research.known.includes(c[1] as never);
    case 'notech': return !s.research.known.includes(c[1] as never);
    case 'newWorld': return s.newWorldFound;
    case 'noNewWorld': return !s.newWorldFound;
    case 'married': return !!s.dynasty.consort;
    case 'unmarried': return !s.dynasty.consort;
    case 'heir': return s.dynasty.heirs.length > 0;
    case 'noheir': return s.dynasty.heirs.length === 0;
    case 'regency': return s.dynasty.regency;
    case 'noregency': return !s.dynasty.regency;
    case 'rulerOld': return royalAge(s.dynasty.ruler, s.turn) >= 50;
    case 'rulerYoung': return royalAge(s.dynasty.ruler, s.turn) < 30;
    case 'atWar': return rivalsOf(s.crown).some((r) => s.rivals[r.id].relation === 'war');
    case 'atPeace': return rivalsOf(s.crown).every((r) => s.rivals[r.id].relation !== 'war');
    case 'found': return s.finds.some((f) => (c.slice(1) as string[]).includes(f.resource));
    case 'galleonHome': return s.fleets.some((f) => f.at === crownSpec(s.crown).home && f.ships.some((x) => x.type === 'galleon'));
    case 'chance': return rng() < c[1];
  }
}

// ---------- words ----------

const first = (name: string) => name.split(' ')[0];
/** Fill a story's text with the names of its subjects and of your own realm. */
export function fill(text: string, w: World, s: GameState, ctx: Ctx): string {
  const h = HOUSES[s.crown];
  const p = personById(s, Number(ctx.courtier)), o = personById(s, Number(ctx.other));
  const n = allNations(w).find((x) => x.id === ctx.people);
  const crown = ctx.crown ? rivalSpec(ctx.crown as CrownId) : undefined;
  const heir = heirOf(s.dynasty);
  const vars: Record<string, string | undefined> = {
    courtier: p?.name, 'courtier.first': p && first(p.name), other: o?.name, 'other.first': o && first(o.name),
    fleet: s.fleets.find((f) => f.id === ctx.fleet)?.name, colony: s.colonies.find((c) => c.id === ctx.colony)?.name,
    people: n && `the ${n.people}`, crown: crown?.name, 'crown.people': crown?.people,
    realm: ctx.realm ? realmSpec(ctx.realm as RealmId).name : undefined,
    capital: CITY_NAME[crownSpec(s.crown).home], me: crownSpec(s.crown).name,
    ruler: styled(s.crown, s.dynasty.ruler), 'ruler.title': titleOf(s.crown, s.dynasty.ruler),
    heir: heir ? `${heir.sex === 'm' ? 'Prince' : 'Princess'} ${heir.name}` : 'the heir',
    house: h.houses[Number(ctx.n ?? 0) % h.houses.length], school: h.school, bankers: h.bankers, saint: h.saint, court: h.court,
    land: s.land?.name ?? 'the New World',
  };
  return text.replace(/\{([a-z.]+)\}/gi, (m, k: string) => vars[k] ?? m);
}

const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n).toLocaleString('en-US')}`;
/** What a choice will do, in a few words, when the story does not say. */
function hintOf(ch: ChoiceDef, w: World, s: GameState, ctx: Ctx): string | undefined {
  if (ch.hint) return fill(ch.hint, w, s, ctx);
  const parts: string[] = [];
  for (const e of ch.effects) {
    switch (e[0]) {
      case 'ducats': parts.push(`${signed(e[1])} ducats`); break;
      case 'prestige': parts.push(`${signed(e[1])} prestige`); break;
      case 'research': parts.push(`${signed(e[1])} research`); break;
      case 'loan': parts.push(`+${e[1].toLocaleString('en-US')} now, −${e[2]} a season for ${e[3]} seasons`); break;
      case 'skill': parts.push(`${fill(`{${e[1]}.first}`, w, s, ctx)} ${signed(e[3])} ${e[2] === 'best' || e[2] === 'worst' ? 'skill' : e[2]}`); break;
      case 'leave': parts.push(`${fill(`{${e[1]}.first}`, w, s, ctx)} leaves court`); break;
      case 'opinion': parts.push(`${fill(`{${e[1]}.first}`, w, s, ctx)} will ${e[2] > 0 ? 'be grateful' : 'resent it'}`); break;
      case 'loyalty': case 'loyaltyAll': parts.push(e[1] > 0 ? 'Loyalty rises' : 'Loyalty falls'); break;
      case 'regard': parts.push(e[1] > 0 ? 'They think better of you' : 'They are offended'); break;
      case 'attitude': case 'attitudeAll': parts.push(e[1] > 0 ? 'Their crown thinks better of you' : 'Their crown is angered'); break;
      case 'war': parts.push('War'); break;
      case 'crew': parts.push('Sailors may die'); break;
      case 'halt': parts.push('The fleet drops its orders'); break;
      case 'courtAll': parts.push(e[1] > 0 ? 'The court approves' : 'The court murmurs'); break;
    }
  }
  if (ch.roll && ch.roll[0] !== 'none') parts.push(`${SKILL_INFO[ch.roll[1] as Skill]?.name ?? 'Fortune'} decides how it ends`);
  else if (ch.roll) parts.push('A gamble');
  return parts.length ? parts.join('; ') : undefined;
}

// ---------- deeds ----------

function special(name: string, w: World, s: GameState, ctx: Ctx) {
  if (name === 'chartCoast') {
    const map = ctx.map as 'old' | 'new';
    for (const h of GRIDS[map].within(Number(ctx.hex), 6)) if (s.fog[map][h] < Fog.Charted) s.fog[map][h] = Fog.Charted;
  } else if (name === 'guideLands') {
    const n = allNations(w).find((x) => x.id === ctx.people);
    if (n) for (const h of [n.siteHex, ...n.villages].flatMap((v) => GRIDS[n.map].within(v, 3))) if (s.fog[n.map][h] < Fog.Explored) s.fog[n.map][h] = Fog.Explored;
  } else if (name === 'priceRevolution') {
    for (const id of Object.keys(s.cities)) for (const g of ['tools', 'timber', 'cloth', 'wine', 'food', 'stone'] as const) { const m = s.markets[id]?.[g]; if (m) m.base = Math.round(m.base * 1.33); }
  } else if (name === 'sendGalleon') {
    const f = s.fleets.find((x) => x.at === crownSpec(s.crown).home && x.ships.some((y) => y.type === 'galleon'));
    const ship = f?.ships.find((x) => x.type === 'galleon');
    if (f && ship) { f.ships = f.ships.filter((x) => x !== ship); if (!f.ships.length) { const l = personById(s, f.leader); if (l) { l.fleet = null; l.city = crownSpec(s.crown).home; } s.fleets = s.fleets.filter((x) => x !== f); } }
  } else if (name === 'defect') {
    // they take service with a rival crown, and take what they know
    const p = personById(s, Number(ctx.courtier));
    const to = s.rivals[ctx.crown as CrownId];
    if (p && to) { to.treasury += 300; if (p.skills.navigation >= 3) to.learning += 6; }
  }
}

function person(s: GameState, ctx: Ctx, slot: 'courtier' | 'other') { return personById(s, Number(ctx[slot])); }
function carry(effects: Effect[], w: World, s: GameState, ctx: Ctx, rng: Rng) {
  const fleet = s.fleets.find((f) => f.id === ctx.fleet);
  const colony = s.colonies.find((c) => c.id === ctx.colony);
  const nation = s.natives[String(ctx.people)];
  const rival = ctx.crown ? s.rivals[ctx.crown as CrownId] : undefined;
  for (const e of effects) {
    switch (e[0]) {
      case 'ducats': s.treasury += e[1]; break;
      case 'prestige': s.prestige += e[1]; break;
      case 'research': s.research.pending += e[1]; break;
      case 'loan': s.treasury += e[1]; s.loans.push({ perSeason: e[2], left: e[3] }); break;
      case 'skill': {
        const p = person(s, ctx, e[1]); if (!p) break;
        const k = (e[2] === 'best' ? [...SKILLS].sort((a, b) => p.skills[b] - p.skills[a])[0] : e[2] === 'worst' ? [...SKILLS].sort((a, b) => p.skills[a] - p.skills[b])[0] : e[2]) as Skill;
        p.skills[k] = clamp(p.skills[k] + e[3], 0, 5);
        break;
      }
      case 'trait': { const p = person(s, ctx, e[1]); if (p) p.trait = e[2] as TraitId; break; }
      case 'leave': case 'die': {
        const p = person(s, ctx, e[1]); if (!p) break;
        const f = p.fleet != null ? s.fleets.find((x) => x.id === p.fleet) : undefined;
        if (f) { f.leader = null; f.route = null; }
        for (const c of Object.values(s.cities)) if (c.governor === p.id) c.governor = null;
        for (const pt of s.parties) if (pt.leader === p.id) pt.leader = null;
        if (e[0] === 'die') { p.alive = false; p.died = s.turn; p.fleet = null; } else s.people = s.people.filter((x) => x !== p);
        break;
      }
      case 'opinion': { const p = person(s, ctx, e[1]); if (p) recallDeed(s, p, e[2], fill(e[3], w, s, ctx)); break; }
      case 'bond': {
        const a = person(s, ctx, 'courtier'), b = person(s, ctx, 'other'); if (!a || !b) break;
        a.bonds = [...a.bonds.filter((x) => x.with !== b.id), { with: b.id, kind: e[1] }];
        b.bonds = [...b.bonds.filter((x) => x.with !== a.id), { with: a.id, kind: e[1] }];
        break;
      }
      case 'courtAll': for (const p of s.people) if (p.alive) recallDeed(s, p, e[1], fill(e[2], w, s, ctx)); break;
      case 'crew': if (fleet) fleet.crew = Math.max(1, fleet.crew - Math.ceil(fleet.crew * e[1])); break;
      case 'stores': if (fleet) fleet.supplies = Math.max(0, fleet.supplies + e[1]); break;
      case 'hull': if (fleet) for (const x of fleet.ships) x.hull = clamp(x.hull + e[1], 10, 100); break;
      case 'halt': if (fleet) fleet.order = null; break;
      case 'cargoLose': if (fleet) for (const k of Object.keys(fleet.cargo) as (keyof typeof fleet.cargo)[]) fleet.cargo[k] = Math.floor((fleet.cargo[k] ?? 0) * (1 - e[1])); break;
      case 'loyalty': if (colony) colony.loyalty = clamp(colony.loyalty + e[1], 0, 100); break;
      case 'loyaltyAll': for (const c of s.colonies) c.loyalty = clamp(c.loyalty + e[1], 0, 100); break;
      case 'pop': if (colony) colony.pop = Math.max(1, colony.pop + e[1]); break;
      case 'food': if (colony) colony.stock.food = Math.max(0, (colony.stock.food ?? 0) + e[1]); break;
      case 'charter': if (colony) colony.charter = true; break;
      case 'garrison': if (colony) for (let k = 0; k < e[1]; k++) s.units.push({ id: s.nextId++, type: 'infantry', fleet: null, city: null, party: null, colony: colony.id }); break;
      case 'regard': if (nation) remember(s, nation, fill(e[2], w, s, ctx), e[1]); break;
      case 'warriors': if (nation) nation.warriors = Math.max(1, Math.round(nation.warriors * (1 + e[1]))); break;
      case 'convert': if (nation) nation.converted = clamp(nation.converted + e[1], 0, 1); break;
      case 'attitude': if (rival) rival.attitude = clamp(rival.attitude + e[1], -100, 100); break;
      case 'attitudeAll': for (const r of rivalsOf(s.crown)) s.rivals[r.id].attitude = clamp(s.rivals[r.id].attitude + e[1], -100, 100); break;
      case 'war': if (rival && rival.relation !== 'war') { rival.relation = 'war'; rival.warSince = s.turn; rival.attitude = Math.min(rival.attitude, -60); } break;
      case 'rivalDucats': if (rival) rival.treasury += e[1]; break;
      case 'realmTie': if (ctx.realm && !s.dynasty.ties.includes(String(ctx.realm))) s.dynasty.ties.push(String(ctx.realm)); break;
      case 'shock': s.shocks.push({ kind: e[1], region: e[2] === 'home' ? REGION_OF[s.crown] : e[2], since: s.turn, until: s.turn + 12 }); break;
      case 'flag': s.flags[e[1]] = s.turn; break;
      case 'unflag': delete s.flags[e[1]]; break;
      case 'later': s.pending.push({ story: e[1], at: s.turn + e[2], ctx: { ...ctx } }); break;
      case 'heirBorn': { const h = HOUSES[s.crown]; const sex = rng() < 0.5 ? 'm' : 'f'; s.dynasty.heirs.push({ id: s.nextId++, name: pick(rng, h.names[sex]), sex, born: yearOf(s.turn), gift: pick(rng, [...SKILLS]) }); break; }
      case 'heirGift': { const h = heirOf(s.dynasty); if (h) h.gift = e[1] as Skill; break; }
      case 'rulerFrail': s.dynasty.ruler.frail = (s.dynasty.ruler.frail ?? 0) + e[1]; break;
      case 'consortDies': if (s.dynasty.consort?.from) s.dynasty.ties = s.dynasty.ties.filter((t) => t !== s.dynasty.consort!.from); s.dynasty.consort = null; break;
      case 'special': special(e[1], w, s, ctx); break;
    }
  }
}

// ---------- telling ----------

/** How much a kind of story matters just now: stories follow what the player is doing. */
function relevance(w: World, s: GameState, f: Family): number {
  switch (f) {
    case 'sea': return Math.min(2.5, 0.5 + 0.5 * s.fleets.filter((x) => !x.at).length);
    case 'colonies': return Math.min(2.5, 0.6 + 0.4 * s.colonies.length);
    case 'peoples': return Math.min(2.5, 0.6 + 0.3 * allNations(w).filter((n) => s.natives[n.id]?.met).length);
    case 'crowns': return 1 + rivalsOf(s.crown).filter((r) => s.rivals[r.id].relation === 'war').length;
    case 'history': return 4;
    default: return 1;
  }
}

/** The choices open now, by their place in the story's list. */
const open = (s: GameState, def: StoryDef, rng: Rng) => def.choices.map((c, i) => ({ c, i })).filter(({ c }) => (c.need ?? []).every((n) => holds(s, n, rng)));

function card(w: World, s: GameState, def: StoryDef, ctx: Ctx, rng: Rng): GameEvent | null {
  const offered = open(s, def, rng);
  if (!offered.length) return null;
  const hex = w.old.ports.find((p) => p.id === crownSpec(s.crown).home)!.hex;
  return {
    kind: 'story', story: def.id, family: def.family, ctx: { ...ctx, c: offered.map((x) => x.i).join(',') },
    title: fill(def.title, w, s, ctx), text: fill(def.text, w, s, ctx), map: 'old', hex,
    choices: offered.map(({ c }) => ({ label: fill(c.label, w, s, ctx), hint: hintOf(c, w, s, ctx) })),
  };
}

/** The people, ships and places a follow-up was about must still be there. */
function stillThere(s: GameState, ctx: Ctx) {
  if (ctx.courtier != null && !personById(s, Number(ctx.courtier))?.alive) return false;
  if (ctx.other != null && !personById(s, Number(ctx.other))?.alive) return false;
  if (ctx.fleet != null && !s.fleets.some((f) => f.id === ctx.fleet)) return false;
  if (ctx.colony != null && !s.colonies.some((c) => c.id === ctx.colony)) return false;
  return true;
}

/** Subjects for a story as things stand, ignoring its conditions: for tests and tools. */
export function bindFor(w: World, s: GameState, id: string, rng: Rng): Ctx | null {
  const def = BY_ID.get(id);
  return def ? bind(w, s, def.about, rng) : null;
}

/** Tell a story now, by name: for follow-ups and for the rules (a courtier about to leave). */
export function tell(w: World, s: GameState, id: string, ctx: Ctx, ev: (e: GameEvent) => void): boolean {
  const def = BY_ID.get(id);
  if (!def || !stillThere(s, ctx)) return false;
  const e = card(w, s, def, { n: 0, ...ctx }, mulberry32(hashSeed(s.seed, s.turn, 107)));
  if (!e) return false;
  s.told[id] = s.turn;
  ev(e);
  return true;
}

/** Perhaps tell a story this season. */
export function maybeStory(w: World, s: GameState, ev: (e: GameEvent) => void) {
  if (s.events.some((e) => e.kind === 'story')) return;
  const due = s.pending.find((p) => p.at <= s.turn);
  if (due) {
    s.pending = s.pending.filter((p) => p !== due);
    if (tell(w, s, due.story, due.ctx, ev)) return;
  }
  const rng = mulberry32(hashSeed(s.seed, s.turn, 101));
  if (s.turn < STORY_PACE.quietStart || rng() > STORY_PACE.chance) return;
  const ready = STORIES.filter((d) => !d.chained && (s.told[d.id] == null || (d.again != null && s.turn - s.told[d.id] >= d.again)));
  const found: { def: StoryDef; ctx: Ctx; w: number }[] = [];
  for (const def of ready) {
    if (!(def.when ?? []).every((c) => holds(s, c, rng))) continue;
    const ctx = bind(w, s, def.about, rng);
    if (ctx) found.push({ def, ctx, w: (def.weight ?? 1) * relevance(w, s, def.family) });
  }
  // a story not yet told always comes before one that has been
  const fresh = found.filter((x) => s.told[x.def.id] == null);
  const pool = fresh.length ? fresh : found;
  if (!pool.length || (!fresh.length && rng() > STORY_PACE.retold)) return;
  let roll = rng() * pool.reduce((t, x) => t + x.w, 0);
  const chosen = pool.find((x) => (roll -= x.w) <= 0) ?? pool[0];
  const e = card(w, s, chosen.def, chosen.ctx, rng);
  if (!e) return;
  s.told[chosen.def.id] = s.turn;
  ev(e);
}

/** The player chose an option on the story card at the front of the queue. */
export function resolveStory(w: World, s: GameState, index: number, log: Log): { ok: true; message?: string } | { ok: false; error: string } {
  const e = s.events[0];
  if (!e || e.kind !== 'story') return { ok: false, error: 'No story to answer.' };
  s.events.shift();
  if (e.story?.startsWith('era:')) {
    const out = chooseEraPath(w, s, e.story.slice(4), index);
    if (out) log('court', out);
    return { ok: true, message: out || undefined };
  }
  const def = e.story ? BY_ID.get(e.story) : undefined;
  if (!def) return { ok: true };
  const ctx = e.ctx ?? {};
  const offered = String(ctx.c ?? '').split(',').filter(Boolean).map(Number);
  const ch = def.choices[offered[index] ?? index];
  if (!ch) return { ok: true };
  const rng = mulberry32(hashSeed(s.seed, s.turn, index, 103));
  let out: Outcome = ch;
  if (ch.roll && ch.else) {
    const [who, k, base, per] = ch.roll;
    const pts = who === 'ruler' ? (!s.dynasty.regency && s.dynasty.ruler.gift === k ? 3 : 1) : who === 'none' ? 0 : skill(person(s, ctx, who), k as Skill);
    if (rng() >= base + per * pts) out = ch.else;
  }
  // words first, while everyone they name is still here
  const text = fill(out.text, w, s, ctx);
  carry(out.effects, w, s, ctx, rng);
  log('court', `${e.title}: ${text}`);
  return { ok: true, message: text };
}
