import { create } from 'zustand';
import * as Comlink from 'comlink';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { DEFAULT_UNTIL } from './data/eras';
import { sfx, type Sfx } from './ui/sound';
import { SAVE_KEY, LEGACY_KEY, STALE_KEYS, wrap, fromLegacy, readSave, type LoadResult } from './save';
import type { SimApi, Command } from './sim/worker';
import type { CrownId } from './data/rivals';
import type { Difficulty } from './data/difficulty';
import { objectiveById, type ObjectiveId } from './data/objectives';
import { rewardOf, rewardText } from './sim/objectives';
import { attention, type Target } from './ui/attention';
import { pref } from './ui/prefs';
import type { GameState, World, ChronicleEntry, MapId } from './sim/types';
import { prevTurnStart, type Stance } from './sim/types';
import type { MovePreview } from './sim/game';

const sim = Comlink.wrap<SimApi>(new Worker(new URL('./sim/worker.ts', import.meta.url), { type: 'module' }));

export interface Preview extends MovePreview { fleet: number; dest: number; map: MapId; party?: number }

export type DrawerId = 'cities' | 'markets' | 'fleets' | 'court' | 'research' | 'chronicle';

/** A chronicle entry's identity, stable across saves. */
export const newsKey = (c: ChronicleEntry) => `${c.turn}|${c.text}`;

interface Store {
  phase: 'menu' | 'loading' | 'playing';
  hasSave: boolean;
  /** why the stored voyage can't be continued, if it can't */
  saveProblem: string | null;
  world: World | null;
  game: GameState | null;
  map: MapId;
  selectedFleet: number | null;
  selectedParty: number | null;
  /** choosing where the selected fleet puts its people ashore */
  landing: { leader: boolean } | null;
  /** how your armies attack: hard, or holding back */
  stance: Stance;
  selectedPort: string | null;
  selectedColony: string | null;
  preview: Preview | null;
  hover: { map: MapId; hex: number } | null;
  showWind: boolean;
  showGrid: boolean;
  highlightAll: boolean;
  showHelp: boolean;
  showSettings: boolean;
  /** the short greeting at the start of a new voyage */
  showWelcome: boolean;
  /** End Turn is asking about things left undone */
  showGuard: boolean;
  /** things the player has already ended a turn past: End Turn does not ask about them again */
  guardSeen: string[];
  drawer: DrawerId | null;
  courtTab: 'people' | 'petitioners' | 'peoples' | 'crowns' | 'research' | 'chronicle';
  /** news the player has waved away */
  dismissed: string[];
  toast: { text: string; bad?: boolean; id: number } | null;
  busy: boolean;

  checkSave: () => Promise<void>;
  newGame: (seed: number, until?: number, crown?: CrownId, difficulty?: Difficulty) => Promise<void>;
  continueGame: () => Promise<void>;
  quitToMenu: () => void;
  run: (c: Command) => Promise<boolean>;
  /** End the turn; unless forced, ask first when something urgent is undone. */
  endTurn: (force?: boolean) => Promise<void>;
  /** Open the screen or select the thing an objective or a reminder points at. */
  goTo: (t: Target) => void;
  selectFleet: (id: number | null) => void;
  selectParty: (id: number | null) => void;
  selectPort: (id: string | null) => void;
  planTo: (hex: number) => Promise<void>;
  confirmPreview: () => Promise<void>;
  setMap: (m: MapId) => void;
  say: (text: string, bad?: boolean) => void;
  set: (p: Partial<Store>) => void;
}

let toastId = 0;

/** The sound each kind of order makes when it succeeds. */
function soundFor(c: Command): Sfx {
  switch (c.kind) {
    case 'buy': case 'sell': case 'gift': case 'provision': case 'repair': case 'colonyTransfer': return 'coins';
    case 'project': return c.project.kind === 'building' || c.project.kind === 'ship' ? 'build' : 'train';
    case 'found': case 'upgradeColony': case 'tradingPost': case 'mission': case 'charter': case 'promote': case 'hire': return 'build';
    case 'move': case 'moveParty': case 'land': case 'cross': return 'select';
    default: return 'select';
  }
}

let saveWarned = false;
async function save(game: GameState) {
  try { await idbSet(SAVE_KEY, wrap(game)); saveWarned = false; } catch {
    // storage unavailable or full: play on, but say so once
    if (!saveWarned) { saveWarned = true; useStore.getState().say('The voyage could not be saved. Progress will be lost when you close the page.', true); }
  }
}

/** Find the stored voyage, upgrading a pre-envelope save and clearing ones no build can read. */
async function loadStored(): Promise<LoadResult | null> {
  let raw = await idbGet(SAVE_KEY);
  if (raw === undefined) {
    const legacy = fromLegacy(await idbGet(LEGACY_KEY));
    if (legacy) { await idbSet(SAVE_KEY, legacy); raw = legacy; }
  }
  // the legacy save is copied by now; older keys can't be read by any build
  void Promise.all([LEGACY_KEY, ...STALE_KEYS].map((k) => idbDel(k))).catch(() => {});
  return raw === undefined ? null : readSave(raw);
}

