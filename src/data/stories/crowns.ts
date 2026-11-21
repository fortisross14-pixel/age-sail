import type { StoryDef } from './types';

/** Rival crowns: neighbours, competitors and, now and then, enemies. */
export const CROWNS_STORIES: StoryDef[] = [
  {
    id: 'protest', family: 'crowns', again: 24, about: { colony: 'nearRival', crown: 'neighbour peace hostile' },
    title: 'A protest from {crown}',
    text: 'An ambassador of {crown} asks for an audience. {colony} stands too close to their own settlements, he says, and his master will not suffer it much longer.',
    choices: [
      { label: 'Pay for their goodwill', effects: [['ducats', -500], ['attitude', 30]], text: 'The ambassador leaves with a chest of ducats and a treaty of friendship.' },
      { label: 'Promise to settle no closer', effects: [['attitude', 18], ['prestige', -5]], text: 'A line is drawn on the chart. Your court mutters that you gave way.' },
      { label: 'The sea is free to all', effects: [['attitude', -15], ['prestige', 3]], text: 'The ambassador bows coldly and takes ship the same night.' },
    ],
  },
  {
    id: 'rival_pilot', family: 'crowns', again: 80, about: { crown: 'any' },
    title: 'A pilot changes masters',
    text: 'The best pilot of {crown} has quarrelled with his prince over pay. He is in {capital}, with his charts, and he is for hire.',
    choices: [
      { label: 'Hire him', effects: [['ducats', -500], ['research', 30], ['attitude', -12]], text: 'He draws from memory for a month. Their ambassador demands him back, in vain.' },
      { label: 'Send him home', effects: [['attitude', 12]], text: 'He is returned with an escort. His prince pays him, after all.' },
    ],
  },
  {
    id: 'boundary', family: 'crowns', again: 40, about: { crown: 'peace' }, when: [['colonies', '>=', 1]],
    title: 'A line on the map',
    text: '{crown} proposes that learned men of both realms meet and agree where your lands overseas end and theirs begin, before soldiers have to.',
    choices: [
      { label: 'Agree, and bargain hard', roll: ['ruler', 'diplomacy', 0.45, 0.13], effects: [['attitude', 15], ['prestige', 6]], text: 'Your geographers win a hundred leagues by arguing about the length of a degree.',
        else: { effects: [['attitude', 8], ['prestige', -4]], text: 'Their geographers win a hundred leagues by arguing about the length of a degree.' } },
      { label: 'Agree to nothing', effects: [['attitude', -8]], text: 'The learned men go home. The soldiers stay ready.' },
    ],
  },
  {
    id: 'joint_venture', family: 'crowns', again: 40, about: { crown: 'friendly' },
    title: 'A venture in common',
    text: 'Merchants of {crown} propose a voyage fitted out by both realms, profits shared. Half the risk, half the gain, and their pilots aboard your ships.',
    choices: [
      { label: 'Join them', roll: ['none', 'commerce', 0.65, 0], effects: [['ducats', 700], ['attitude', 10]], text: 'The ships come home deep-laden. The accounts are argued over for a year, amicably.',
        else: { effects: [['ducats', -400], ['attitude', -5]], text: 'One ship is lost and each side blames the other’s pilot.' } },
      { label: 'Decline politely', effects: [], text: 'They find another partner.' },
    ],
  },
  {
    id: 'captive_captain', family: 'crowns', again: 24, about: { crown: 'war' },
    title: 'A captain in their hands',
    text: '{crown.people} have taken one of your captains in the war. They will exchange him for ransom, or for a promise.',
    choices: [
      { label: 'Pay the ransom', effects: [['ducats', -600], ['courtAll', 3, 'A captured captain ransomed']], text: 'He comes home with a limp and a low opinion of their cooking.' },
      { label: 'Leave him', effects: [['courtAll', -4, 'A captured captain left in prison'], ['prestige', -3]], text: 'He writes long letters. Your court reads them.' },
      { label: 'Offer peace talks', effects: [['attitude', 20]], text: 'Envoys meet under a white flag. It is a beginning.' },
    ],
  },
  {
    id: 'peace_feelers', family: 'crowns', again: 20, about: { crown: 'war' }, when: [['chance', 0.6]],
    title: 'A quiet word',
    text: 'A friar who travels between courts brings a message from {crown}: they are as tired of this war as your treasurer is.',
    choices: [
      { label: 'Listen', effects: [['attitude', 25]], text: 'Nothing is signed, but the privateers grow less eager. Peace can be made at court when you choose.' },
      { label: 'They are weakening: press on', effects: [['attitude', -10], ['prestige', 3]], text: 'The friar shrugs and rides on.' },
    ],
  },
  {
    id: 'ambassador_insult', family: 'crowns', again: 36, about: { crown: 'peace', courtier: 'atCourt bold' },
    title: 'An ambassador insulted',
    text: 'At a banquet {courtier} told the ambassador of {crown} what sailors say about his prince’s mother. The ambassador demands an apology, on {courtier.first}’s knees.',
    choices: [
      { label: 'Make them kneel', effects: [['attitude', 10], ['opinion', 'courtier', -12, 'Made to kneel to a foreigner']], text: '{courtier.first} kneels, with a face like a closed door.' },
      { label: 'Apologise yourself, lightly', effects: [['attitude', 2], ['opinion', 'courtier', 5, 'Shielded from a foreign ambassador']], text: 'A joke, a gift, a change of subject.' },
      { label: 'It was well said', effects: [['attitude', -18], ['opinion', 'courtier', 8, 'Backed against a foreign ambassador'], ['prestige', 2]], text: 'The ambassador leaves the hall. So, shortly, does his embassy.' },
    ],
  },
  {
    id: 'letters_of_marque', family: 'crowns', again: 40, about: { crown: 'hostile peace', courtier: 'soldier' },
    title: 'Private war',
    text: '{courtier} asks for a paper with your seal that would let certain captains take ships of {crown} wherever they find them, without anyone calling it war.',
    choices: [
      { label: 'Seal it', effects: [['ducats', 600], ['attitude', -20], ['opinion', 'courtier', 6, 'Given letters of marque']], text: 'Prizes come in. Their ambassador produces a list of them, with dates.' },
      { label: 'Not while there is peace', effects: [['opinion', 'courtier', -3, 'Refused letters of marque'], ['attitude', 3]], text: 'The captains go back to carrying wool.' },
    ],
  },
  {
    id: 'starving_neighbour', family: 'crowns', again: 30, about: { colony: 'nearRival', crown: 'neighbour' },
    title: 'Hungry neighbours',
    text: 'The colony of {crown} near {colony} has had no ship from home in a year. Its governor sends a boat, asking to buy food at any price.',
    choices: [
      { label: 'Sell them what they need', effects: [['ducats', 300], ['attitude', 12], ['food', -10]], text: 'Barrels go over. Their governor writes home that your people are human after all.' },
      { label: 'Give it', effects: [['attitude', 25], ['food', -10], ['prestige', 5]], text: 'It is talked of in their capital for years.' },
      { label: 'Let them starve', effects: [['attitude', -15]], text: 'Some of them walk to {colony} anyway, and are let in.' },
    ],
  },
  {
    id: 'trade_war', family: 'crowns', again: 80, about: { crown: 'ahead peace' }, when: [['year', '>=', 1520]],
    title: 'Their goods in your markets',
    text: 'Sugar and tobacco under the flag of {crown} undersell your own in your own ports. Your merchants want a tariff; theirs threaten to answer in kind.',
    choices: [
      { label: 'A tariff on their goods', effects: [['ducats', 400], ['attitude', -15]], text: 'The customs house fills. So does the smugglers’ cove.' },
      { label: 'Free trade, and may the better merchants win', effects: [['attitude', 8], ['courtAll', -1, 'Foreign goods let in freely']], text: 'Prices fall. Your merchants complain all the way to the bank.' },
    ],
  },
];
