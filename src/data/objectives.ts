/**
 * Objectives: the first voyage (a checklist that teaches the opening) and the ambitions your advisers
 * set afterwards. The conditions live in `src/sim/objectives.ts`; this file is the words, the order
 * and the rewards. Reward numbers are provisional until the balance pass.
 */
export type ObjectiveId =
  | 'explorer' | 'cargo' | 'command' | 'south' | 'meet' | 'sale' | 'ashore' | 'colony'
  | 'route' | 'post' | 'volta' | 'crossing' | 'ally' | 'factory' | 'university' | 'town'
  | 'colonies3' | 'treasury' | 'settlers25' | 'first'
  | 'laws3' | 'subjects20' | 'treaties3' | 'city' | 'promise' | 'settlers100';

/** Where "Show me" takes the player. Plain strings so the data layer stays free of UI types. */
export interface ObjectiveGoto {
  screen?: 'cities' | 'markets' | 'fleets' | 'court' | 'research' | 'chronicle';
  researchTab?: 'subjects' | 'laws' | 'expedition';
  courtTab?: 'people' | 'petitioners' | 'peoples' | 'crowns' | 'dynasty' | 'europe';
  /** select the first fleet (or the first with a leader) and look at it */
  fleet?: 'any' | 'led';
}

export interface ObjectiveDef {
  id: ObjectiveId;
  /** the first voyage is a checklist shown whole; ambitions come a few at a time */
  chain: 'voyage' | 'ambition';
  title: string;
  /** which adviser asks, for ambitions */
  from?: string;
  /** how to do it, in one or two sentences */
  how: string;
  /** said inside the screen "Show me" opens, the first time: which control to use */
  inScreen?: string;
  /** where the map points while this is the next step */
  point?: 'home' | 'south';
  goto?: ObjectiveGoto;
  reward: { ducats?: number; prestige?: number };
  /** ambitions wait until these are done */
  after?: ObjectiveId[];
  /** ambitions of the later ages wait for this year */
  fromYear?: number;
}

