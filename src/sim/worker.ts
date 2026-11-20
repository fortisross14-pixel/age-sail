/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { GoodId } from '../data/goods';
import type { TechId } from '../data/tech';
import type { CrownId } from '../data/rivals';
import { generateWorld } from './mapgen';
import { previewParty } from './land';
import * as G from './game';
import { DEFAULT_UNTIL } from '../data/eras';
import type { GameState, World, ProjectKind, Rank, UnitType, TradeRoute, Stance } from './types';

export type Command =
  | { kind: 'buy'; fleet: number; good: GoodId; qty: number }
  | { kind: 'sell'; fleet: number; good: GoodId; qty: number }
  | { kind: 'provision'; fleet: number }
  | { kind: 'repair'; fleet: number }
  | { kind: 'move'; fleet: number; hex: number }
  | { kind: 'cross'; fleet: number }
  | { kind: 'cancelOrder'; fleet: number }
  | { kind: 'project'; city: string; project: ProjectKind }
  | { kind: 'assignLeader'; person: number; fleet: number }
  | { kind: 'recall'; fleet: number }
  | { kind: 'promote'; person: number; rank: Rank; unit?: UnitType; city?: string }
  | { kind: 'relieve'; person: number }
  | { kind: 'hire'; person: number }
  | { kind: 'embark'; unit: number; fleet: number }
  | { kind: 'disembark'; unit: number }
  | { kind: 'tradeRoute'; fleet: number; route: TradeRoute | null }
  | { kind: 'merge'; from: number; into: number }
  | { kind: 'split'; fleet: number; ship: number }
  | { kind: 'rename'; fleet: number; name: string }
  | { kind: 'research'; tech: TechId }
  | { kind: 'land'; fleet: number; hex: number; leader: boolean }
  | { kind: 'moveParty'; party: number; hex: number }
  | { kind: 'boardParty'; party: number; fleet: number }
  | { kind: 'stopParty'; party: number }
  | { kind: 'found'; party: number }
  | { kind: 'upgradeColony'; colony: string }
  | { kind: 'colonyTransfer'; fleet: number; good: GoodId; qty: number }
  | { kind: 'settle'; fleet: number }
  | { kind: 'gift'; nation: string; ducats: number }
  | { kind: 'ally'; nation: string }
  | { kind: 'incite'; nation: string; target: string }
  | { kind: 'peace'; nation: string }
  | { kind: 'incorporate'; nation: string }
  | { kind: 'tradingPost'; fleet: number }
  | { kind: 'mission'; fleet?: number; party?: number }
  | { kind: 'attack'; party: number; hex: number; stance?: Stance }
  | { kind: 'walls'; colony: string }
  | { kind: 'declareWar'; crown: CrownId }
  | { kind: 'charter'; colony: string }
  | { kind: 'festival'; colony: string }
  | { kind: 'taxRate'; rate: 'low' | 'normal' | 'high' }
  | { kind: 'choose'; index: number }
  | { kind: 'retake'; party: number; free: string; stance?: Stance }
  | { kind: 'rivalPeace'; crown: CrownId }
  | { kind: 'storm'; party: number; colony: string; stance?: Stance }
  | { kind: 'dismissEvent' };

let world: World | null = null;
let state: GameState | null = null;

function need() {
  if (!world || !state) throw new Error('No game loaded');
  return { world, state };
}

