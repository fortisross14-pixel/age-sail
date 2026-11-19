/**
 * Stories: event cards with choices, in the spirit of Old World. Each has a condition (who or what it is about),
 * a few options, and consequences. One may come in any season; none repeats too soon.
 */
import { SHIPS } from '../data/ships';
import { SKILLS, yearOf, type EventChoice, type GameEvent, type GameState, type Person, type World, type Skill } from './types';
import { mulberry32, hashSeed, int, pick, type Rng } from './rng';
import { personById, skill } from './court';
import { rivalSpec, type CrownId } from '../data/rivals';
import { GRIDS } from './hex';
import { Fog } from './types';
import { allNations } from './natives';

type Log = (kind: 'discovery' | 'peril' | 'court' | 'trade', text: string) => void;
type Ctx = Record<string, string | number>;

interface Story {
  id: string;
  /** seasons before it can come again */
  cooldown: number;
  when: (w: World, s: GameState, rng: Rng) => Ctx | null;
  title: (s: GameState, c: Ctx) => string;
  text: (s: GameState, c: Ctx, w: World) => string;
  choices: (s: GameState, c: Ctx) => (EventChoice & { apply: (w: World, s: GameState, c: Ctx, rng: Rng, log: Log) => string })[];
}

const atCourt = (s: GameState) => s.people.filter((p) => p.alive && p.fleet == null && !s.parties.some((x) => x.leader === p.id) && p.rank !== 'governor');
const person = (s: GameState, c: Ctx, k = 'person') => personById(s, Number(c[k])) as Person;
const sevilla = (w: World) => w.old.ports.find((p) => p.id === 'seville')!.hex;
const bump = (p: Person, k: Skill, d: number) => { p.skills[k] = Math.max(0, Math.min(5, p.skills[k] + d)); };