export const OBJECTIVES: ObjectiveDef[] = [
  // ---- the first voyage ----
  { id: 'explorer', chain: 'voyage', title: 'Commission an explorer',
    how: 'Open Court, pick the courtier with the best navigation, and make them an explorer. They need a turn to make ready. Only an explorer may sail into uncharted water.',
    inScreen: 'Pick a courtier on the left and read their Navigation on the right: the higher, the further and safer they sail. Under Commission, choose Explorer and who sails with them.',
    point: 'home', goto: { screen: 'court', courtTab: 'people' }, reward: { ducats: 100 } },
  { id: 'cargo', chain: 'voyage', title: 'Load goods to trade',
    how: 'Open Markets, choose your main port and buy tools for a ship in harbour. The peoples of the African coast prize iron.',
    inScreen: 'Choose your main port on the left, then Buy on the Tools row. The lot buttons at the top right set how much each press buys.',
    point: 'home', goto: { screen: 'markets' }, reward: { ducats: 100 } },
  { id: 'command', chain: 'voyage', title: 'Give your explorer a fleet',
    how: 'When the explorer is ready, open Fleets, pick a ship and choose them to command it. Join your two ships first if you want them to sail together.',
    inScreen: 'Pick a ship under Idle ships, then "Choose someone at court" and your explorer. Join puts both ships in one fleet; Embark takes the colonist and the soldier aboard.',
    point: 'home', goto: { screen: 'fleets' }, reward: { ducats: 100 } },
  { id: 'south', chain: 'voyage', title: 'Sail beyond the known coast',
    how: 'Select the fleet and click the sea to the south, past Cape Bojador: numbered markers show where each season ends. Click again or press Space to sail. Watch the stores: about eight seasons of food.',
    point: 'south', goto: { fleet: 'led' }, reward: { ducats: 150, prestige: 2 } },
  { id: 'meet', chain: 'voyage', title: 'Meet a people',
    how: 'Follow the coast until a trading ground appears, and dock there. Every coast belongs to someone.',
    goto: { fleet: 'led' }, reward: { ducats: 150, prestige: 3 } },
  { id: 'sale', chain: 'voyage', title: 'Sell a cargo',
    how: 'Trade your tools for gold, pepper or dyes, carry them back to Europe and sell where the price is best (Markets, Compare prices).',
    inScreen: 'Compare prices shows every port you know side by side. Sell where the bar is short: that market is hungry for the good.',
    goto: { screen: 'markets' }, reward: { ducats: 300 } },
  { id: 'ashore', chain: 'voyage', title: 'Send a party ashore',
    how: 'Ships only chart coasts. With units aboard and the fleet beside a shore, choose Land party. On foot they survey for gold, timber and good soil.',
    goto: { fleet: 'any' }, reward: { ducats: 200, prestige: 2 } },
  { id: 'colony', chain: 'voyage', title: 'Found your first colony',
    how: 'Bring a colonist, with timber and tools in the hold, to a surveyed coast. Land the party and choose Found colony, then keep it in food, cloth and wine.',
    goto: { screen: 'cities' }, reward: { ducats: 500, prestige: 10 } },

  // ---- ambitions ----
  { id: 'route', chain: 'ambition', from: 'Your treasurer', title: 'A merchant on a trade route', after: ['sale'],
    how: 'Make a courtier a merchant, give them a fleet, and set a route between two ports in Fleets. They will buy and sell by themselves.',
    goto: { screen: 'fleets' }, reward: { ducats: 300 } },
  { id: 'post', chain: 'ambition', from: 'Your treasurer', title: 'A trading post among a people', after: ['meet'],
    how: 'Dock at a friendly people’s trading ground and build a trading post: they will bring more goods to market.',
    goto: { screen: 'court', courtTab: 'peoples' }, reward: { ducats: 300, prestige: 3 } },
  { id: 'volta', chain: 'ambition', from: 'Your pilot major', title: 'Master the Volta do mar', after: ['south'],
    how: 'Have your scholars study long-distance navigation in Research. Until then the open ocean spoils food twice as fast and few ships return.',
    goto: { screen: 'research' }, reward: { prestige: 8 } },
  { id: 'crossing', chain: 'ambition', from: 'Your pilot major', title: 'Landfall across the Mar Océano', after: ['volta'],
    how: 'Send an explorer west with full stores. Ride the trade winds out in the south and come home on the westerlies in the north.',
    goto: { fleet: 'led' }, reward: { ducats: 800, prestige: 15 } },
  { id: 'ally', chain: 'ambition', from: 'Your chancellor', title: 'An alliance with a people', after: ['meet'],
    how: 'In Diplomacy, Peoples: trade, send gifts, and when they think well of you, propose an alliance. Allies fight beside you and trade more.',
    goto: { screen: 'court', courtTab: 'peoples' }, reward: { ducats: 300, prestige: 5 } },
  { id: 'factory', chain: 'ambition', from: 'Your treasurer', title: 'A factory in a foreign port', after: ['sale'],
    how: 'In Markets, pick a foreign port and open a factory. Your factor sells what you leave there slowly, so the price holds.',
    goto: { screen: 'markets' }, reward: { ducats: 400 } },
  { id: 'university', chain: 'ambition', from: 'Your chancellor', title: 'A university in your realm', after: ['explorer'],
    how: 'In Cities, choose a city with a free place and add a university. Your scholars will work faster.',
    goto: { screen: 'cities' }, reward: { prestige: 5 } },
  { id: 'town', chain: 'ambition', from: 'Your governor', title: 'Raise a colony to a town', after: ['colony'],
    how: 'A full outpost with timber, tools and stone in its warehouse can become a town, with room for more colonists and more land.',
    goto: { screen: 'cities' }, reward: { ducats: 600, prestige: 8 } },
  { id: 'colonies3', chain: 'ambition', from: 'Your governor', title: 'Three colonies overseas', after: ['colony'],
    how: 'Train colonists at home and plant them on different coasts. Spread out: each colony claims the land around it.',
    goto: { screen: 'cities' }, reward: { ducats: 800, prestige: 10 } },
  { id: 'treasury', chain: 'ambition', from: 'Your treasurer', title: '10,000 ducats in the treasury', after: ['sale'],
    how: 'Markets, merchants and colonial cargoes fill the treasury; ships, wages and soldiers empty it.',
    goto: { screen: 'markets' }, reward: { prestige: 8 } },
  { id: 'settlers25', chain: 'ambition', from: 'Your governor', title: 'Twenty-five colonists overseas', after: ['colonies3'],
    how: 'Colonies grow slowly by births. Most settlers must be trained at home and shipped across.',
    goto: { screen: 'cities' }, reward: { ducats: 1000, prestige: 12 } },
  { id: 'first', chain: 'ambition', from: 'Your chancellor', title: 'First among the crowns', after: ['colonies3'],
    how: 'Lead the standings in Diplomacy, Crowns: colonists, territory and commerce all count.',
    goto: { screen: 'court', courtTab: 'crowns' }, reward: { prestige: 20 } },

  // ---- ambitions of the later ages ----
  { id: 'laws3', chain: 'ambition', from: 'Your chancellor', title: 'Three laws in force', fromYear: 1520,
    how: 'Research opens laws (Research, Laws). A realm keeps two, and one more for every three subjects of state.',
    goto: { screen: 'research', researchTab: 'laws' }, reward: { prestige: 10 } },
  { id: 'treaties3', chain: 'ambition', from: 'Your chancellor', title: 'Three treaties in Europe', fromYear: 1520,
    how: 'In Diplomacy, Europe: envoys and gifts win regard, and regard wins trade treaties, pacts and alliances.',
    goto: { screen: 'court', courtTab: 'europe' }, reward: { ducats: 600, prestige: 10 } },
  { id: 'city', chain: 'ambition', from: 'Your governor', title: 'A city overseas', after: ['town'], fromYear: 1550,
    how: 'A full town with timber, tools and stone in its warehouse can become a city, the seat of a province.',
    goto: { screen: 'cities' }, reward: { ducats: 1200, prestige: 15 } },
  { id: 'subjects20', chain: 'ambition', from: 'Your pilot major', title: 'Twenty subjects mastered', fromYear: 1570,
    how: 'Universities, observatories, learned courtiers and funded expeditions all bring research.',
    goto: { screen: 'research' }, reward: { prestige: 15 } },
  { id: 'promise', chain: 'ambition', from: 'Your chancellor', title: 'An age that kept its promise', fromYear: 1570,
    how: 'Each age opens with a choice of path and a goal (Court, Dynasty). Meet the goal before the age ends.',
    goto: { screen: 'court', courtTab: 'dynasty' }, reward: { ducats: 1000 } },
  { id: 'settlers100', chain: 'ambition', from: 'Your governor', title: 'A hundred colonists overseas', after: ['settlers25'], fromYear: 1620,
    how: 'Towns and cities hold more people. Keep them fed, clothed and loyal, and keep sending settlers.',
    goto: { screen: 'cities' }, reward: { ducats: 2000, prestige: 20 } },
];

