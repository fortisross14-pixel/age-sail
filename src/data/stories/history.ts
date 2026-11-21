import type { StoryDef } from './types';

/**
 * History: three set pieces for each crown, at about the years they happened. Each is told once,
 * and only to the crown it belongs to. They are choices, not lessons: the game does not make the
 * player repeat what was done.
 */
export const HISTORY: StoryDef[] = [
  // ---- Castile ----
  {
    id: 'es_granada', family: 'history', when: [['crown', 'spain'], ['year', '<', 1500]],
    title: 'After Granada',
    text: 'The last Moorish kingdom in Iberia has fallen to you. Its people were promised their faith and their laws. Your confessor says a promise to unbelievers does not bind; your treasurer says they are the best farmers and weavers you have.',
    choices: [
      { label: 'Keep the promise', effects: [['ducats', 500], ['prestige', -5], ['flag', 'tolerant'], ['research', 10]], text: 'The silk looms of Granada keep working. Rome is displeased.' },
      { label: 'Baptism or exile', effects: [['prestige', 8], ['ducats', -400], ['research', -8], ['flag', 'old_faith'], ['later', 'es_alpujarras', 24]], text: 'The mosques become churches. Thousands leave, and those who stay remember.' },
    ],
  },
  {
    id: 'es_alpujarras', family: 'history', chained: true,
    title: 'Revolt in the mountains',
    text: 'The forced converts of Granada have risen in the Alpujarras. It will take an army, and a season’s revenue, to put them down.',
    choices: [
      { label: 'Send the army', effects: [['ducats', -700], ['prestige', 3]], text: 'The villages are taken one by one. The silk trade does not recover.' },
      { label: 'Offer terms', effects: [['ducats', -200], ['prestige', -4]], text: 'A tense peace. Your confessor will not speak to you for a month.' },
    ],
  },
  {
    id: 'es_comuneros', family: 'history', when: [['crown', 'spain'], ['year', '>=', 1518], ['year', '<', 1526]],
    title: 'The towns rise',
    text: 'Toledo, Segovia and Salamanca have thrown out your officers. The towns of Castile say they are taxed for foreign wars and governed by strangers, and they have raised an army of weavers and hidalgos.',
    choices: [
      { label: 'Hear their grievances', effects: [['ducats', -500], ['prestige', -4], ['loyaltyAll', 6], ['courtAll', 3, 'The towns of Castile heard']], text: 'Taxes are lightened and offices go to natives of the realm. The towns disarm.' },
      { label: 'Crush them', roll: ['ruler', 'military', 0.6, 0.1], effects: [['prestige', 8], ['loyaltyAll', -4]], text: 'The army of the towns is broken in an afternoon. Their captains are beheaded.',
        else: { effects: [['ducats', -900], ['prestige', -6]], text: 'It takes two years and a fortune. The towns do not forgive.' } },
    ],
  },
  {
    id: 'armada', family: 'history', when: [['crown', 'spain'], ['year', '>=', 1586], ['year', '<', 1591]],
    title: 'The Great Armada',
    text: 'Your admirals urge a great armada against England, and every port is asked to give a ship or the money for one.',
    choices: [
      { label: 'Send a galleon', need: [['galleonHome']], hint: 'Lose the ship; +40 prestige', effects: [['special', 'sendGalleon'], ['prestige', 40], ['flag', 'armada_sailed']], text: 'She sails with the Armada. She does not come back, but nobody doubts who answered.' },
      { label: 'Pay for the fleet', effects: [['ducats', -3000], ['prestige', 15]], text: 'Your ducats pay for cannon and biscuit.' },
      { label: 'Not this year', effects: [['prestige', -20]], text: 'The admirals grumble, and the court talks of nothing else for a season.' },
    ],
  },
  // ---- Portugal ----
  {
    id: 'pt_india', family: 'history', when: [['crown', 'portugal'], ['year', '>=', 1495], ['year', '<', 1502]],
    title: 'The road to India',
    text: 'Your pilots have rounded the last cape of Africa. A gentleman of your household asks for four ships to go on: to Calicut, and the pepper that Venice sells at ten times what it costs.',
    choices: [
      { label: 'Fit out the fleet', effects: [['ducats', -1200], ['flag', 'india_fleet'], ['later', 'pt_india_returns', 10]], text: 'Four ships drop down the Tejo. Half of Lisboa is on the quay.' },
      { label: 'The Atlantic first', effects: [['prestige', -5]], text: 'The gentleman bows, and writes to Castile.' },
    ],
  },
  {
    id: 'pt_india_returns', family: 'history', chained: true,
    title: 'Two ships come home',
    text: 'Of the four ships sent to India, two have come back, with a third of their men. Their holds are full of pepper and cinnamon, worth sixty times the cost of the voyage.',
    choices: [
      { label: 'A royal monopoly on spice', effects: [['ducats', 4000], ['prestige', 25], ['attitudeAll', -6]], text: 'The price of pepper in Venice falls in a week. Lisboa is the richest port in Europe.' },
      { label: 'Open the trade to your merchants', effects: [['ducats', 2000], ['prestige', 15], ['courtAll', 4, 'The spice trade opened to all']], text: 'A hundred small fortunes are made instead of one great one.' },
    ],
  },
  {
    id: 'pt_morocco', family: 'history', when: [['crown', 'portugal'], ['year', '>=', 1570], ['year', '<', 1582]],
    title: 'A crusade in Morocco',
    text: 'The young men of the court dream of a great crusade across the strait: a battle that would make {ruler} the champion of Christendom. Your old captains say the desert has eaten better armies.',
    choices: [
      { label: 'March', roll: ['ruler', 'military', 0.25, 0.15], effects: [['prestige', 40], ['ducats', 1500]], text: 'Against every expectation the field is yours. Bells ring from Lagos to Porto.',
        else: { effects: [['ducats', -3000], ['prestige', -25], ['rulerFrail', 20], ['courtAll', -4, 'The flower of the realm lost in Morocco']], text: 'The army dies in the heat at a river crossing. Ransoms empty the kingdom, and the succession is in doubt.' } },
      { label: 'Keep the forts, and the peace', effects: [['prestige', -5], ['ducats', 300]], text: 'The young men sulk. The old captains sleep soundly.' },
    ],
  },
  {
    id: 'pt_union', family: 'history', when: [['crown', 'portugal'], ['year', '>=', 1578], ['year', '<', 1590], ['noheir']],
    title: 'The crown of two kingdoms',
    text: 'With no heir of the body, the King of Castile presses a claim to your throne, with an army on the border and silver for your nobles.',
    choices: [
      { label: 'Find an heir at home, whatever it costs', effects: [['ducats', -1500], ['heirBorn'], ['attitudeAll', -3], ['prestige', 10]], text: 'A cousin of the house is acclaimed in the streets. Castile’s army stays on its side of the river.' },
      { label: 'Negotiate from strength', effects: [['ducats', 2000], ['prestige', -15], ['loyaltyAll', -6]], text: 'Portugal keeps her laws, her ships and her colonies. Her foreign policy is decided elsewhere.' },
    ],
  },
  // ---- England ----
  {
    id: 'en_cabot', family: 'history', when: [['crown', 'england'], ['year', '>=', 1494], ['year', '<', 1500]],
    title: 'A Venetian in Bristol',
    text: 'A Venetian pilot settled in Bristol asks for letters patent: he will find a way to Asia by the north-west, at the Bristol merchants’ cost, if he may hold what he finds in your name.',
    choices: [
      { label: 'Grant the patent', effects: [['research', 20], ['prestige', 5], ['later', 'en_cabot_returns', 6]], text: 'One small ship, eighteen men, and the royal arms on a sheet of vellum.' },
      { label: 'Grant it, with ten pounds', effects: [['ducats', -200], ['research', 25], ['prestige', 6], ['later', 'en_cabot_returns', 6]], text: 'He is delighted with the vellum and astonished by the money.' },
      { label: 'Bristol men chase fish, not Asia', effects: [], text: 'He takes his chart elsewhere.' },
    ],
  },
  {
    id: 'en_cabot_returns', family: 'history', chained: true,
    title: 'A new-found land',
    text: 'The Venetian is back in Bristol. He found no silk and no spice: a cold coast, tall timber, and a sea so full of cod that they can be taken in baskets.',
    choices: [
      { label: 'Fish are silver too', effects: [['ducats', 600], ['research', 10], ['prestige', 5]], text: 'Bristol sends forty boats to the banks next spring.' },
      { label: 'Send him again, further', effects: [['ducats', -300], ['research', 25]], text: 'He sails with five ships. The charts they send back are worth the cost.' },
    ],
  },
  {
    id: 'en_rome', family: 'history', when: [['crown', 'england'], ['year', '>=', 1528], ['year', '<', 1540]],
    title: 'The great matter',
    text: 'The Pope will not grant what the Crown needs for the succession, and a third of England’s land belongs to monasteries that answer to him. Your secretary has a bill ready that would make {ruler} head of the Church in England.',
    choices: [
      { label: 'Break with Rome', effects: [['ducats', 5000], ['prestige', -10], ['attitudeAll', -10], ['flag', 'new_ideas'], ['courtAll', -3, 'The old Church put down']], text: 'The abbeys are dissolved and their lands sold. The treasury has never been so full, nor the realm so divided.' },
      { label: 'Stay in the fold', effects: [['prestige', 8], ['attitudeAll', 5], ['flag', 'old_faith']], text: 'The bill is burned. The succession remains a question.' },
    ],
  },
  {
    id: 'en_armada', family: 'history', when: [['crown', 'england'], ['year', '>=', 1586], ['year', '<', 1591]],
    title: 'Beacons on the cliffs',
    text: 'The King of Castile is gathering the greatest fleet ever seen, to carry an army across the Channel. Your sea captains ask for powder, shot and the freedom to fight their own way.',
    choices: [
      { label: 'Give the captains what they ask', roll: ['ruler', 'military', 0.6, 0.1], effects: [['ducats', -1500], ['prestige', 40]], text: 'Fireships, a gale, and the wreck of an empire’s pride on the rocks of Ireland.',
        else: { effects: [['ducats', -2500], ['prestige', 10], ['loyaltyAll', -3]], text: 'They are held off, at a terrible price in ships and money.' } },
      { label: 'Treat for peace', effects: [['ducats', -1000], ['prestige', -15]], text: 'Gold buys a year. The fleet is still there.' },
    ],
  },
  // ---- France ----
  {
    id: 'fr_italy', family: 'history', when: [['crown', 'france'], ['year', '<', 1500]],
    title: 'The road to Naples',
    text: 'An old claim gives {ruler} a right to the crown of Naples. The finest army in Europe is ready, the passes are open, and Italy is rich and divided. Your admiral would rather have the money for ships.',
    choices: [
      { label: 'Cross the Alps', roll: ['ruler', 'military', 0.5, 0.1], effects: [['ducats', 1500], ['prestige', 20], ['attitudeAll', -8]], text: 'Naples falls without a siege. All Italy, and then all Europe, begins to combine against you.',
        else: { effects: [['ducats', -2000], ['prestige', -8], ['attitudeAll', -8]], text: 'Naples is won and lost in a year, and the army comes home with a new disease.' } },
      { label: 'Ships, not sieges', effects: [['research', 20], ['prestige', -5]], text: 'The army is paid off. The dockyards of the Atlantic coast are busy.' },
    ],
  },
  {
    id: 'fr_verrazzano', family: 'history', when: [['crown', 'france'], ['year', '>=', 1520], ['year', '<', 1530]],
    title: 'The will of Adam',
    text: 'Castile and Portugal have divided the world between them. “I should like to see the clause in Adam’s will that excludes me,” says {ruler}. A Florentine pilot, backed by the silk merchants of Lyon, offers to find France a share.',
    choices: [
      { label: 'Send him', effects: [['ducats', -500], ['research', 30], ['prestige', 8], ['attitudeAll', -3]], text: 'He coasts a thousand leagues of unknown shore and names every bay for someone at court.' },
      { label: 'Not while there is war in Italy', effects: [], text: 'The pilot waits. The silk merchants grow impatient.' },
    ],
  },
  {
    id: 'fr_religion', family: 'history', when: [['crown', 'france'], ['year', '>=', 1558], ['year', '<', 1570]],
    title: 'Two faiths in one kingdom',
    text: 'A tenth of your subjects, and half your nobility, now follow the reformed faith. They have armies, towns and friends abroad. So do those who would see them burned.',
    choices: [
      { label: 'An edict of toleration', effects: [['prestige', -5], ['loyaltyAll', 5], ['research', 10], ['flag', 'tolerant']], text: 'Nobody is satisfied, and nobody is killed. It may hold.' },
      { label: 'One king, one law, one faith', effects: [['ducats', -1500], ['prestige', 5], ['loyaltyAll', -5], ['flag', 'old_faith']], text: 'The wars begin. They will outlast you.' },
      { label: 'Let them settle beyond the sea', need: [['newWorld']], effects: [['loyaltyAll', -3], ['prestige', 3], ['flag', 'tolerant']], text: 'A fleet of the reformed sails west to build a colony of their own, under your flag.' },
    ],
  },
  // ---- the Netherlands ----
  {
    id: 'nl_towns', family: 'history', when: [['crown', 'netherlands'], ['year', '<', 1500]],
    title: 'The privileges of the towns',
    text: 'Gent and Brugge have old charters that let them refuse a tax, close their gates and try your officers in their own courts. Your council wants them torn up. The towns pay most of your revenue.',
    choices: [
      { label: 'Confirm the charters', effects: [['ducats', 600], ['prestige', -3], ['courtAll', 2, 'The towns’ charters confirmed']], text: 'The towns vote a generous subsidy, this once, of their own free will.' },
      { label: 'One law for all the provinces', effects: [['ducats', -400], ['prestige', 6]], text: 'Brugge shuts its gates for a season, then opens them, sourly.' },
    ],
  },
  {
    id: 'nl_images', family: 'history', when: [['crown', 'netherlands'], ['year', '>=', 1562], ['year', '<', 1570]],
    title: 'The breaking of the images',
    text: 'In a single summer, crowds have stripped the statues and glass from four hundred churches. The preachers who led them are artisans and merchants: the people who pay your taxes and crew your ships.',
    choices: [
      { label: 'Freedom of conscience', effects: [['prestige', -6], ['research', 15], ['ducats', 500], ['flag', 'tolerant']], text: 'The whitewashed churches fill. So do the workshops, with refugees from stricter lands.' },
      { label: 'Restore the old order by force', effects: [['ducats', -1500], ['loyaltyAll', -6], ['prestige', 5], ['flag', 'old_faith']], text: 'There are executions in every market square. Ten thousand weavers leave for England.' },
    ],
  },
  {
    id: 'nl_company', family: 'history', when: [['crown', 'netherlands'], ['year', '>=', 1598], ['year', '<', 1608]],
    title: 'One company for the Indies',
    text: 'A dozen small companies from as many towns are ruining each other in the spice trade. Your advocate proposes to merge them into one, with a monopoly, its own soldiers, and shares that any citizen may buy.',
    choices: [
      { label: 'Charter the company', effects: [['ducats', 3000], ['prestige', 15], ['research', 15]], text: 'A maid in Amsterdam buys a share with her savings. In twenty years it will be the richest company in the world.' },
      { label: 'Let the towns compete', effects: [['courtAll', 2, 'The towns left their own trade']], text: 'The towns keep their independence, and their losses.' },
    ],
  },
];
