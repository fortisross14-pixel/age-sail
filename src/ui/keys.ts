/**
 * Every key the game answers to, in one table: the handler in App.tsx and the Controls page of
 * the guide both read it, so what is listed is what works. The player may change most keys
 * (Controls, in the guide); the choice is kept with their other preferences.
 *
 * Layers, from the top: a card that must be answered, the welcome, the End Turn reminder, the
 * guide, the ledger, saves, an open screen, the map. A key acts on the topmost layer only. Keys
 * are ignored while typing in a field and while Ctrl or Cmd is held (those belong to the browser).
 */
import type { DrawerId } from '../store';
import { pref, setPref } from './prefs';

export type KeyWhere = 'map' | 'screen' | 'anywhere';
export interface KeyDef {
  id: string;
  /** `KeyboardEvent.key`, lower case; several keys may do the same thing */
  keys: string[];
  label: string;
  group: 'The map' | 'Turns and orders' | 'Screens' | 'Cards';
  /** where it works: on the bare map, with a screen open, or both */
  where: KeyWhere;
  action: string;
  screen?: DrawerId;
  /** cannot be changed: held keys read by the map itself, and the keys of cards */
  fixed?: boolean;
}

const screen = (n: number, id: DrawerId, label: string): KeyDef => ({ id: `screen-${id}`, keys: [String(n)], label, group: 'Screens', where: 'anywhere', action: 'screen', screen: id });

export const KEYS: KeyDef[] = [
  { id: 'pan', keys: ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'], label: 'Move the map (or drag it, or rest the pointer at the screen’s edge)', group: 'The map', where: 'map', action: 'pan', fixed: true },
  { id: 'zoomIn', keys: ['+', '='], label: 'Zoom in (or the wheel, or a pinch)', group: 'The map', where: 'map', action: 'zoomIn' },
  { id: 'zoomOut', keys: ['-', '_'], label: 'Zoom out', group: 'The map', where: 'map', action: 'zoomOut' },
  { id: 'map', keys: ['m'], label: 'The other map: Old World or New', group: 'The map', where: 'map', action: 'map' },
  { id: 'home', keys: ['c'], label: 'Back to your capital', group: 'The map', where: 'map', action: 'home' },
  { id: 'mode', keys: ['o'], label: 'What the map shows: realms, finds, peoples, loyalty', group: 'The map', where: 'map', action: 'mode' },
  { id: 'wind', keys: ['v'], label: 'Show the winds', group: 'The map', where: 'map', action: 'wind' },
  { id: 'grid', keys: ['g'], label: 'Show the hex grid', group: 'The map', where: 'map', action: 'grid' },
  { id: 'highlight', keys: ['alt'], label: 'Hold to highlight everything you can click', group: 'The map', where: 'map', action: 'highlight', fixed: true },

  { id: 'endTurn', keys: ['enter'], label: 'End the turn (it asks first if something urgent is undone)', group: 'Turns and orders', where: 'map', action: 'endTurn' },
  { id: 'sail', keys: [' '], label: 'Sail the course you have planned', group: 'Turns and orders', where: 'map', action: 'sail' },
  { id: 'nextFleet', keys: ['tab'], label: 'Next fleet', group: 'Turns and orders', where: 'map', action: 'nextFleet' },
  { id: 'nextNeed', keys: ['n'], label: 'Next thing that needs you', group: 'Turns and orders', where: 'anywhere', action: 'nextNeed' },
  { id: 'undo', keys: ['z'], label: 'Take back your last order', group: 'Turns and orders', where: 'anywhere', action: 'undo' },
  { id: 'escape', keys: ['escape'], label: 'Cancel a plan, close a screen, deselect', group: 'Turns and orders', where: 'anywhere', action: 'escape', fixed: true },

  screen(1, 'cities', 'Cities'), screen(2, 'markets', 'Markets'), screen(3, 'fleets', 'Fleets'), screen(4, 'court', 'Court'),
  screen(5, 'diplomacy', 'Diplomacy'), screen(6, 'research', 'Research'), screen(7, 'chronicle', 'Chronicle'),
  { id: 'ledger', keys: ['l'], label: 'The ledger: what came in and went out', group: 'Screens', where: 'anywhere', action: 'ledger' },
  { id: 'help', keys: ['h', '?'], label: 'This guide', group: 'Screens', where: 'anywhere', action: 'help' },

  { id: 'card', keys: ['enter', 'escape'], label: 'Continue, on a card with nothing to choose', group: 'Cards', where: 'anywhere', action: 'card', fixed: true },
  { id: 'cardPick', keys: ['1', '2', '3', '4'], label: 'Choose that option on a card', group: 'Cards', where: 'anywhere', action: 'card', fixed: true },
];

/** The keys a row answers to now: the player's own, or the ones it came with. */
export const keysOf = (d: KeyDef): string[] => (d.fixed ? d.keys : pref('keys')[d.id] ?? d.keys);
const NAMES: Record<string, string> = { ' ': 'Space', enter: 'Enter', escape: 'Esc', tab: 'Tab', alt: 'Alt', arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→', '-': '−', '_': '' , '=': '' };
/** How a key is shown on a key cap. */
export const keyName = (k: string) => (k in NAMES ? NAMES[k] : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));
export const keyCaps = (d: KeyDef) => (d.id === 'pan' ? ['W', 'A', 'S', 'D', 'arrows'] : keysOf(d).map(keyName).filter(Boolean));

const reaches = (d: KeyDef, where: 'map' | 'screen') => d.where === 'anywhere' || d.where === where;
export const keyDef = (key: string, where: 'map' | 'screen') => KEYS.find((k) => k.group !== 'Cards' && keysOf(k).includes(key) && reaches(k, where));

/** Give a row a new key. Refused if another row that works in the same place already has it. */
export function rebind(id: string, key: string): string | null {
  const d = KEYS.find((k) => k.id === id);
  if (!d || d.fixed) return 'That key cannot be changed.';
  if (['escape', 'control', 'meta', 'shift', 'alt'].includes(key)) return 'That key is kept for other things.';
  const clash = KEYS.find((k) => k.id !== id && k.group !== 'Cards' && keysOf(k).includes(key) && (k.where === 'anywhere' || d.where === 'anywhere' || k.where === d.where));
  if (clash) return `${keyName(key)} already does “${clash.label}”.`;
  setPref('keys', { ...pref('keys'), [id]: [key] });
  return null;
}
export function resetKeys() { setPref('keys', {}); }
