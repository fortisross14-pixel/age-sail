/**
 * Every key the game answers to, in one table: the handler in App.tsx and the Controls page of
 * the guide both read it, so what is listed is what works.
 *
 * Layers, from the top: a card that must be answered, the welcome, the End Turn reminder, the
 * guide, settings, an open screen, the map. A key acts on the topmost layer only. Keys are ignored
 * while typing in a field and while Ctrl or Cmd is held (those belong to the browser).
 */
import type { DrawerId } from '../store';

export type KeyWhere = 'map' | 'screen' | 'anywhere';
export interface KeyDef {
  /** `KeyboardEvent.key`, lower case; several keys may do the same thing */
  keys: string[];
  /** how the keys are shown */
  show: string[];
  label: string;
  group: 'The map' | 'Turns and orders' | 'Screens' | 'Cards';
  /** where it works: on the bare map, with a screen open, or both */
  where: KeyWhere;
  action: string;
}

export const SCREEN_KEYS: Record<string, DrawerId> = { '1': 'cities', '2': 'markets', '3': 'fleets', '4': 'court', '5': 'diplomacy', '6': 'research', '7': 'chronicle' };

export const KEYS: KeyDef[] = [
  { keys: ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'], show: ['W', 'A', 'S', 'D', 'arrows'], label: 'Move the map (or drag it, or rest the pointer at the screen’s edge)', group: 'The map', where: 'map', action: 'pan' },
  { keys: ['+', '='], show: ['+'], label: 'Zoom in (or the wheel, or a pinch)', group: 'The map', where: 'map', action: 'zoomIn' },
  { keys: ['-', '_'], show: ['−'], label: 'Zoom out', group: 'The map', where: 'map', action: 'zoomOut' },
  { keys: ['m'], show: ['M'], label: 'The other map: Old World or New', group: 'The map', where: 'map', action: 'map' },
  { keys: ['c'], show: ['C'], label: 'Back to your capital', group: 'The map', where: 'map', action: 'home' },
  { keys: ['v'], show: ['V'], label: 'Show the winds', group: 'The map', where: 'map', action: 'wind' },
  { keys: ['g'], show: ['G'], label: 'Show the hex grid', group: 'The map', where: 'map', action: 'grid' },
  { keys: ['alt'], show: ['Alt'], label: 'Hold to highlight everything you can click', group: 'The map', where: 'map', action: 'highlight' },

  { keys: ['enter'], show: ['Enter'], label: 'End the turn (it asks first if something urgent is undone)', group: 'Turns and orders', where: 'map', action: 'endTurn' },
  { keys: [' '], show: ['Space'], label: 'Sail the course you have planned', group: 'Turns and orders', where: 'map', action: 'sail' },
  { keys: ['tab'], show: ['Tab'], label: 'Next fleet', group: 'Turns and orders', where: 'map', action: 'nextFleet' },
  { keys: ['n'], show: ['N'], label: 'Next thing that needs you', group: 'Turns and orders', where: 'anywhere', action: 'nextNeed' },
  { keys: ['escape'], show: ['Esc'], label: 'Cancel a plan, close a screen, deselect', group: 'Turns and orders', where: 'anywhere', action: 'escape' },

  { keys: ['1'], show: ['1'], label: 'Cities', group: 'Screens', where: 'anywhere', action: 'screen' },
  { keys: ['2'], show: ['2'], label: 'Markets', group: 'Screens', where: 'anywhere', action: 'screen' },
  { keys: ['3'], show: ['3'], label: 'Fleets', group: 'Screens', where: 'anywhere', action: 'screen' },
  { keys: ['4'], show: ['4'], label: 'Court', group: 'Screens', where: 'anywhere', action: 'screen' },
  { keys: ['5'], show: ['5'], label: 'Diplomacy', group: 'Screens', where: 'anywhere', action: 'screen' },
  { keys: ['6'], show: ['6'], label: 'Research', group: 'Screens', where: 'anywhere', action: 'screen' },
  { keys: ['7'], show: ['7'], label: 'Chronicle', group: 'Screens', where: 'anywhere', action: 'screen' },
  { keys: ['l'], show: ['L'], label: 'The ledger: what came in and went out', group: 'Screens', where: 'anywhere', action: 'ledger' },
  { keys: ['h', '?'], show: ['H'], label: 'This guide', group: 'Screens', where: 'anywhere', action: 'help' },

  { keys: ['enter', 'escape'], show: ['Enter', 'Esc'], label: 'Continue, on a card with nothing to choose', group: 'Cards', where: 'anywhere', action: 'card' },
  { keys: ['1', '2', '3', '4'], show: ['1', '2', '3', '4'], label: 'Choose that option on a card', group: 'Cards', where: 'anywhere', action: 'card' },
];

export const keyDef = (key: string, where: 'map' | 'screen') => KEYS.find((k) => k.group !== 'Cards' && k.keys.includes(key) && (k.where === 'anywhere' || k.where === where));
