/**
 * Laws: lasting policies of the realm. Research opens them; enacting one costs ducats and takes
 * one of a few places, so a realm is known by the laws it chooses. Their effects are `Mods`, added
 * up with knowledge, the ruler and the age in `realmMods`. Provisional numbers.
 */
import { TECHS, type Mods, type TechId } from './tech';

export type LawId = 'abolition' | 'free_ports' | 'land_grants' | 'monopoly' | 'navigation_acts' | 'census' | 'tolerance' | 'orthodoxy' | 'charters' | 'conscription';

export interface Law {
  id: LawId;
  name: string;
  blurb: string;
  effect: string;
  cost: number;
  mods: Mods;
  /** cannot stand beside this law */
  against?: LawId;
}

export const LAWS: Law[] = [
  { id: 'free_ports', name: 'Free ports', cost: 600, mods: { spread: 0.02, taxes: 0.97 },
    effect: 'Better prices in every market; a little less in taxes.', blurb: 'Any flag may trade in your harbours, on the same dues as your own.' },
  { id: 'land_grants', name: 'Land grants', cost: 600, mods: { growth: 1.25, loyalty: -3 },
    effect: 'Colonies grow faster; settlers are a little less loyal.', blurb: 'Great tracts overseas to whoever will people them at their own cost.' },
  { id: 'monopoly', name: 'Royal monopoly', cost: 900, mods: { taxes: 1.12, loyalty: -4 }, against: 'free_ports',
    effect: 'Much more in taxes; colonies resent it.', blurb: 'Every cargo through one port, one company and one customs house: yours.' },
  { id: 'navigation_acts', name: 'Navigation acts', cost: 900, mods: { taxes: 1.08, regard: -6 },
    effect: 'More in taxes; the other crowns think worse of you.', blurb: 'Colonial goods in your own ships, to your own ports, and nowhere else.' },
  { id: 'census', name: 'The census', cost: 500, mods: { taxes: 1.05 },
    effect: 'More in taxes.', blurb: 'Every hearth counted, and every hearth taxed.' },
  { id: 'tolerance', name: 'Toleration', cost: 500, mods: { research: 2, loyalty: 2 }, against: 'orthodoxy',
    effect: '2 more research points a season; colonies a little more loyal.', blurb: 'No one shall be troubled for their conscience, so long as they keep the peace.' },
  { id: 'orthodoxy', name: 'Orthodoxy', cost: 500, mods: { loyalty: 5, research: -2 }, against: 'tolerance',
    effect: 'Colonies more loyal; 2 fewer research points a season.', blurb: 'One faith in every city of the realm, and a tribunal to see to it.' },
  { id: 'charters', name: 'Municipal charters', cost: 700, mods: { loyalty: 6, taxes: 0.95 },
    effect: 'Colonies more loyal; a little less in taxes.', blurb: 'Towns overseas choose their own councils, under your governor.' },
  { id: 'abolition', name: 'Abolition', cost: 800, mods: { loyalty: 3 },
    effect: 'The trade in people is forbidden, and everyone held in your colonies and ships is freed.', blurb: 'No one shall be bought, sold or held as property in any land under your crown.' },
  { id: 'conscription', name: 'Conscription', cost: 700, mods: { upkeep: 0.8, loyalty: -3 },
    effect: 'Soldiers and ships cost much less to keep; colonies resent the levy.', blurb: 'Every parish owes you men, whether or not they wish to go.' },
];

export const lawById = (id: LawId) => LAWS.find((l) => l.id === id)!;
/** The subject that opens a law. */
export const lawTech = (id: LawId): TechId | undefined => TECHS.find((t) => t.unlocks?.laws?.includes(id))?.id;
/** A realm may keep two laws, and one more for every three subjects of state it has mastered. */
export const LAW_PLACES = { base: 2, perStateTechs: 3 };
/** Repealing a law costs prestige: a ruler who changes their mind is noticed. */
export const REPEAL_PRESTIGE = 4;
