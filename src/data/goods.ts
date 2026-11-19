export const GOODS = ['furs', 'tobacco', 'cacao', 'sugar', 'spices', 'dyes', 'gold', 'tools'] as const;
export type GoodId = (typeof GOODS)[number];

export const GOOD_INFO: Record<GoodId, { name: string; icon: string; blurb: string }> = {
  furs: { name: 'Furs', icon: 'furs', blurb: 'Beaver and fox pelts from the cold north. Antwerp pays best.' },
  tobacco: { name: 'Tobacco', icon: 'tobacco', blurb: 'A strange new leaf. Demand grows as Europe takes to it.' },
  cacao: { name: 'Cacao', icon: 'cacao', blurb: 'Bitter beans for a noble drink. Seville craves it.' },
  sugar: { name: 'Sugar', icon: 'sugar', blurb: 'White gold from the islands. Europe’s sweet tooth only grows.' },
  spices: { name: 'Pepper', icon: 'spices', blurb: 'Malagueta pepper from the Guinea coast: a cheaper rival to the spices of the East.' },
  dyes: { name: 'Dyes', icon: 'dyes', blurb: 'Indigo and brazilwood for the cloth workshops of Flanders.' },
  gold: { name: 'Gold', icon: 'gold', blurb: 'Scarce and precious. The Crown wants every ounce.' },
  tools: { name: 'Tools', icon: 'tools', blurb: 'Iron axes, knives and hooks. Prized by the peoples across the sea.' },
};