const STORIES: Story[] = [
  {
    id: 'mutiny', cooldown: 16,
    when: (_w, s) => {
      const f = s.fleets.find((x) => !x.at && x.supplies <= 2 && x.leader != null);
      return f ? { fleet: f.id, person: f.leader! } : null;
    },
    title: () => 'Mutiny brewing',
    text: (s, c) => { const f = s.fleets.find((x) => x.id === c.fleet); return `With food running short, the crews of ${f?.name ?? 'the fleet'} gather at the mast. They want to turn back, and they want it now. ${person(s, c).name} must answer them.`; },
    choices: () => [
      { label: 'Hang the ringleaders', hint: 'Military decides how it ends', apply: (_w, s, c, rng) => {
        const f = s.fleets.find((x) => x.id === c.fleet); const p = person(s, c);
        if (!f) return 'The moment passes.';
        if (rng() < 0.4 + skill(p, 'military') * 0.12) return `${p.name} hangs two sailors from the yard. The rest go back to work, silent.`;
        const lost = Math.ceil(f.crew * 0.2); f.crew -= lost;
        return `The hanging sparks a fight on deck. ${lost} sailors die before order returns.`;
      } },
      { label: 'Promise them a share of the profits', hint: '−300 ducats', apply: (_w, s) => { s.treasury -= 300; return 'Promises of silver quiet the crews, for now.'; } },
      { label: 'Give in, and turn back', hint: 'The fleet drops its orders', apply: (_w, s, c) => { const f = s.fleets.find((x) => x.id === c.fleet); if (f) f.order = null; return 'The fleet stops where it is and waits for new orders.'; } },
    ],
  },
  {
    id: 'plague', cooldown: 40,
    when: (_w, _s, rng) => (rng() < 0.3 ? {} : null),
    title: () => 'Plague in Sevilla',
    text: () => 'Sickness has come up the river with a ship from the south. The physicians fear it will spread through the city.',
    choices: () => [
      { label: 'Close the port', hint: 'No taxes from Sevilla this season; the yards stop', apply: (_w, s) => {
        s.treasury -= 160; const c = s.cities.seville; if (c.project) c.project.turnsLeft++;
        return 'The port is closed. The plague burns out in a few weeks, and trade resumes.';
      } },
      { label: 'Keep trade moving', hint: 'Someone at court may fall ill', apply: (_w, s, _c, rng) => {
        const p = atCourt(s).filter((x) => x.trait !== 'hardy');
        if (p.length && rng() < 0.5) { const v = pick(rng, p); v.alive = false; v.died = s.turn; return `Trade goes on, and the plague takes ${v.name}.`; }
        return 'Trade goes on. The plague takes some of the poor quarters, and passes.';
      } },
    ],
  },
  {
    id: 'quarrel', cooldown: 20,
    when: (_w, s, rng) => {
      const p = atCourt(s);
      if (p.length < 4) return null;
      const a = pick(rng, p), b = pick(rng, p.filter((x) => x !== a));
      return { a: a.id, b: b.id };
    },
    title: () => 'A quarrel at court',
    text: (s, c) => `${person(s, c, 'a').name} and ${person(s, c, 'b').name} have come to blows over precedence at a banquet. The whole court is watching to see whom you favour.`,
    choices: (s, c) => [
      { label: `Favour ${personById(s, Number(c.a))?.name.split(' ')[0]}`, hint: 'The other leaves court', apply: (_w, st, cc) => { const b = person(st, cc, 'b'); st.people = st.people.filter((x) => x !== b); bump(person(st, cc, 'a'), 'diplomacy', 1); return `${b.name} leaves court in a rage.`; } },
      { label: `Favour ${personById(s, Number(c.b))?.name.split(' ')[0]}`, hint: 'The other leaves court', apply: (_w, st, cc) => { const a = person(st, cc, 'a'); st.people = st.people.filter((x) => x !== a); bump(person(st, cc, 'b'), 'diplomacy', 1); return `${a.name} leaves court in a rage.`; } },
      { label: 'Fine them both', hint: '+200 ducats, −5 prestige', apply: (_w, st) => { st.treasury += 200; st.prestige -= 5; return 'Both pay a fine to the treasury. Neither forgives you.'; } },
    ],
  },
  {
    id: 'bankers', cooldown: 30,
    when: (_w, s) => (s.treasury < 1500 ? {} : null),
    title: () => 'The Genoese bankers',
    text: () => 'Bankers from Genova offer the Crown a loan of 4,000 ducats, repaid at 150 a season for ten years.',
    choices: () => [
      { label: 'Take the loan', hint: '+4,000 now, −150 a season for 40 seasons', apply: (_w, s) => { s.treasury += 4000; s.loans.push({ perSeason: 150, left: 40 }); return 'The money arrives in Sevilla in sealed chests.'; } },
      { label: 'Refuse', apply: () => 'The bankers bow and leave.' },
    ],
  },
  {
    id: 'scholar', cooldown: 24,
    when: (_w, s, rng) => { const p = atCourt(s); return p.length ? { person: pick(rng, p).id, skill: pick(rng, SKILLS) } : null; },
    title: () => 'A learned visitor',
    text: (s, c) => `A scholar from Salamanca offers to teach at court. ${person(s, c).name} is eager to study ${String(c.skill)} with him.`,
    choices: (s, c) => [
      { label: 'Pay for the lessons', hint: `−400 ducats, ${personById(s, Number(c.person))?.name.split(' ')[0]} +1 ${String(c.skill)}`, apply: (_w, st, cc) => { st.treasury -= 400; bump(person(st, cc), cc.skill as Skill, 1); return `${person(st, cc).name} studies all winter and comes out wiser.`; } },
      { label: 'Ask him to teach the scholars instead', hint: '−400 ducats, +15 research', apply: (_w, st) => { st.treasury -= 400; st.research.pending += 15; return 'The court’s scholars fill notebooks with his lectures.'; } },
      { label: 'Send him away', apply: () => 'The scholar goes on to Lisboa.' },
    ],
  },
  {
    id: 'pilot', cooldown: 30,
    when: (w, s, rng) => {
      const map = s.newWorldFound && rng() < 0.6 ? 'new' : 'old';
      const unknown = [...Array(GRIDS[map].N).keys()].filter((i) => s.fog[map][i] === Fog.Unknown && !(map === 'old' && GRIDS.old.lat(i) > 28) && w[map].terrain[i] > 1);
      return unknown.length > 50 ? { map, hex: pick(rng, unknown) } : null;
    },
    title: () => 'A pilot’s secret',
    text: (_s, c) => `An old pilot in the taverns of Sevilla says he has seen coasts no chart shows, ${c.map === 'new' ? 'far across the ocean' : 'down the African coast'}. For a price he will draw them.`,
    choices: () => [
      { label: 'Buy his chart', hint: '−300 ducats', apply: (_w, s, c) => {
        s.treasury -= 300;
        const map = c.map as 'old' | 'new';
        for (const h of GRIDS[map].within(Number(c.hex), 6)) if (s.fog[map][h] < Fog.Charted) s.fog[map][h] = Fog.Charted;
        return 'His chart is rough, but true: a stretch of unknown coast is now on your maps.';
      } },
      { label: 'Laugh him out of the room', apply: () => 'The pilot spits, and goes looking for a Portuguese buyer.' },
    ],
  },
  {
    id: 'charter_plea', cooldown: 16,
    when: (_w, s) => { const c = s.colonies.find((x) => x.loyalty < 55 && !x.charter && x.pop >= 3); return c ? { colony: c.id } : null; },
    title: (s, c) => `A petition from ${s.colonies.find((x) => x.id === c.colony)?.name}`,
    text: (s, c) => `The settlers of ${s.colonies.find((x) => x.id === c.colony)?.name} send a petition: they ask for a council of their own, and lighter taxes.`,
    choices: () => [
      { label: 'Grant a royal charter', hint: 'Loyalty up; half taxes from this colony', apply: (_w, s, c) => { const col = s.colonies.find((x) => x.id === c.colony); if (col) { col.charter = true; col.loyalty = Math.min(100, col.loyalty + 20); } return 'The settlers ring the church bells for the King.'; } },
      { label: 'Send gifts and a kind letter', hint: '−400 ducats, loyalty up a little', apply: (_w, s, c) => { s.treasury -= 400; const col = s.colonies.find((x) => x.id === c.colony); if (col) col.loyalty = Math.min(100, col.loyalty + 10); return 'The settlers are pleased, but not satisfied.'; } },
      { label: 'Refuse', hint: 'Loyalty falls', apply: (_w, s, c) => { const col = s.colonies.find((x) => x.id === c.colony); if (col) col.loyalty -= 12; return 'The petition is read aloud in the colony square and torn up.'; } },
    ],
  },
  {
    id: 'survivors', cooldown: 24,
    when: (_w, s, rng) => { const f = s.fleets.find((x) => !x.at); return f && rng() < 0.5 ? { fleet: f.id, crown: pick(rng, ['portugal', 'england', 'netherlands']) } : null; },
    title: () => 'Survivors at sea',
    text: (s, c) => `${s.fleets.find((x) => x.id === c.fleet)?.name ?? 'One of your fleets'} finds a boat of survivors from a wrecked ship of ${rivalSpec(c.crown as CrownId).name}, half dead from thirst.`,
    choices: () => [
      { label: 'Take them aboard and send them home', hint: 'Their crown thinks better of you', apply: (_w, s, c) => { s.rivals[c.crown as CrownId].attitude += 15; return 'The survivors are landed at the next port with food and a letter of courtesy.'; } },
      { label: 'Hold them for ransom', hint: '+400 ducats; their crown is angered', apply: (_w, s, c) => { s.treasury += 400; s.rivals[c.crown as CrownId].attitude -= 20; return 'Their families pay. Their King does not forget.'; } },
    ],
  },
  {
    id: 'envoys', cooldown: 20,
    when: (w, s, rng) => { const n = allNations(w).filter((x) => s.natives[x.id]?.met && s.natives[x.id].relation === 'peace'); return n.length ? { nation: pick(rng, n).id } : null; },
    title: () => 'Envoys from across the sea',
    text: (_s, c, w) => { const n = allNations(w).find((x) => x.id === c.nation)!; return `Envoys of the ${n.people} have come aboard one of your ships, with gifts of feathers and gold, asking what the strangers want in their land.`; },
    choices: () => [
      { label: 'Exchange gifts and swear friendship', hint: '−200 ducats; they think better of you', apply: (_w, s, c) => { s.treasury -= 200; s.natives[String(c.nation)].attitude += 20; return 'The envoys leave with mirrors, cloth and a sword for their chief.'; } },
      { label: 'Ask them to guide your explorers', hint: 'Their lands are charted', apply: (w, s, c) => { const n = allNations(w).find((x) => x.id === c.nation)!; for (const h of [n.siteHex, ...n.villages].flatMap((v) => GRIDS[n.map].within(v, 3))) if (s.fog[n.map][h] < Fog.Explored) s.fog[n.map][h] = Fog.Explored; return 'They draw their country in the sand: rivers, villages, mountains.'; } },
      { label: 'Send them away', hint: 'They are offended', apply: (_w, s, c) => { s.natives[String(c.nation)].attitude -= 15; return 'The envoys leave in silence.'; } },
    ],
  },
  {
    id: 'armada', cooldown: 999,
    when: (_w, s) => (yearOf(s.turn) >= 1586 && yearOf(s.turn) <= 1590 ? {} : null),
    title: () => 'The Great Armada',
    text: () => 'The King is gathering a great fleet against England and demands that every lord of the sea contribute.',
    choices: (s) => {
      const g = s.fleets.find((f) => f.at === 'seville' && f.ships.some((x) => x.type === 'galleon'));
      return [
        ...(g ? [{ label: 'Send a galleon', hint: 'Lose the ship; +40 prestige; war with England', apply: (_w: World, st: GameState) => { const f = st.fleets.find((x) => x.id === g.id)!; const ship = f.ships.find((x) => x.type === 'galleon')!; f.ships = f.ships.filter((x) => x !== ship); if (!f.ships.length) st.fleets = st.fleets.filter((x) => x !== f); st.prestige += 40; st.rivals.england.relation = 'war'; st.rivals.england.warSince = st.turn; return `The ${ship.name} sails with the Armada. She does not come back, but the King remembers who answered.`; } }] : []),
        { label: 'Pay the levy', hint: '−3,000 ducats', apply: (_w, st) => { st.treasury -= 3000; return 'Your ducats pay for cannon and biscuit.'; } },
        { label: 'Plead poverty', hint: '−30 prestige', apply: (_w, st) => { st.prestige -= 30; return 'The King’s secretary writes your name in a short, cold list.'; } },
      ];
    },
  },
  {
    id: 'prices', cooldown: 999,
    when: (_w, s) => (yearOf(s.turn) >= 1550 && s.finds.some((f) => f.resource === 'silver' || f.resource === 'gold') ? {} : null),
    title: () => 'The price revolution',
    text: () => 'So much gold and silver has come from beyond the sea that prices rise all over Castile. Bread, cloth and timber cost more every year.',
    choices: () => [
      { label: 'So be it', hint: 'European staples cost a third more', apply: (_w, s) => {
        for (const id of ['seville', 'cadiz']) for (const g of ['tools', 'timber', 'cloth', 'wine', 'food', 'stone'] as const) { const m = s.markets[id]?.[g]; if (m) m.base = Math.round(m.base * 1.33); }
        return 'The price of everything in Sevilla and Cádiz rises.';
      } },
    ],
  },
  {
    id: 'marriage', cooldown: 24,
    when: (_w, s, rng) => { const p = atCourt(s).filter((x) => yearOf(s.turn) - x.born < 40); return p.length ? { person: pick(rng, p).id } : null; },
    title: () => 'A match proposed',
    text: (s, c) => `A great house of Toledo proposes a marriage for ${person(s, c).name}. It would bring lands and friends at court, and a larger household to keep.`,
    choices: () => [
      { label: 'Bless the match', hint: '+10 prestige; their salary rises', apply: (_w, s, c) => { s.prestige += 10; const p = person(s, c); p.trait = 'ambitious'; return `${p.name} marries with all the court in attendance.`; } },
      { label: 'Forbid it', hint: 'They may leave court', apply: (_w, s, c, rng) => { const p = person(s, c); if (rng() < 0.4) { s.people = s.people.filter((x) => x !== p); return `${p.name} leaves court to marry anyway.`; } return `${p.name} obeys, unhappily.`; } },
    ],
  },
];

