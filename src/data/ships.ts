export type ShipType = 'caravel' | 'carrack' | 'galleon';

export interface ShipSpec {
  name: string;
  /** movement points per season */
  moves: number;
  /** how well it sails toward the wind, 0..1 (lateen rigs are better) */
  windward: number;
  cargo: number;
  crew: number;
  /** seasons of food and water it can carry */
  provisions: number;
  cost: number;
  /** seasons to build */
  build: number;
  /** port level needed to build */
  port: number;
  upkeep: number;
  sight: number;
  /** people and units it can carry; a fleet's leader takes one */
  slots: number;
  /** fighting strength at sea */
  guns: number;
  blurb: string;
}

export const SHIPS: Record<ShipType, ShipSpec> = {
  caravel: {
    name: 'Caravel', moves: 18, windward: 0.65, cargo: 40, crew: 24, provisions: 8, cost: 1500, build: 2, port: 1,
    upkeep: 40, sight: 3, slots: 1, guns: 2, blurb: 'Small, fast and handy into the wind. The explorer’s ship.',
  },
  carrack: {
    name: 'Carrack', moves: 15, windward: 0.35, cargo: 100, crew: 50, provisions: 8, cost: 3200, build: 3, port: 2,
    upkeep: 85, sight: 2, slots: 2, guns: 4, blurb: 'A roomy merchant ship. Slow against the wind.',
  },
  galleon: {
    name: 'Galleon', moves: 14, windward: 0.3, cargo: 160, crew: 80, provisions: 9, cost: 6000, build: 4, port: 3,
    upkeep: 140, sight: 2, slots: 4, guns: 8, blurb: 'Big hold, strong hull. Built to carry the riches of the Indies.',
  },
};

/**
 * The crossing once the ocean winds are understood (before that the open ocean has its own, far
 * worse, rules). A quick passage is not a safe one: a storm on the way damages a ship, and a ship
 * never mended sinks in the end; a good navigator reads the sky; and a crew will not leave land
 * behind with thin stores.
 */
export const CROSSING = {
  /** chance of a storm on one crossing */
  storm: 0.12,
  /** each point of the leader's navigation takes this share off it */
  pilot: 0.12,
  /** summer and autumn below 30 degrees: the hurricane months */
  hurricane: 2,
  /** with fewer seasons of stores than this aboard, the crew may refuse to sail */
  thinStores: 3,
  /** chance that they do; each point of the leader's navigation and military skill takes 0.05 off */
  mutiny: 0.5,
};

export const SHIP_NAMES = [
  'Santa María', 'San Gabriel', 'La Niña', 'Pinta', 'San Juan', 'Trinidad', 'Concepción', 'Victoria',
  'San Antonio', 'Santiago', 'La Gallega', 'San Cristóbal', 'Santa Clara', 'Espíritu Santo', 'San Pedro',
  'Nuestra Señora', 'La Capitana', 'San Salvador', 'Santa Ana', 'San Lucas', 'La Magdalena', 'San Telmo',
];




