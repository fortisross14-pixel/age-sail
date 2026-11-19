export const GOODS = ['furs', 'tobacco', 'cacao', 'sugar', 'spices', 'dyes', 'gold', 'silver', 'tools', 'timber', 'stone', 'food', 'cloth', 'wine'] as const;
export type GoodId = (typeof GOODS)[number];

export const GOOD_INFO: Record<GoodId, { name: string; icon: string; blurb: string }> = {
  furs: { name: 'Furs', icon: 'goods/furs', blurb: 'Beaver and fox pelts from the cold north. Antwerp pays best.' },
  tobacco: { name: 'Tobacco', icon: 'goods/tobacco', blurb: 'A strange new leaf. Demand grows as Europe takes to it.' },
  cacao: { name: 'Cacao', icon: 'goods/cacao', blurb: 'Bitter beans for a noble drink. Seville craves it.' },
  sugar: { name: 'Sugar', icon: 'goods/sugar', blurb: 'White gold from the islands. Europe’s sweet tooth only grows.' },
  spices: { name: 'Pepper', icon: 'goods/spices', blurb: 'Malagueta pepper from the Guinea coast: a cheaper rival to the spices of the East.' },
  dyes: { name: 'Dyes', icon: 'goods/dyes', blurb: 'Indigo and brazilwood for the cloth workshops of Flanders.' },
  gold: { name: 'Gold', icon: 'goods/gold', blurb: 'Scarce and precious. The Crown wants every ounce.' },
  silver: { name: 'Silver', icon: 'goods/silver', blurb: 'Heavy bars from the mines. The Crown takes its fifth.' },
  timber: { name: 'Timber', icon: 'goods/timber', blurb: 'Building material: needed to found colonies and raise towns.' },
  stone: { name: 'Stone', icon: 'terrain/rocks-1', blurb: 'Building material for towns and cities.' },
  food: { name: 'Food', icon: 'goods/corn', blurb: 'Grain, salt fish and biscuit. Colonists eat it every season.' },
  cloth: { name: 'Cloth', icon: 'goods/silk', blurb: 'Colonists need it to stay content. Peoples across the sea want it too.' },
  wine: { name: 'Wine', icon: 'goods/wine', blurb: 'A colonist’s comfort. Without it, the settlers grumble.' },
  tools: { name: 'Tools', icon: 'goods/tools', blurb: 'Iron axes and hooks: a building material, and prized by the peoples across the sea.' },
};

/** What colonists need: to live (food), to stay content (cloth, wine), and to grow faster (luxuries). */
export const NEEDS = { food: 1, cloth: 0.25, wine: 0.2 } as const;
export const LUXURIES: GoodId[] = ['sugar', 'tobacco', 'cacao'];
export const LUXURY_NEED = 0.15;
/** Building materials. */
export const MATERIALS: GoodId[] = ['timber', 'tools', 'stone'];
