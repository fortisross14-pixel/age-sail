import type { StoryDef } from './types';

/** At sea: hunger, weather, strangers and the temper of crews. */
export const SEA: StoryDef[] = [
  {
    id: 'mutiny', family: 'sea', again: 16, about: { fleet: 'atSea lowStores led', courtier: 'leader' },
    title: 'Mutiny brewing',
    text: 'With food running short, the crews of {fleet} gather at the mast. They want to turn back, and they want it now. {courtier} must answer them.',
    choices: [
      { label: 'Hang the ringleaders', roll: ['courtier', 'military', 0.4, 0.12], effects: [], text: '{courtier} hangs two sailors from the yard. The rest go back to work, silent.',
        else: { effects: [['crew', 0.2]], text: 'The hanging sparks a fight on deck. Sailors die before order returns.' } },
      { label: 'Promise them a share of the profits', effects: [['ducats', -300]], text: 'Promises of silver quiet the crews, for now.' },
      { label: 'Give in, and turn back', effects: [['halt'], ['opinion', 'courtier', -4, 'Made to turn back by their own crew']], text: 'The fleet stops where it is and waits for new orders.' },
    ],
  },
  {
    id: 'survivors', family: 'sea', again: 24, about: { fleet: 'atSea', crown: 'any' }, when: [['chance', 0.5]],
    title: 'Survivors at sea',
    text: '{fleet} finds a boat of survivors from a wrecked ship of {crown}, half dead from thirst.',
    choices: [
      { label: 'Take them aboard and send them home', effects: [['attitude', 15], ['stores', -1]], text: 'The survivors are landed at the next port with food and a letter of courtesy.' },
      { label: 'Hold them for ransom', effects: [['ducats', 400], ['attitude', -20], ['flag', 'ransomed'], ['later', 'ransom_remembered', 16]], text: 'Their families pay. Their prince does not forget.' },
    ],
  },
  {
    id: 'ransom_remembered', family: 'sea', chained: true, about: {},
    title: 'An old ransom',
    text: 'A captain of {crown} takes one of your merchants off a coaster and sends word: he was a boy in a boat you held for ransom, once. He asks the same price, with interest.',
    choices: [
      { label: 'Pay it', effects: [['ducats', -600], ['unflag', 'ransomed']], text: 'The merchant comes home thinner. The account is closed.' },
      { label: 'Refuse', effects: [['prestige', -5], ['attitude', -10]], text: 'The merchant is not seen again, and the story is told in every port.' },
    ],
  },
  {
    id: 'becalmed', family: 'sea', again: 30, about: { fleet: 'atSea led', courtier: 'leader' },
    title: 'Becalmed',
    text: 'For three weeks no wind has touched the sails of {fleet}. The sea is glass, the water casks are sinking, and the men have begun to whistle for a breeze.',
    choices: [
      { label: 'Tow the ships with the boats', roll: ['courtier', 'navigation', 0.35, 0.12], effects: [['opinion', 'courtier', 3, 'Rowed the fleet out of a calm']], text: 'Two days of rowing find a cat’s-paw of wind, then a breeze.',
        else: { effects: [['crew', 0.08], ['stores', -1]], text: 'The men row until they drop. The calm holds another week.' } },
      { label: 'Cut the rations and wait', effects: [['stores', -1]], text: 'Half a biscuit a day. On the ninth morning the sails fill.' },
      { label: 'Lighten the ships', effects: [['cargoLose', 0.3]], text: 'Cargo goes over the side. The ships ride higher and catch the first breath of air.' },
    ],
  },
  {
    id: 'stowaway', family: 'sea', about: { fleet: 'atSea led', courtier: 'leader' },
    title: 'A stowaway',
    text: 'A boy of twelve is hauled out of the bread room of {fleet}. He ran from a tanner’s yard in {capital}, he says, and can read.',
    choices: [
      { label: 'Make him the pilot’s boy', effects: [['flag', 'stowaway'], ['later', 'stowaway_grown', 48]], text: 'He is given a slate and set to copying bearings.' },
      { label: 'Put him ashore at the next port', effects: [], text: 'He is left on a quay with a loaf and a coin.' },
    ],
  },
  {
    id: 'stowaway_grown', family: 'sea', chained: true,
    title: 'The pilot’s boy',
    text: 'The boy who hid in a bread room twelve years ago has come to court with a book of sailing directions for every coast he has seen, dedicated to {ruler}.',
    choices: [
      { label: 'Have it copied for every pilot', effects: [['research', 25], ['prestige', 5]], text: 'The book is chained to a desk in {capital}, and pilots queue to read it.' },
      { label: 'Keep it secret', effects: [['research', 12], ['attitudeAll', 2]], text: 'One copy, under lock. What rivals do not know cannot help them.' },
    ],
  },
  {
    id: 'lights', family: 'sea', again: 40, about: { fleet: 'atSea deep led', courtier: 'leader' },
    title: 'Fire on the mastheads',
    text: 'In the night a pale fire burns on every masthead of {fleet}. The old hands say it is the saint’s own candle; the young ones say the ships are cursed and beg {courtier} to turn for home.',
    choices: [
      { label: 'Call it a blessing, loudly', roll: ['courtier', 'diplomacy', 0.45, 0.12], effects: [['opinion', 'courtier', 2, 'Steadied a frightened crew']], text: '{courtier.first} leads a hymn to {saint}. By morning the men are boasting of it.',
        else: { effects: [['halt']], text: 'Nobody believes it. The watch will not go aloft, and the fleet lies to.' } },
      { label: 'Explain that it is a thing of the air', need: [['tech', 'astrolabe']], effects: [['research', 6]], text: 'The pilot notes it in the log as a meteor of the upper air. The crew are not convinced, but they obey.' },
      { label: 'Turn back', effects: [['halt'], ['prestige', -3]], text: 'The fleet comes about. The story of the cursed sea goes home with it.' },
    ],
  },
  {
    id: 'lemons', family: 'sea', about: { fleet: 'atSea', courtier: 'learned' }, when: [['noflag', 'lemons']],
    title: 'The surgeon’s notion',
    text: 'A ship’s surgeon writes to {courtier} that men who are given the juice of lemons do not lose their teeth on long voyages. He asks for money to try it on a whole fleet.',
    choices: [
      { label: 'Pay for the trial', effects: [['ducats', -250], ['research', 15], ['flag', 'lemons']], text: 'Barrels of lemons are loaded. The surgeon keeps careful lists of who sickens and who does not.' },
      { label: 'Sailors have always lost their teeth', effects: [], text: 'The letter is filed.' },
    ],
  },
  {
    id: 'pirates', family: 'sea', again: 20, about: { fleet: 'atSea cargo led', courtier: 'leader' },
    title: 'A strange sail',
    text: 'A low, fast ship has followed {fleet} since dawn and shows no colours. She is closing.',
    choices: [
      { label: 'Clear for action', roll: ['courtier', 'military', 0.35, 0.13], effects: [['ducats', 500], ['prestige', 4], ['hull', -10]], text: 'Two broadsides and she strikes. Her hold is full of other men’s cargo.',
        else: { effects: [['cargoLose', 0.5], ['hull', -25], ['crew', 0.1]], text: 'She rakes the fleet and takes what she wants.' } },
      { label: 'Crowd on sail and run', roll: ['courtier', 'navigation', 0.45, 0.12], effects: [], text: 'By nightfall she is hull down, and by morning gone.',
        else: { effects: [['cargoLose', 0.3], ['hull', -10]], text: 'She is faster. A warning shot, a boarding party, and a third of the cargo is hers.' } },
      { label: 'Heave to and pay', effects: [['ducats', -300]], text: 'A purse goes across in a boat. She bears away, laughing.' },
    ],
  },
  {
    id: 'wreck', family: 'sea', again: 30, about: { fleet: 'atSea' },
    title: 'A wreck on the reef',
    text: 'The lookouts of {fleet} sight a ship broken on a reef, her masts gone. There may be cargo in her, and the swell is rising.',
    choices: [
      { label: 'Send the boats in', roll: ['none', 'navigation', 0.6, 0], effects: [['ducats', 450]], text: 'Bales, an iron chest and three brass guns come out of her before the weather closes in.',
        else: { effects: [['crew', 0.06], ['hull', -8]], text: 'A boat is stove in on the coral. The wreck keeps what she has.' } },
      { label: 'Mark her on the chart and sail on', effects: [['research', 3]], text: 'The reef is drawn on the chart, with a cross for the wreck.' },
    ],
  },
  {
    id: 'fever_aboard', family: 'sea', again: 24, about: { fleet: 'atSea newWorld' },
    title: 'Fever in the fleet',
    text: 'A burning fever has come aboard {fleet} with the last watering. Six men are down and the surgeon wants the sick put in one ship.',
    choices: [
      { label: 'One ship for the sick', effects: [['crew', 0.06]], text: 'The sick ship trails a mile astern. Most of her people live.' },
      { label: 'Anchor and wait it out ashore', effects: [['halt'], ['stores', -1], ['crew', 0.03]], text: 'Tents on a beach, clean water, a fortnight lost. The fever burns out.' },
      { label: 'Press on', effects: [['crew', 0.18]], text: 'It runs through every ship. The dead are put over the side at dusk.' },
    ],
  },
  {
    id: 'pilot', family: 'sea', again: 60, about: { coast: 'unknown' },
    title: 'A pilot’s secret',
    text: 'An old pilot in the taverns of {capital} says he has seen coasts no chart shows. For a price he will draw them.',
    choices: [
      { label: 'Buy his chart', effects: [['ducats', -300], ['special', 'chartCoast']], text: 'His chart is rough, but true: a stretch of unknown coast is now on your maps.' },
      { label: 'Laugh him out of the room', effects: [], text: 'The pilot spits, and goes looking for another buyer.' },
    ],
  },
  {
    id: 'two_logs', family: 'sea', about: { fleet: 'atSea deep led', courtier: 'leader explorer' },
    title: 'Two logs',
    text: 'The crews of {fleet} count the leagues from home each night and grow afraid. {courtier} could keep a second log, with shorter distances, to show them.',
    choices: [
      { label: 'Keep the false log', roll: ['courtier', 'diplomacy', 0.5, 0.1], effects: [], text: 'The men are told they are closer to home than they are, and sleep.',
        else: { effects: [['halt'], ['opinion', 'courtier', -5, 'Caught lying to the crew']], text: 'A boatswain can count too. The lie is found out and nobody will go on.' } },
      { label: 'Tell them the truth', effects: [['prestige', 2]], text: '{courtier.first} reads the true figures aloud. Some weep. They keep sailing.' },
    ],
  },
  {
    id: 'great_fish', family: 'sea', again: 36, about: { fleet: 'atSea' },
    title: 'A great fish',
    text: 'A whale has been swimming beside {fleet} all morning. The cooks look at it and then at the empty casks.',
    choices: [
      { label: 'Lower the boats', roll: ['none', 'military', 0.55, 0], effects: [['stores', 2]], text: 'It takes all day and a broken boat, but there is meat and oil for weeks.',
        else: { effects: [['crew', 0.04]], text: 'One blow of its tail, and a boat’s crew is in the water.' } },
      { label: 'Let it be', effects: [], text: 'It sounds at dusk and is not seen again.' },
    ],
  },
  {
    id: 'stolen_chart', family: 'sea', about: { coast: 'unknown', crown: 'peace' }, when: [['treasury', '>=', 600]],
    title: 'A chart with another crown’s seal',
    text: 'A clerk who has left the service of {crown} in a hurry offers a chart from their own archive, seal and all.',
    choices: [
      { label: 'Buy it, quietly', effects: [['ducats', -500], ['special', 'chartCoast'], ['research', 8], ['attitude', -12]], text: 'It is the real thing. So, in time, is the complaint from their ambassador.' },
      { label: 'Hand him back', effects: [['attitude', 12]], text: 'The clerk is returned in irons. Their ambassador is almost warm.' },
    ],
  },
  {
    id: 'storm_vow', family: 'sea', again: 40, about: { fleet: 'atSea led', courtier: 'leader' },
    title: 'A vow in the storm',
    text: 'In the worst of a gale the people of {fleet} swore that if they lived they would walk barefoot to the shrine of {saint}. They lived. The pilgrimage would cost a month.',
    choices: [
      { label: 'Keep the vow', effects: [['ducats', -150], ['prestige', 4], ['opinion', 'courtier', 2, 'Allowed to keep a vow']], text: 'A hundred sailors walk in their shirts behind a candle as tall as a mast.' },
      { label: 'A Mass will do', effects: [['opinion', 'courtier', -2, 'Kept from a vow']], text: 'A Mass is said on the quay. The men think it cheap.' },
    ],
  },
  {
    id: 'deserters', family: 'sea', again: 30, about: { fleet: 'cargo', courtier: 'merchant' },
    title: 'Men who do not come back aboard',
    text: 'In a rich port a dozen of the best hands of {fleet} have not answered the muster. The taverns say another captain is paying double.',
    choices: [
      { label: 'Match his wages', effects: [['ducats', -200]], text: 'They come back, grinning.' },
      { label: 'Sail short-handed', effects: [['crew', 0.1]], text: 'The fleet warps out with empty places at every sweep.' },
      { label: 'Have the watch drag them back', roll: ['courtier', 'diplomacy', 0.4, 0.12], effects: [], text: 'The harbour master obliges. The men are returned, sullen.',
        else: { effects: [['ducats', -150], ['crew', 0.1]], text: 'The harbour master fines you for a brawl, and the men are gone anyway.' } },
    ],
  },
];
