import type { CrownId } from '../data/rivals';
import { type Rng, pick, int } from './rng';

// Invented syllables for procedurally generated peoples and places. Not taken from any real language.
const ONSET = ['ta', 'ka', 'ma', 'na', 'pa', 'xa', 'cho', 'yu', 'te', 'qui', 'wa', 'ho', 'ti', 'a', 'o', 'ne', 'sa', 'lu', 'ke', 'mo'];
const MID = ['ra', 'lo', 'nan', 'qui', 'ma', 'to', 'chi', 'yo', 'ka', 'wen', 'ri', 'pa', 'ha', 'co', 'tla', 'mi'];
const END = ['ca', 'tl', 'wa', 'an', 'ki', 'que', 'ro', 'na', 'te', 'mec', 'aya', 'ni', 'pa', 'go'];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function nativeWord(rng: Rng): string {
  let w = pick(rng, ONSET);
  for (let k = int(rng, 0, 1); k > 0; k--) w += pick(rng, MID);
  w += pick(rng, END);
  return cap(w);
}

const SAINTS = ['San Juan', 'Santa Cruz', 'San Miguel', 'Santa Lucía', 'San Andrés', 'Santa Marta', 'San Blas', 'Santo Tomás', 'Santa Rosa', 'San Bartolomé', 'La Trinidad', 'San Vicente'];

export function islandName(rng: Rng): string {
  return pick(rng, SAINTS);
}

/** First names, family names and how they join, for each crown's courtiers. */
const NAMES: Record<CrownId, { first: string[]; last: string[]; join: string }> = {
  spain: {
    first: ['Alonso', 'Diego', 'Rodrigo', 'Juan', 'Pedro', 'Martín', 'Gonzalo', 'Íñigo', 'Bartolomé', 'Francisco', 'Hernando', 'Vicente', 'Lope', 'Beltrán', 'Sancho', 'Álvaro', 'Gaspar', 'Tomás', 'Andrés', 'Nuño'],
    last: ['Salcedo', 'Arévalo', 'Ybarra', 'Montoya', 'Céspedes', 'Valdivieso', 'Carvajal', 'Ochoa', 'Larrea', 'Zamudio', 'Barrientos', 'Olmedo', 'Quintana', 'Escobedo', 'Robles', 'Aguirre', 'Mendoza', 'Villalba', 'Herrera', 'Toledo'],
    join: ' de ',
  },
  portugal: {
    first: ['João', 'Duarte', 'Afonso', 'Gonçalo', 'Diogo', 'Nuno', 'Pêro', 'Fernão', 'Vasco', 'Rui', 'Estêvão', 'Lopo', 'Tristão', 'Bartolomeu', 'Álvaro', 'Henrique'],
    last: ['Pacheco', 'Cabral', 'Teixeira', 'Pereira', 'Coutinho', 'Almeida', 'Correia', 'Sequeira', 'Lobo', 'Barreto', 'Sousa', 'Brandão', 'Faria', 'Moniz', 'Esteves', 'Corte-Real'],
    join: ' ',
  },
  england: {
    first: ['Thomas', 'John', 'William', 'Richard', 'Henry', 'Edward', 'Robert', 'Humphrey', 'Walter', 'Martin', 'Ralph', 'Hugh', 'Nicholas', 'Christopher', 'Edmund', 'George'],
    last: ['Wyndham', 'Gilbert', 'Frobisher', 'Hawkins', 'Grenville', 'Thorne', 'Willoughby', 'Chancellor', 'Lok', 'Fenton', 'Ashley', 'Barlow', 'Stukeley', 'Cavendish', 'Rastell', 'Pert'],
    join: ' ',
  },
  france: {
    first: ['Jacques', 'Jean', 'Pierre', 'François', 'Guillaume', 'Antoine', 'Louis', 'Nicolas', 'Philippe', 'René', 'Claude', 'Michel', 'Étienne', 'Charles', 'Gilles', 'Honoré'],
    last: ['Roberval', 'Laudonnière', 'Ribault', 'Gonneville', 'Villegagnon', 'Monts', 'Thevet', 'Brosse', 'Ango', 'Parmentier', 'Fonteneau', 'Saint-Malo', 'Aubert', 'Verrier', 'Lescarbot', 'Pontgravé'],
    join: ' de ',
  },
  netherlands: {
    first: ['Pieter', 'Jan', 'Willem', 'Cornelis', 'Hendrik', 'Jacob', 'Dirck', 'Maarten', 'Adriaen', 'Joris', 'Gerrit', 'Claes', 'Frans', 'Laurens', 'Reynier', 'Abel'],
    last: ['van Heemskerck', 'Houtman', 'van Noort', 'Barentsz', 'Hudde', 'van Linschoten', 'Plancius', 'de Weert', 'Roggeveen', 'van der Hagen', 'Block', 'May', 'Tasman', 'Schouten', 'Coen', 'van Rijn'],
    join: ' ',
  },
};

/** An invented courtier's name in the crown's own language. */
export function explorerName(rng: Rng, taken: string[] = [], crown: CrownId = 'spain'): string {
  const n = NAMES[crown];
  for (let k = 0; k < 50; k++) {
    const name = `${pick(rng, n.first)}${n.join}${pick(rng, n.last)}`;
    if (!taken.includes(name)) return name;
  }
  return `${pick(rng, n.first)} ${pick(rng, n.last)} ${taken.length}`;
}