/**
 * The opening differs by crown: how far the unknown coast is, and what the crown is good at.
 * `welcome` is added to the greeting; `south` replaces the how-to of "Sail beyond the known coast".
 */
export const OPENINGS: Record<string, { welcome: string; south?: string }> = {
  spain: { welcome: 'Sevilla is a short sail from the African coast, and your colonists come cheap: you can plant a colony early.' },
  portugal: {
    welcome: 'Your pilots already know the portolan and the lateen sail, and Lisboa is the nearest great port to Africa: you can be first down the coast.',
    south: 'Select the fleet and click the sea south of Cape Bojador. Your lateen sails make the beat home easier than for anyone else. Numbered markers show where each season ends; click again or press Space to sail.',
  },
  england: {
    welcome: 'London is far from the unknown coasts: a voyage south takes most of your stores before it begins. Your ships fight well, and there is trade to be had in the North first.',
    south: 'Cape Bojador is three or four seasons from London. Sail with full stores and call at a port on the way (Lisboa, Sevilla): foreign ports refill your stores to half. Click the sea to plan; numbered markers show where each season ends.',
  },
  france: {
    welcome: 'La Rochelle looks out on the open Atlantic, a season or two from the African coast. Your court is larger than any other, and your gifts go further with the peoples you meet.',
    south: 'Cape Bojador is about two seasons from La Rochelle. Follow the Iberian coast south and call at a port if the stores run low: foreign ports refill them to half. Click the sea to plan, then click again or press Space.',
  },
  netherlands: {
    welcome: 'Antwerpen is the furthest of the five from the unknown coasts, but your prices are the best in every market and your ships are cheap: trade within Europe can pay for the long voyages.',
    south: 'Cape Bojador is four seasons or more from Antwerpen. Consider a trading run to Lisboa or Sevilla on the way: you sell there at better prices than anyone, and the port refills your stores to half. Click the sea to plan; numbered markers show where each season ends.',
  },
};

export const objectiveById = (id: ObjectiveId) => OBJECTIVES.find((o) => o.id === id)!;
export const VOYAGE = OBJECTIVES.filter((o) => o.chain === 'voyage');
export const AMBITIONS = OBJECTIVES.filter((o) => o.chain === 'ambition');
/** How many ambitions your advisers press at once. */
export const AMBITIONS_AT_ONCE = 3;
