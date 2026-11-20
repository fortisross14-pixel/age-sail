import type { StoryDef } from './types';

/** The court: the people around you, what they want, and what they do to each other. */
export const COURT: StoryDef[] = [
  {
    id: 'quarrel', family: 'court', again: 24, about: { courtier: 'atCourt', other: 'atCourt' }, when: [['chance', 0.7]],
    title: 'A quarrel at court',
    text: '{courtier} and {other} have come to blows over precedence at a banquet. The whole court is watching to see whom you favour.',
    choices: [
      { label: 'Favour {courtier.first}', effects: [['opinion', 'courtier', 10, 'Favoured over {other}'], ['opinion', 'other', -14, 'Passed over for {courtier}'], ['bond', 'rival']], text: '{other} bows very low, and says nothing at all.' },
      { label: 'Favour {other.first}', effects: [['opinion', 'other', 10, 'Favoured over {courtier}'], ['opinion', 'courtier', -14, 'Passed over for {other}'], ['bond', 'rival']], text: '{courtier} bows very low, and says nothing at all.' },
      { label: 'Fine them both', effects: [['ducats', 200], ['opinion', 'courtier', -5, 'Fined for a quarrel'], ['opinion', 'other', -5, 'Fined for a quarrel'], ['bond', 'rival']], text: 'Both pay a fine to the treasury. Neither forgives the other, or you.' },
    ],
  },
  {
    id: 'duel', family: 'court', again: 30, about: { courtier: 'any', other: 'rivalOf' },
    title: 'Swords at dawn',
    text: 'The old quarrel between {courtier} and {other} has come to a challenge. They mean to meet at dawn, and one of them may not come back.',
    choices: [
      { label: 'Forbid it, on pain of exile', effects: [['opinion', 'courtier', -4, 'Forbidden a duel'], ['opinion', 'other', -4, 'Forbidden a duel']], text: 'They obey, and hate each other a little more politely.' },
      { label: 'Let honour be satisfied', roll: ['courtier', 'military', 0.5, 0.08], effects: [['die', 'other'], ['prestige', -3]], text: '{other} is carried from the field. {courtier.first} wipes a blade and asks for a priest.',
        else: { effects: [['die', 'courtier'], ['prestige', -3]], text: '{courtier} is carried from the field. {other.first} wipes a blade and asks for a priest.' } },
      { label: 'Make them dine together until they are friends', roll: ['ruler', 'diplomacy', 0.3, 0.15], effects: [['bond', 'friend'], ['opinion', 'courtier', 4, 'Reconciled with an enemy'], ['opinion', 'other', 4, 'Reconciled with an enemy']], text: 'By the third supper they are telling each other’s stories.',
        else: { effects: [], text: 'Three suppers pass in silence. Nothing is mended.' } },
    ],
  },
  {
    id: 'scholar', family: 'court', again: 28, about: { courtier: 'atCourt' },
    title: 'A learned visitor',
    text: 'A doctor from {school} offers to teach at court for a winter. {courtier} is eager to study with him.',
    choices: [
      { label: 'Pay for the lessons', effects: [['ducats', -400], ['skill', 'courtier', 'worst', 1], ['opinion', 'courtier', 5, 'Given a tutor']], text: '{courtier} studies all winter and comes out wiser.' },
      { label: 'Ask him to teach your scholars instead', effects: [['ducats', -400], ['research', 15]], text: 'The court’s scholars fill notebooks with his lectures.' },
      { label: 'Send him away', effects: [], text: 'The doctor goes on to another court.' },
    ],
  },
  {
    id: 'bankers', family: 'court', again: 30, when: [['treasury', '<', 1500]],
    title: 'The bankers call',
    text: 'Agents of {bankers} offer you a loan of 4,000 ducats, repaid at 150 a season for ten years.',
    choices: [
      { label: 'Take the loan', effects: [['loan', 4000, 150, 40]], text: 'The money arrives in {capital} in sealed chests.' },
      { label: 'Refuse', effects: [], text: 'The bankers bow and leave.' },
    ],
  },
  {
    id: 'marriage', family: 'court', again: 24, about: { courtier: 'atCourt young' },
    title: 'A match proposed',
    text: 'The house of {house} proposes a marriage for {courtier}. It would bring lands and friends at court, and a larger household to keep.',
    choices: [
      { label: 'Bless the match', hint: '+10 prestige; their salary rises', effects: [['prestige', 10], ['trait', 'courtier', 'ambitious'], ['opinion', 'courtier', 8, 'A good marriage blessed']], text: '{courtier} marries with all the court in attendance.' },
      { label: 'Forbid it', roll: ['none', 'diplomacy', 0.6, 0], effects: [['opinion', 'courtier', -10, 'A marriage forbidden']], text: '{courtier} obeys, unhappily.',
        else: { effects: [['leave', 'courtier']], text: '{courtier} leaves court to marry anyway.' } },
    ],
  },
  {
    id: 'plague', family: 'court', again: 48, about: { courtier: 'atCourt' }, when: [['chance', 0.3]],
    title: 'Plague in {capital}',
    text: 'Sickness has come in with a ship from the south. The physicians fear it will spread through the city.',
    choices: [
      { label: 'Close the port', hint: '−160 ducats in lost dues', effects: [['ducats', -160]], text: 'The port is closed. The plague burns out in a few weeks, and trade resumes.' },
      { label: 'Keep trade moving', hint: 'Someone at court may fall ill', roll: ['none', 'commerce', 0.5, 0], effects: [], text: 'Trade goes on. The plague takes some of the poor quarters, and passes.',
        else: { effects: [['die', 'courtier']], text: 'Trade goes on, and the plague takes {courtier}.' } },
    ],
  },
  {
    id: 'embezzler', family: 'court', again: 40, about: { courtier: 'trader ranked' },
    title: 'The books do not balance',
    text: 'A clerk swears that {courtier} has been keeping one ducat in twenty of everything that passes through their hands. The clerk has copies.',
    choices: [
      { label: 'Dismiss them', effects: [['leave', 'courtier'], ['ducats', 300], ['courtAll', -2, 'A colleague dismissed for theft']], text: 'The estates of {courtier.first} repay part of it. The court takes note.' },
      { label: 'Take the money back and say no more', effects: [['ducats', 500], ['opinion', 'courtier', 6, 'Spared a disgrace']], text: '{courtier.first} pays, pale and grateful, and is very careful afterwards.' },
      { label: 'Everyone does it', effects: [['prestige', -3], ['opinion', 'courtier', 3, 'Shielded from an accusation']], text: 'The clerk is sent to a distant customs house.' },
    ],
  },
  {
    id: 'printing', family: 'court', about: { courtier: 'learned' }, when: [['noflag', 'press']],
    title: 'A press for the court',
    text: '{courtier} asks for money to bring a printer and his press to {capital}: sailing directions, tables of the sun and laws could be had by the hundred instead of copied by hand.',
    choices: [
      { label: 'Found a royal press', effects: [['ducats', -600], ['research', 30], ['flag', 'press'], ['opinion', 'courtier', 6, 'A press founded at their asking']], text: 'The first sheets come off the press smelling of oil and lampblack.' },
      { label: 'Books are for monks', effects: [['opinion', 'courtier', -3, 'Refused a printing press']], text: 'The printer sets up in another city.' },
    ],
  },
  {
    id: 'astrologer', family: 'court', again: 80, when: [['chance', 0.5]],
    title: 'The astrologer',
    text: 'A man who cast horoscopes for three princes has come to {court}. He says the heavens favour great voyages this year, for a ruler bold enough to pay him.',
    choices: [
      { label: 'Retain him', roll: ['none', 'navigation', 0.5, 0], effects: [['ducats', -200], ['prestige', 6]], text: 'His predictions are vague, splendid and widely repeated. The court is delighted.',
        else: { effects: [['ducats', -200], ['prestige', -4]], text: 'He predicts a calm summer, a week before the worst gale in memory.' } },
      { label: 'Ask him to teach your pilots the stars instead', effects: [['ducats', -200], ['research', 10]], text: 'He turns out to be a fair astronomer when nobody is asking about destiny.' },
      { label: 'Show him the door', effects: [], text: 'He predicts your ruin on the way out.' },
    ],
  },
  {
    id: 'heresy', family: 'court', again: 40, about: { courtier: 'pious', other: 'learned' },
    title: 'A whisper of heresy',
    text: '{courtier} has written to the bishop that {other} keeps forbidden books and doubts the shape of the world as the Fathers taught it.',
    choices: [
      { label: 'Protect {other.first}', effects: [['opinion', 'other', 12, 'Protected from an accusation'], ['opinion', 'courtier', -8, 'An accusation ignored'], ['prestige', -3], ['bond', 'rival']], text: 'The letter is lost in your chancery. The bishop is told, kindly, to mind his diocese.' },
      { label: 'Let the bishop ask his questions', effects: [['opinion', 'other', -12, 'Left to the bishop’s questions'], ['opinion', 'courtier', 6, 'Heard by the Church'], ['research', -8], ['bond', 'rival']], text: '{other.first} burns a trunk of papers and answers every question the right way.' },
    ],
  },
  {
    id: 'favourite', family: 'court', again: 30, about: { courtier: 'ambitious loyal' },
    title: 'A favour asked',
    text: '{courtier} has served well and knows it. They ask for a title, an estate, and the right to wear a hat in your presence.',
    choices: [
      { label: 'Grant it all', effects: [['ducats', -500], ['opinion', 'courtier', 12, 'Raised to the nobility'], ['courtAll', -2, 'An upstart ennobled']], text: 'There is a ceremony. The older families attend with fixed smiles.' },
      { label: 'The hat, and nothing else', effects: [['opinion', 'courtier', 3, 'A small honour']], text: '{courtier.first} wears the hat everywhere.' },
      { label: 'Service is its own reward', effects: [['opinion', 'courtier', -10, 'Refused an honour']], text: '{courtier.first} thanks you for the lesson.' },
    ],
  },
  {
    id: 'old_servant', family: 'court', again: 30, about: { courtier: 'old' },
    title: 'An old servant',
    text: '{courtier} is tired. They ask leave to go home, and hope they will not be forgotten there.',
    choices: [
      { label: 'A pension and a farewell feast', effects: [['ducats', -300], ['leave', 'courtier'], ['courtAll', 3, 'An old servant honoured'], ['prestige', 3]], text: 'The whole court sees {courtier.first} to the gate.' },
      { label: 'One more year', effects: [['opinion', 'courtier', -6, 'Kept from retirement']], text: '{courtier.first} sighs, and stays.' },
      { label: 'Go, then', effects: [['leave', 'courtier'], ['courtAll', -2, 'An old servant sent off with nothing']], text: '{courtier.first} leaves with one mule and no escort.' },
    ],
  },
  {
    id: 'spy', family: 'court', again: 72, about: { crown: 'any' },
    title: 'A listener at the door',
    text: 'A secretary in your chancery has been copying your pilots’ reports for {crown}. He was caught with the ink still wet.',
    choices: [
      { label: 'Hang him', effects: [['attitude', -8], ['prestige', 2]], text: 'He is hanged at the harbour mouth, where ships of {crown.people} can see.' },
      { label: 'Feed him false charts', roll: ['ruler', 'diplomacy', 0.5, 0.12], effects: [['rivalDucats', -400], ['research', 5]], text: 'For a year {crown.people} sail where your clerks tell them to.',
        else: { effects: [['attitude', -5]], text: 'He warns his masters with a mark in the margin. The game is up.' } },
      { label: 'Send him home with a protest', effects: [['attitude', 5]], text: 'Their ambassador is embarrassed, which is worth something.' },
    ],
  },
  {
    id: 'painter', family: 'court', again: 48, when: [['treasury', '>=', 1500]],
    title: 'A painter from Italy',
    text: 'A painter who has worked for cardinals offers to fill {court} with the triumphs of your reign: fleets, cities, and you in the middle.',
    choices: [
      { label: 'Commission the cycle', effects: [['ducats', -800], ['prestige', 15]], text: 'It takes three years. Ambassadors are walked past it slowly.' },
      { label: 'One portrait', effects: [['ducats', -200], ['prestige', 4]], text: 'A good likeness, kinder than the mirror.' },
      { label: 'Ships before pictures', effects: [], text: 'He goes north to find a richer wall.' },
    ],
  },
  {
    id: 'gambler', family: 'court', again: 30, about: { courtier: 'young' },
    title: 'Debts of honour',
    text: '{courtier} has lost a year’s income at cards, to people who do not wait. They come to you before the moneylenders come to them.',
    choices: [
      { label: 'Pay the debts', effects: [['ducats', -350], ['opinion', 'courtier', 12, 'Debts paid']], text: '{courtier.first} swears never to touch a card again, and means it for a month.' },
      { label: 'Send them to sea until it blows over', effects: [['opinion', 'courtier', 2, 'Sent away from creditors'], ['skill', 'courtier', 'navigation', 1]], text: 'A long voyage is found. Creditors do not sail.' },
      { label: 'Not your affair', effects: [['opinion', 'courtier', -8, 'Left to their creditors']], text: '{courtier.first} sells a farm and avoids your eye.' },
    ],
  },
  {
    id: 'pilot_school', family: 'court', about: { courtier: 'navigator' }, when: [['noflag', 'pilot_school'], ['year', '>=', 1500]],
    title: 'A school for pilots',
    text: '{courtier} proposes a house in {capital} where every pilot must be examined, every chart corrected from the last voyage, and one master chart kept under lock.',
    choices: [
      { label: 'Found it', effects: [['ducats', -700], ['research', 35], ['flag', 'pilot_school'], ['opinion', 'courtier', 8, 'The pilots’ school founded']], text: 'The master chart grows by a coast every year.' },
      { label: 'Pilots learn at sea', effects: [['opinion', 'courtier', -3, 'The pilots’ school refused']], text: 'Each pilot keeps his own chart, and his own mistakes.' },
    ],
  },
  {
    id: 'defect', family: 'court', chained: true,
    title: 'An offer from abroad',
    text: '{courtier} has been seen with the ambassador of {crown}. They have been offered a place there, and after the way they have been treated here they are minded to take it.',
    choices: [
      { label: 'Make it worth their while to stay', effects: [['ducats', -500], ['opinion', 'courtier', 25, 'Kept at court with gold and promises']], text: '{courtier.first} stays, richer, and watches how long the promises last.' },
      { label: 'Let them go', effects: [['special', 'defect'], ['leave', 'courtier'], ['prestige', -4]], text: '{courtier} takes ship for {crown}, with everything they know.' },
      { label: 'Arrest them', effects: [['leave', 'courtier'], ['courtAll', -5, 'A courtier arrested for wishing to leave'], ['attitude', -6]], text: '{courtier.first} is taken at the quay. The court grows very quiet.' },
    ],
  },
];
