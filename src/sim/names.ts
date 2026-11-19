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

const FIRST = ['Alonso', 'Diego', 'Rodrigo', 'Juan', 'Pedro', 'Martín', 'Gonzalo', 'Íñigo', 'Bartolomé', 'Francisco', 'Hernando', 'Vicente', 'Lope', 'Beltrán', 'Sancho', 'Álvaro', 'Gaspar', 'Tomás', 'Andrés', 'Nuño'];
const LAST = ['Salcedo', 'Arévalo', 'Ybarra', 'Montoya', 'Céspedes', 'Valdivieso', 'Carvajal', 'Ochoa', 'Larrea', 'Zamudio', 'Barrientos', 'Olmedo', 'Quintana', 'Escobedo', 'Robles', 'Aguirre', 'Mendoza', 'Villalba', 'Herrera', 'Toledo'];

/** An invented explorer's name. */
export function explorerName(rng: Rng, taken: string[] = []): string {
  for (let k = 0; k < 50; k++) {
    const n = `${pick(rng, FIRST)} de ${pick(rng, LAST)}`;
    if (!taken.includes(n)) return n;
  }
  return `${pick(rng, FIRST)} ${pick(rng, LAST)}`;
}