/** Perhaps tell a story this season. */
export function maybeStory(w: World, s: GameState, ev: (e: GameEvent) => void) {
  if (s.events.some((e) => e.kind === 'story')) return;
  const rng = mulberry32(hashSeed(s.seed, s.turn, 101));
  if (s.turn < 3 || rng() > 0.3) return;
  const ready = STORIES.filter((st) => s.turn - (s.told[st.id] ?? -999) >= st.cooldown);
  for (const st of [...ready].sort(() => rng() - 0.5)) {
    const ctx = st.when(w, s, rng);
    if (!ctx) continue;
    s.told[st.id] = s.turn;
    ev({
      kind: 'story', story: st.id, ctx, title: st.title(s, ctx), text: st.text(s, ctx, w), map: 'old', hex: sevilla(w),
      choices: st.choices(s, ctx).map(({ label, hint }) => ({ label, hint })),
    });
    return;
  }
}

/** The player chose an option on the story card at the front of the queue. */
export function resolveStory(w: World, s: GameState, index: number, log: Log): { ok: true; message?: string } | { ok: false; error: string } {
  const e = s.events[0];
  if (!e || e.kind !== 'story') return { ok: false, error: 'No story to answer.' };
  const st = STORIES.find((x) => x.id === e.story);
  const ch = st?.choices(s, e.ctx ?? {})[index];
  s.events.shift();
  if (!st || !ch) return { ok: true };
  const rng = mulberry32(hashSeed(s.seed, s.turn, index, 103));
  const out = ch.apply(w, s, e.ctx ?? {}, rng, log);
  log('court', `${e.title}: ${out}`);
  return { ok: true, message: out };
}

void SHIPS; void int;
