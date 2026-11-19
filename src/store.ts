import { create } from 'zustand';
import * as Comlink from 'comlink';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { SimApi, Command } from './sim/worker';
import type { GameState, World, ChronicleEntry, MapId } from './sim/types';
import type { MovePreview } from './sim/game';

const SAVE_KEY = 'age-sail:save:v8';

const sim = Comlink.wrap<SimApi>(new Worker(new URL('./sim/worker.ts', import.meta.url), { type: 'module' }));

export interface Preview extends MovePreview { fleet: number; dest: number; map: MapId; party?: number }

export type DrawerId = 'cities' | 'markets' | 'fleets' | 'court';

/** A chronicle entry's identity, stable across saves. */
export const newsKey = (c: ChronicleEntry) => `${c.turn}|${c.text}`;

interface Store {
  phase: 'menu' | 'loading' | 'playing';
  hasSave: boolean;
  world: World | null;
  game: GameState | null;
  map: MapId;
  selectedFleet: number | null;
  selectedParty: number | null;
  /** choosing where the selected fleet puts its people ashore */
  landing: { leader: boolean } | null;
  selectedPort: string | null;
  selectedColony: string | null;
  preview: Preview | null;
  hover: { map: MapId; hex: number } | null;
  showWind: boolean;
  showGrid: boolean;
  highlightAll: boolean;
  showHelp: boolean;
  drawer: DrawerId | null;
  courtTab: 'people' | 'petitioners' | 'peoples' | 'crowns' | 'research' | 'chronicle';
  /** news the player has waved away */
  dismissed: string[];
  toast: { text: string; bad?: boolean; id: number } | null;
  busy: boolean;

  checkSave: () => Promise<void>;
  newGame: (seed: number) => Promise<void>;
  continueGame: () => Promise<void>;
  quitToMenu: () => void;
  run: (c: Command) => Promise<boolean>;
  endTurn: () => Promise<void>;
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

async function save(game: GameState) {
  try { await idbSet(SAVE_KEY, game); } catch { /* storage unavailable: play on without saving */ }
}

/** The New World view opens once someone has sailed there. */
export const newWorldOpen = (g: GameState | null) => !!g && (g.newWorldFound || g.fleets.some((f) => f.map === 'new'));

export const useStore = create<Store>((set, get) => {
  /** Keep the view on the selected fleet when it crosses the ocean. */
  const follow = (state: GameState) => {
    const f = state.fleets.find((x) => x.id === get().selectedFleet);
    if (f && f.map !== get().map) set({ map: f.map, preview: null, selectedPort: null });
  };
  return {
    phase: 'menu', hasSave: false, world: null, game: null, map: 'old', selectedFleet: null, selectedParty: null, landing: null, selectedPort: null, selectedColony: null, preview: null,
    hover: null, showWind: false, showGrid: false, highlightAll: false, showHelp: false,
    drawer: null, courtTab: 'people', dismissed: [], toast: null, busy: false,

    set: (p) => set(p),

    async checkSave() {
      try { set({ hasSave: !!(await idbGet(SAVE_KEY)) }); } catch { set({ hasSave: false }); }
    },

    async newGame(seed) {
      set({ phase: 'loading' });
      const { world, state } = await sim.newGame(seed);
      await save(state);
      set({ world, game: state, phase: 'playing', map: 'old', selectedFleet: null, selectedPort: null, preview: null, drawer: null, dismissed: [], showHelp: true });
    },

    async continueGame() {
      const saved = await idbGet<GameState>(SAVE_KEY);
      if (!saved) return;
      set({ phase: 'loading' });
      const { world, state } = await sim.load(saved);
      set({ world, game: state, phase: 'playing', map: 'old', selectedFleet: null, selectedPort: null, preview: null, drawer: null, dismissed: state.chronicle.filter((c) => c.turn < state.turn - 1).map(newsKey) });
    },

    quitToMenu() {
      set({ phase: 'menu', world: null, game: null, preview: null, selectedFleet: null, selectedPort: null });
      void get().checkSave();
    },

    async run(c) {
      const { result, state } = await sim.command(c);
      set({ game: state });
      follow(state);
      void save(state);
      if (!result.ok) get().say(result.error, true);
      else if (result.message) get().say(result.message);
      return result.ok;
    },

    async endTurn() {
      const g = get().game;
      if (!g || get().busy) return;
      set({ busy: true, preview: null });
      const state = await sim.endTurn();
      const sel = get().selectedFleet;
      const keep = sel != null && state.fleets.some((f) => f.id === sel);
      // news older than last season fades from the feed by itself
      const old = state.chronicle.filter((c) => c.turn < state.turn - 1).map(newsKey);
      const psel = get().selectedParty;
      set({ game: state, busy: false, selectedFleet: keep ? sel : null, selectedParty: psel != null && state.parties.some((p) => p.id === psel) ? psel : null, landing: null, dismissed: [...new Set([...get().dismissed.slice(-200), ...old])] });
      follow(state);
      void save(state);
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

export async function clearSave() {
  try { await idbDel(SAVE_KEY); } catch { /* ignore */ }
}