/** The New World view opens once someone has sailed there. */
export const newWorldOpen = (g: GameState | null) => !!g && (g.newWorldFound || g.fleets.some((f) => f.map === 'new'));

export const useStore = create<Store>((set, get) => {
  /** Keep the view on the selected fleet when it crosses the ocean. */
  const follow = (state: GameState) => {
    const f = state.fleets.find((x) => x.id === get().selectedFleet);
    if (f && f.map !== get().map) set({ map: f.map, preview: null, selectedPort: null });
  };
  /**
   * A worker call threw: the worker's copy may be half-changed, so put back the last state the
   * screen shows (which is also the last one saved) and tell the player.
   */
  const recover = async (what: string, e: unknown) => {
    console.error(`Age of Sail: ${what} failed`, e);
    const g = get().game;
    try { if (g) await sim.load(g); } catch (e2) { console.error('Age of Sail: could not restore the game', e2); }
    set({ busy: false, preview: null, landing: null });
    get().say(`Something went wrong ${what}. The game is back where it was.`, true);
  };
  const startFailed = (e: unknown) => {
    console.error('Age of Sail: could not start the voyage', e);
    set({ phase: 'menu', world: null, game: null, saveProblem: 'The voyage could not be started. Try again, or try another world seed.' });
  };
  return {
    phase: 'menu', hasSave: false, saveProblem: null, world: null, game: null, map: 'old', selectedFleet: null, selectedParty: null, landing: null, stance: 'assault', selectedPort: null, selectedColony: null, preview: null,
    hover: null, showWind: false, showGrid: false, highlightAll: false, showHelp: false, showSettings: false, showWelcome: false, showGuard: false, guardSeen: [],
    drawer: null, courtTab: 'people', dismissed: [], toast: null, busy: false,

    set: (p) => set(p),

    async checkSave() {
      try {
        const r = await loadStored();
        set({ hasSave: !!r?.ok, saveProblem: r && !r.ok ? r.reason : null });
      } catch { set({ hasSave: false, saveProblem: null }); }
    },

    async newGame(seed, until = DEFAULT_UNTIL, crown = 'spain', difficulty = 'captain') {
      set({ phase: 'loading', saveProblem: null });
      let r;
      try { r = await sim.newGame(seed, until, crown, difficulty); } catch (e) { startFailed(e); return; }
      const { world, state } = r;
      await save(state);
      set({ world, game: state, phase: 'playing', map: 'old', selectedFleet: null, selectedPort: null, preview: null, drawer: null, dismissed: [], showHelp: false, showWelcome: true, showGuard: false, guardSeen: [] });
    },

    async continueGame() {
      const r = await loadStored().catch(() => null);
      if (!r?.ok) { set({ hasSave: false, saveProblem: r ? r.reason : null }); return; }
      set({ phase: 'loading' });
      let loaded;
      try { loaded = await sim.load(r.state); } catch (e) { startFailed(e); return; }
      const { world, state } = loaded;
      set({ world, game: state, phase: 'playing', map: 'old', selectedFleet: null, selectedPort: null, preview: null, drawer: null, showWelcome: false, showGuard: false, guardSeen: [], dismissed: state.chronicle.filter((c) => c.turn < prevTurnStart(state.turn)).map(newsKey) });
    },

    quitToMenu() {
      set({ phase: 'menu', world: null, game: null, preview: null, selectedFleet: null, selectedPort: null });
      void get().checkSave();
    },

    async run(c) {
      let out;
      try { out = await sim.command(c); } catch (e) { await recover('with that order', e); return false; }
      const { result, state, achieved } = out;
      set({ game: state });
      follow(state);
      void save(state);
      if (!result.ok) { sfx('error'); get().say(result.error, true); }
      else if (achieved.length) announce(state, achieved);
      else { sfx(soundFor(c)); if (result.message) get().say(result.message); }
      return result.ok;
    },

    async endTurn(force = false) {
      const g = get().game, w = get().world;
      if (!g || !w || get().busy) return;
      // things left undone: ask once about each, then let the turn go
      const urgent = attention(g, w).filter((a) => a.urgent).map((a) => a.id);
      const seen = get().guardSeen.filter((id) => urgent.includes(id));
      if (!force && pref('guard') && urgent.some((id) => !seen.includes(id))) { sfx('open'); set({ showGuard: true, guardSeen: seen }); return; }
      set({ busy: true, preview: null, showGuard: false, guardSeen: urgent });
      sfx('season');
      let state: GameState;
      try { state = await sim.endTurn(); } catch (e) { await recover('while ending the turn', e); return; }
      const sel = get().selectedFleet;
      const keep = sel != null && state.fleets.some((f) => f.id === sel);
      // news from before this turn's seasons fades from the feed by itself
      const old = state.chronicle.filter((c) => c.turn < g.turn).map(newsKey);
      const psel = get().selectedParty;
      set({ game: state, busy: false, selectedFleet: keep ? sel : null, selectedParty: psel != null && state.parties.some((p) => p.id === psel) ? psel : null, landing: null, dismissed: [...new Set([...get().dismissed.slice(-200), ...old])] });
      follow(state);
      void save(state);
      const fresh = (Object.keys(state.objectives.done) as ObjectiveId[]).filter((id) => g.objectives.done[id] == null);
      if (fresh.length) announce(state, fresh);
    },

    goTo(t) {
      const s = get();
      set({ showGuard: false, showHelp: false, showWelcome: false });
      if (t.fleet != null) {
        const f = s.game?.fleets.find((x) => x.id === t.fleet);
        if (f) { set({ drawer: null }); s.selectFleet(f.id); void import('./ui/MapCanvas').then((m) => m.getView()?.focusHex(f.map, f.hex)); }
        return;
      }
      if (t.party != null) {
        const p = s.game?.parties.find((x) => x.id === t.party);
        if (p) { set({ drawer: null }); s.selectParty(p.id); void import('./ui/MapCanvas').then((m) => m.getView()?.focusHex(p.map, p.hex)); }
        return;
      }
      if (t.drawer) {
        sfx('open');
        set({ drawer: t.drawer, ...(t.courtTab ? { courtTab: t.courtTab } : {}), ...(t.colony ? { selectedColony: t.colony, selectedPort: t.colony } : {}) });
      }
    },

    selectFleet(id) {
      const f = get().game?.fleets.find((x) => x.id === id);
      set({ selectedFleet: id, selectedParty: null, landing: null, preview: null, selectedPort: f?.at ?? null, ...(f && f.map !== get().map ? { map: f.map } : {}) });
    },

    selectParty(id) {
      const p = get().game?.parties.find((x) => x.id === id);
      set({ selectedParty: id, selectedFleet: null, landing: null, preview: null, ...(p && p.map !== get().map ? { map: p.map } : {}) });
    },

    selectPort(id) {
      set({ selectedPort: id, preview: null });
    },

    setMap(m) {
      if (m === 'new' && !newWorldOpen(get().game)) {
        get().say('No one has crossed the Mar Océano yet. Send a fleet led by an explorer west.', true);
        return;
      }
      set({ map: m, preview: null, selectedPort: null });
    },

    async planTo(hex) {
      try { await plan(hex); } catch (e) {
        console.error('Age of Sail: route preview failed', e);
        set({ preview: null });
        get().say('Could not plot that course.', true);
      }
    },

    async confirmPreview() {
      const p = get().preview;
      if (!p || p.crossBlocked) return;
      set({ preview: null });
      if (p.party != null) { await get().run({ kind: 'moveParty', party: p.party, hex: p.dest }); return; }
      const ok = await get().run({ kind: 'move', fleet: p.fleet, hex: p.dest });
      if (ok) set({ selectedPort: get().game?.fleets.find((f) => f.id === p.fleet)?.at ?? null });
    },

    say(text, bad) {
      const id = ++toastId;
      set({ toast: { text, bad, id } });
      setTimeout(() => { if (get().toast?.id === id) set({ toast: null }); }, 3400);
    },
  };
});

