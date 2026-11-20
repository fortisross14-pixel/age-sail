import type { StoryDef } from './types';

/** The colonies: settlers far from home, and what distance does to them. */
export const COLONIES: StoryDef[] = [
  {
    id: 'charter_plea', family: 'colonies', again: 20, about: { colony: 'disloyal uncharted' },
    title: 'A petition from {colony}',
    text: 'The settlers of {colony} send a petition: they ask for a council of their own, and lighter taxes.',
    choices: [
      { label: 'Grant a royal charter', hint: 'Loyalty up; half taxes from this colony', effects: [['charter'], ['loyalty', 20]], text: 'The settlers ring the church bell for {ruler}.' },
      { label: 'Send gifts and a kind letter', effects: [['ducats', -400], ['loyalty', 10]], text: 'The settlers are pleased, but not satisfied.' },
      { label: 'Refuse', effects: [['loyalty', -12], ['later', 'charter_again', 12]], text: 'The petition is read aloud in the colony square and torn up.' },
    ],
  },
  {
    id: 'charter_again', family: 'colonies', chained: true,
    title: '{colony} asks again',
    text: 'The petition you refused has come back from {colony} with three times the signatures, and without the word “humbly”.',
    choices: [
      { label: 'Grant the charter now', effects: [['charter'], ['loyalty', 12]], text: 'It is granted. They remember that it had to be asked for twice.' },
      { label: 'Send soldiers with the answer', effects: [['garrison', 1], ['loyalty', -8], ['ducats', -300]], text: 'A company lands with the reply. Nobody signs anything for a while.' },
    ],
  },
  {
    id: 'smugglers', family: 'colonies', again: 24, about: { colony: 'any', crown: 'any' },
    title: 'Ships that come at night',
    text: 'Traders of {crown} have been putting in at {colony} after dark, selling cloth and tools cheaper than your own merchants and paying no dues.',
    choices: [
      { label: 'Turn a blind eye', effects: [['loyalty', 6], ['ducats', -150], ['attitude', 4]], text: 'The colony is better dressed, and your customs house poorer.' },
      { label: 'Seize the next one', effects: [['ducats', 400], ['loyalty', -6], ['attitude', -10]], text: 'A ship is taken with her cargo. The settlers miss her.' },
      { label: 'License it, for a fee', roll: ['ruler', 'commerce', 0.4, 0.15], effects: [['ducats', 250], ['loyalty', 3]], text: 'The night traders become day traders and pay like everyone else.',
        else: { effects: [['loyalty', -3]], text: 'Nobody buys a licence for what they can do free.' } },
    ],
  },
  {
    id: 'hurricane', family: 'colonies', again: 30, about: { colony: 'any' }, when: [['chance', 0.5]],
    title: 'The great wind',
    text: 'A storm has gone over {colony} like a scythe: roofs off, the jetty gone, the fields under salt water.',
    choices: [
      { label: 'Send relief from the treasury', effects: [['ducats', -400], ['food', 10], ['loyalty', 8]], text: 'Your ships bring timber, nails and flour. They are met with cheering.' },
      { label: 'Remit their taxes for a year', effects: [['ducats', -200], ['loyalty', 5]], text: 'The settlers rebuild with what they have.' },
      { label: 'They will manage', effects: [['loyalty', -10], ['food', -10], ['pop', -1]], text: 'They manage. A family gives up and sails home.' },
    ],
  },
  {
    id: 'governor_abuse', family: 'colonies', again: 36, about: { colony: 'big' },
    title: 'Complaints against your officers',
    text: 'Letters from {colony} accuse your officers there of taking the best land for themselves and flogging those who objected.',
    choices: [
      { label: 'Send a judge to hear both sides', effects: [['ducats', -250], ['loyalty', 10]], text: 'Two officers come home in disgrace. The colony has seen that you listen.' },
      { label: 'Stand by your officers', effects: [['loyalty', -12]], text: 'The letter writers are fined for slander.' },
    ],
  },
  {
    id: 'gone_native', family: 'colonies', again: 36, about: { colony: 'any', people: 'neighbour peace' },
    title: 'Those who walked away',
    text: 'Three families of {colony} have left their plots and gone to live among {people}, where, they say, nobody starves and nobody is flogged.',
    choices: [
      { label: 'Let them go', effects: [['pop', -1], ['regard', 6, 'Settlers who came to live among them']], text: 'In time their children will speak both tongues.' },
      { label: 'Demand them back', effects: [['regard', -10, 'Guests demanded back like runaway cattle'], ['loyalty', -4]], text: 'They are brought back, and watched.' },
      { label: 'Ask what they found there', effects: [['food', 8], ['research', 6], ['pop', -1]], text: 'They show your settlers which roots to plant and when. The colony eats better.' },
    ],
  },
  {
    id: 'first_church', family: 'colonies', about: { colony: 'new' },
    title: 'A church for {colony}',
    text: 'The settlers of {colony} hear Mass under a sailcloth awning. They ask for stone, a bell, and a priest who will stay.',
    choices: [
      { label: 'Build it', effects: [['ducats', -350], ['loyalty', 10], ['prestige', 3]], text: 'The bell is cast in {capital} and carried out wrapped in straw.' },
      { label: 'A wooden chapel first', effects: [['ducats', -100], ['loyalty', 4]], text: 'It smells of pitch and is full every Sunday.' },
      { label: 'Later', effects: [['loyalty', -3]], text: 'The awning is patched again.' },
    ],
  },
  {
    id: 'unpaid_garrison', family: 'colonies', again: 30, about: { colony: 'garrison' }, when: [['treasury', '<', 1000]],
    title: 'Soldiers without pay',
    text: 'The garrison of {colony} has had no wages for two seasons. The soldiers have started collecting them from the settlers.',
    choices: [
      { label: 'Find the money', effects: [['ducats', -300], ['loyalty', 4]], text: 'The pay chest arrives under guard. The soldiers give back most of the chickens.' },
      { label: 'Pay them in land', effects: [['loyalty', -3], ['pop', 1]], text: 'Half the garrison becomes farmers. They are better at it than at soldiering.' },
      { label: 'Order them to behave', effects: [['loyalty', -10]], text: 'The order is read to them. They laugh.' },
    ],
  },
  {
    id: 'fever_season', family: 'colonies', again: 28, about: { colony: 'any' }, when: [['chance', 0.5]],
    title: 'The sickly season',
    text: 'The rains have brought a shaking fever to {colony}. The newcomers die fastest.',
    choices: [
      { label: 'Send physicians and bark', effects: [['ducats', -250], ['loyalty', 4]], text: 'The physicians bleed everyone, which does no good, and move the houses uphill, which does.' },
      { label: 'Move the settlement to higher ground', effects: [['ducats', -150], ['food', -6]], text: 'A season’s work is lost. Next year fewer die.' },
      { label: 'Pray', effects: [['pop', -1], ['loyalty', -3]], text: 'The graveyard grows by a row.' },
    ],
  },
  {
    id: 'gold_rumour', family: 'colonies', again: 40, about: { colony: 'any' }, when: [['newWorld']],
    title: 'Gold, upriver',
    text: 'A trader has shown a gold nose-ring in the tavern of {colony} and pointed inland. Half the men want to drop their hoes and go.',
    choices: [
      { label: 'Send a proper expedition', roll: ['none', 'navigation', 0.3, 0], effects: [['ducats', 900], ['prestige', 6]], text: 'They come back thin, sunburned and carrying real gold.',
        else: { effects: [['ducats', -300], ['pop', -1]], text: 'They come back thinner, fewer, and with nothing.' } },
      { label: 'Forbid anyone to leave the fields', effects: [['loyalty', -6], ['food', 6]], text: 'The harvest is good. The grumbling is worse.' },
      { label: 'Let them go', effects: [['pop', -1], ['food', -8]], text: 'Some never return. The fields go to weed.' },
    ],
  },
  {
    id: 'first_born', family: 'colonies', about: { colony: 'old' },
    title: 'Born here',
    text: 'The council of {colony} notes that more than half its people have never seen {me}. They were born here, and so were their parents.',
    choices: [
      { label: 'Bring their sons to court for a year', effects: [['ducats', -300], ['loyalty', 10]], text: 'The young men return with fine clothes and a clearer idea of whose subjects they are.' },
      { label: 'Send a royal visitor', effects: [['ducats', -150], ['loyalty', 5], ['prestige', 2]], text: 'A cousin of {ruler} is seasick both ways and cheered on arrival.' },
      { label: 'It changes nothing', effects: [['loyalty', -4]], text: 'It changes something.' },
    ],
  },
  {
    id: 'land_dispute', family: 'colonies', again: 30, about: { colony: 'any', people: 'neighbour peace' },
    title: 'Whose field?',
    text: 'Settlers of {colony} have fenced a meadow that {people} burn every spring for the deer. Both sides have come to your officer, armed.',
    choices: [
      { label: 'Take down the fence', effects: [['regard', 10, 'A fence taken down at their asking'], ['loyalty', -5]], text: 'The fence comes down. The deer come back.' },
      { label: 'Pay for the meadow', effects: [['ducats', -200], ['regard', 4, 'Paid for a meadow']], text: 'Cloth, kettles and knives change hands. Everyone agrees it is a kind of sale.' },
      { label: 'The fence stays', effects: [['regard', -14, 'A meadow fenced against them'], ['loyalty', 4]], text: 'The settlers plough it. Somebody burns a barn in the autumn.' },
    ],
  },
  {
    id: 'corsairs_colony', family: 'colonies', again: 30, about: { colony: 'nogarrison' },
    title: 'Sails off {colony}',
    text: 'Three ships without colours have anchored off {colony}. Their captain sends a boat: a thousand ducats, or he burns the town.',
    choices: [
      { label: 'Pay', effects: [['ducats', -1000]], text: 'He counts it twice and sails. He will be back next year.' },
      { label: 'Arm the settlers', roll: ['none', 'military', 0.4, 0], effects: [['prestige', 8], ['loyalty', 8]], text: 'Old guns, fishing boats and a great deal of noise. He decides against it.',
        else: { effects: [['pop', -1], ['food', -10], ['loyalty', -6]], text: 'The warehouses burn. He leaves at his leisure.' } },
      { label: 'Send a garrison, too late for this time', effects: [['ducats', -500], ['garrison', 1], ['food', -8]], text: 'He takes what he can carry. When he comes back there are soldiers.' },
    ],
  },
  {
    id: 'colony_school', family: 'colonies', about: { colony: 'big loyal' },
    title: 'Letters for {colony}',
    text: 'A friar in {colony} asks for books and a room: he would teach the settlers’ children, and any children of the country who wish it, to read.',
    choices: [
      { label: 'Endow a school', effects: [['ducats', -400], ['loyalty', 6], ['research', 10], ['prestige', 3]], text: 'The first pupils learn their letters from a sailing manual, for want of anything else.' },
      { label: 'Children should be in the fields', effects: [['food', 4]], text: 'The friar teaches on Sundays, behind the church.' },
    ],
  },
  {
    id: 'convicts', family: 'colonies', again: 40, about: { colony: 'any' },
    title: 'Settlers nobody wants',
    text: 'The gaols of {capital} are full. Your judges propose to empty them into {colony}: a pardon for anyone who will go.',
    choices: [
      { label: 'Send them', effects: [['pop', 2], ['loyalty', -8]], text: 'Two shiploads land, blinking. Some become honest. The colony locks its doors.' },
      { label: 'Only those who ask to go', effects: [['pop', 1], ['loyalty', -2]], text: 'A handful volunteer, and work hard to be forgotten.' },
      { label: 'A colony is not a gaol', effects: [['loyalty', 4]], text: 'The settlers hear of it and are grateful.' },
    ],
  },
  {
    id: 'brides', family: 'colonies', again: 40, about: { colony: 'any' },
    title: 'A colony of bachelors',
    text: '{colony} is a town of men. Your officer writes that they will drift away or drink themselves to death unless they have families.',
    choices: [
      { label: 'Dower women who will sail', effects: [['ducats', -500], ['pop', 2], ['loyalty', 8]], text: 'Orphans, widows and younger daughters go out with a chest each. There are forty weddings in a month.' },
      { label: 'Let the men marry where they are', effects: [['loyalty', 3]], text: 'They already have. The church catches up.' },
    ],
  },
  {
    id: 'tavern_riot', family: 'colonies', again: 30, about: { colony: 'garrison big' },
    title: 'A night of broken heads',
    text: 'A soldier and a settler quarrelled over dice in {colony}; by morning there was a dead man on each side and the garrison had shut itself in the fort.',
    choices: [
      { label: 'Try the soldier by colony law', effects: [['loyalty', 8], ['prestige', -2]], text: 'He hangs. The garrison is sullen and the town is satisfied.' },
      { label: 'A military court', effects: [['loyalty', -8]], text: 'He is reprimanded. The town does not forget.' },
      { label: 'Blood money to both families', effects: [['ducats', -250], ['loyalty', 2]], text: 'Silver settles what law could not.' },
    ],
  },
];
