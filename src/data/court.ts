import type { Rank, Skill, TraitId, UnitType } from '../sim/types';

export const SKILL_INFO: Record<Skill, { name: string; short: string; blurb: string }> = {
  navigation: { name: 'Navigation', short: 'Nav', blurb: 'Leading a fleet: more moves, food that lasts, a safer open ocean.' },
  military: { name: 'Military', short: 'Mil', blurb: 'Battles on land and at sea (when they come).' },
  commerce: { name: 'Commerce', short: 'Com', blurb: 'Leading a fleet: better prices when buying and selling.' },
  construction: { name: 'Construction', short: 'Con', blurb: 'As a governor: faster, cheaper city projects. Later, founding towns.' },
  diplomacy: { name: 'Diplomacy', short: 'Dip', blurb: 'Leading a fleet: better terms with native peoples.' },
};

export const TRAIT_INFO: Record<TraitId, { name: string; blurb: string }> = {
  learned: { name: 'Learned', blurb: '+1 research point a season while at court or governing.' },
  hardy: { name: 'Hardy', blurb: 'Half as likely to die each year. Crews under them suffer less from scurvy.' },
  bold: { name: 'Bold', blurb: '+1 move a season for the fleet they lead.' },
  shrewd: { name: 'Shrewd', blurb: 'Bargains as if their commerce were 1 higher.' },
  pious: { name: 'Pious', blurb: 'Respected by missionaries. Matters more once missions exist.' },
  ambitious: { name: 'Ambitious', blurb: 'Asks for a higher salary, and rises quickly.' },
};

export const RANK_INFO: Record<Rank, { name: string; cost: number; ready: number; salary: number; blurb: string }> = {
  courtier: { name: 'Courtier', cost: 0, ready: 0, salary: 5, blurb: 'Waits at court for a commission.' },
  explorer: {
    name: 'Explorer', cost: 400, ready: 2, salary: 20,
    blurb: 'Leads expeditions. Only a fleet led by an explorer may sail into uncharted waters. Comes with one free unit, ready in 2 seasons.',
  },
  merchant: { name: 'Merchant', cost: 300, ready: 1, salary: 20, blurb: 'Leads trade fleets and can run a trade route on its own. Ready in 1 season.' },
  governor: { name: 'Governor', cost: 0, ready: 0, salary: 15, blurb: 'Runs one of your cities. Construction makes its projects faster and cheaper.' },
};

export const UNIT_INFO: Record<UnitType, { name: string; sprite: string; blurb: string }> = {
  colonist: { name: 'Colonist', sprite: 'units/colonist', blurb: 'Settlers who will found towns (with materials, in a later version).' },
  infantry: { name: 'Infantry', sprite: 'units/pikeman', blurb: 'Soldiers to protect an expedition ashore, or to conquer.' },
  missionary: { name: 'Missionary', sprite: 'units/friar', blurb: 'Friars who will found missions among native peoples.' },
};