/** Tell the player what they have just achieved, and what it paid. */
function announce(state: GameState, ids: ObjectiveId[]) {
  const o = objectiveById(ids[0]);
  const paid = rewardText(rewardOf(state, o));
  sfx('build');
  useStore.getState().say(`${o.chain === 'voyage' ? 'First voyage' : 'Ambition fulfilled'}: ${o.title}${ids.length > 1 ? ` (and ${ids.length - 1} more)` : ''}.${paid ? ` +${paid}.` : ''}`);
}

/** Ask the worker for a route preview to a hex for the selected fleet or party. */
async function plan(hex: number) {
  const get = useStore.getState, set = useStore.setState;
  const party = get().game?.parties.find((x) => x.id === get().selectedParty);
  if (party) {
    const lp = await sim.previewParty(party.id, hex);
    if (!lp) { set({ preview: null }); get().say('No way there on foot.', true); return; }
    set({ preview: { ...lp, cost: 0, risk: 0, provision: 0, deep: 0, cross: false, crossBlocked: false, fleet: -1, party: party.id, dest: hex, map: party.map } });
    return;
  }
  const fleet = get().selectedFleet;
  const f = get().game?.fleets.find((x) => x.id === fleet);
  if (fleet == null || !f) return;
  const p = await sim.preview(fleet, hex);
  if (!p) {
    set({ preview: null });
    get().say(f.leader != null ? 'No sea route there.' : 'No charted route there. Only a fleet led by an explorer may sail into unknown waters.', true);
    return;
  }
  if (p.crossBlocked) get().say('No captain will sail into the unknown west without an explorer to lead the way.', true);
  set({ preview: { ...p, fleet, dest: hex, map: f.map } });
}

export async function clearSave() {
  try { await idbDel(SAVE_KEY); } catch { /* ignore */ }
}