const api = {
  newGame(seed: number, until: number = DEFAULT_UNTIL, crown: CrownId = 'spain') {
    const g = G.newGame(seed, until, crown);
    world = g.world;
    state = g.state;
    return g;
  },
  load(saved: GameState) {
    world = generateWorld(saved.seed, saved.crown);
    state = saved;
    return { world, state };
  },
  preview(fleet: number, hex: number) {
    const { world, state } = need();
    return G.previewMove(world, state, fleet, hex);
  },
  previewParty(party: number, hex: number) {
    const { world, state } = need();
    const p = state.parties.find((x) => x.id === party);
    return p ? previewParty(world, state, p, hex) : null;
  },
  command(c: Command): { result: G.CommandResult; state: GameState } {
    const { world, state } = need();
    let result: G.CommandResult;
    switch (c.kind) {
      case 'buy': result = G.buy(world, state, c.fleet, c.good, c.qty); break;
      case 'sell': result = G.sell(world, state, c.fleet, c.good, c.qty); break;
      case 'provision': result = G.provision(world, state, c.fleet); break;
      case 'repair': result = G.repair(world, state, c.fleet); break;
      case 'move': result = G.moveFleet(world, state, c.fleet, c.hex); break;
      case 'cross': result = G.crossOcean(world, state, c.fleet); break;
      case 'cancelOrder': result = G.cancelOrder(state, c.fleet); break;
      case 'project': result = G.startProject(state, c.city, c.project); break;
      case 'assignLeader': result = G.assignLeader(state, c.person, c.fleet); break;
      case 'recall': result = G.recall(world, state, c.fleet); break;
      case 'promote': result = G.promote(state, c.person, c.rank, { unit: c.unit, city: c.city }); break;
      case 'relieve': result = G.relieve(state, c.person); break;
      case 'hire': result = G.hire(state, c.person); break;
      case 'embark': result = G.embark(world, state, c.unit, c.fleet); break;
      case 'disembark': result = G.disembark(world, state, c.unit); break;
      case 'tradeRoute': result = G.setTradeRoute(world, state, c.fleet, c.route); break;
      case 'merge': result = G.mergeFleets(state, c.from, c.into); break;
      case 'split': result = G.splitShip(state, c.fleet, c.ship); break;
      case 'rename': result = G.renameFleet(state, c.fleet, c.name); break;
      case 'research': result = G.setResearch(state, c.tech); break;
      case 'land': result = G.landParty(world, state, c.fleet, c.hex, c.leader); break;
      case 'moveParty': result = G.moveParty(world, state, c.party, c.hex); break;
      case 'boardParty': result = G.boardParty(state, c.party, c.fleet); break;
      case 'stopParty': result = G.stopParty(state, c.party); break;
      case 'found': result = G.foundColony(world, state, c.party); break;
      case 'upgradeColony': result = G.upgradeColony(state, c.colony); break;
      case 'colonyTransfer': result = G.colonyTransfer(state, c.fleet, c.good, c.qty); break;
      case 'settle': result = G.settleColonists(state, c.fleet); break;
      case 'gift': result = G.giftNation(world, state, c.nation, c.ducats); break;
      case 'ally': result = G.allyNation(world, state, c.nation); break;
      case 'incite': result = G.inciteNation(world, state, c.nation, c.target); break;
      case 'peace': result = G.peaceNation(world, state, c.nation); break;
      case 'incorporate': result = G.incorporateNation(world, state, c.nation); break;
      case 'tradingPost': result = G.tradingPost(world, state, c.fleet); break;
      case 'mission': result = G.mission(world, state, { fleet: c.fleet, party: c.party }); break;
      case 'attack': result = G.attackVillage(world, state, c.party, c.hex, c.stance); break;
      case 'walls': result = G.buildWalls(state, c.colony); break;
      case 'declareWar': result = G.declareWar(state, c.crown); break;
      case 'charter': result = G.grantCharter(state, c.colony); break;
      case 'festival': result = G.holdFestival(state, c.colony); break;
      case 'taxRate': result = G.setTaxRate(state, c.rate); break;
      case 'choose': result = G.chooseStory(world, state, c.index); break;
      case 'retake': result = G.retakeFree(world, state, c.party, c.free, c.stance); break;
      case 'rivalPeace': result = G.rivalPeace(state, c.crown); break;
      case 'storm': result = G.stormColony(world, state, c.party, c.colony, c.stance); break;
      case 'dismissEvent': state.events.shift(); result = { ok: true }; break;
    }
    return { result, state };
  },
  endTurn() {
    const { world, state } = need();
    G.endTurn(world, state);
    return state;
  },
};

export type SimApi = typeof api;
Comlink.expose(api);
