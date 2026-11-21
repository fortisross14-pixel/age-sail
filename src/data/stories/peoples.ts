import type { StoryDef } from './types';

/** The peoples: every coast belongs to someone, and they have their own minds. */
export const PEOPLES: StoryDef[] = [
  {
    id: 'envoys', family: 'peoples', again: 24, about: { people: 'peace' },
    title: 'Envoys from across the sea',
    text: 'Envoys of {people} have come aboard one of your ships with gifts, asking what the strangers want in their land.',
    choices: [
      { label: 'Exchange gifts and swear friendship', effects: [['ducats', -200], ['regard', 20, 'Friendship sworn with their envoys']], text: 'The envoys leave with mirrors, cloth and a sword for their chief.' },
      { label: 'Ask them to guide your explorers', hint: 'Their lands are charted', effects: [['special', 'guideLands']], text: 'They draw their country in the sand: rivers, villages, mountains.' },
      { label: 'Send them away', effects: [['regard', -15, 'Their envoys sent away']], text: 'The envoys leave in silence.' },
    ],
  },
  {
    id: 'chiefs_son', family: 'peoples', about: { people: 'friendly' }, when: [['noflag', 'guest_prince']],
    title: 'A guest from {people}',
    text: 'The chief of {people} offers to send his son to live at your court for some years, to learn your tongue and see whether what your sailors say of {capital} is true.',
    choices: [
      { label: 'Receive him as a prince', effects: [['ducats', -300], ['regard', 10, 'Their chief’s son received with honour'], ['flag', 'guest_prince'], ['later', 'chiefs_son_returns', 24]], text: 'He is lodged in {court}, learns chess in a week, and asks hard questions.' },
      { label: 'Receive him as a curiosity', effects: [['prestige', 4], ['regard', -6, 'Their chief’s son shown like a strange beast'], ['flag', 'guest_prince'], ['later', 'chiefs_son_returns', 24]], text: 'The court stares. He stares back, and remembers.' },
      { label: 'Decline', effects: [['regard', -4, 'An offered guest refused']], text: 'The offer is not repeated.' },
    ],
  },
  {
    id: 'chiefs_son_returns', family: 'peoples', chained: true,
    title: 'The guest goes home',
    text: 'The young man who came to your court from {people} is going home, a head taller, with your language, a trunk of books and his own opinion of you.',
    choices: [
      { label: 'Send him with gifts and an escort', effects: [['ducats', -200], ['regard', 15, 'Their prince returned with honour'], ['research', 8]], text: 'He will rule there one day, and he will know exactly whom he is dealing with.' },
      { label: 'Wish him a safe voyage', effects: [['regard', 4, 'Their prince came home']], text: 'He bows as he was taught, and does not look back.' },
    ],
  },
  {
    id: 'interpreter', family: 'peoples', about: { people: 'met', courtier: 'envoy' },
    title: 'A tongue between two worlds',
    text: '{courtier} has found a woman of {people} who speaks four languages and learned yours in a month. She will translate, for a price, and she will not be anyone’s servant.',
    choices: [
      { label: 'Meet her price', effects: [['ducats', -250], ['regard', 8, 'An interpreter who is listened to'], ['skill', 'courtier', 'diplomacy', 1]], text: 'For the first time both sides know what the other actually said.' },
      { label: 'Make do with signs', effects: [], text: 'Trade goes on by pointing. Misunderstandings go on too.' },
    ],
  },
  {
    id: 'sacred_ground', family: 'peoples', again: 40, about: { colony: 'any', people: 'neighbour' },
    title: 'The hill of the ancestors',
    text: 'The settlers of {colony} have been quarrying stone from a hill where {people} lay their dead. An old man came to ask them to stop. They did not understand him, or said they did not.',
    choices: [
      { label: 'Stop the quarry and make amends', effects: [['ducats', -150], ['regard', 12, 'The hill of their dead left in peace'], ['loyalty', -3]], text: 'The stone is carried back. It is not the same, but it is seen.' },
      { label: 'Quarry somewhere else, quietly', effects: [['regard', -4, 'Stone taken from the hill of their dead']], text: 'The cutting stops. The scar on the hill stays.' },
      { label: 'Stone is stone', effects: [['regard', -20, 'The hill of their dead broken for building stone'], ['loyalty', 3]], text: 'The church of {colony} is built of it.' },
    ],
  },
  {
    id: 'blamed_sickness', family: 'peoples', again: 40, about: { people: 'peace weak' },
    title: 'The coughing death',
    text: 'So many of {people} have died that there are villages with nobody left to bury the last. The living say it came in your ships. They are right.',
    choices: [
      { label: 'Send food and whoever knows any medicine', effects: [['ducats', -300], ['regard', 12, 'Help sent in the time of sickness']], text: 'It saves few. It is remembered by all.' },
      { label: 'Keep your people away from theirs', effects: [['regard', -4, 'Left alone in the time of sickness']], text: 'The trading ground stands empty for a season.' },
      { label: 'Say it is the judgment of God', effects: [['regard', -15, 'Told their dead were a judgment'], ['convert', 0.05]], text: 'Some of the survivors are baptised. More go inland and do not come back.' },
    ],
  },
  {
    id: 'trade_fair', family: 'peoples', again: 30, about: { people: 'post' },
    title: 'The great fair',
    text: 'Once in a few years {people} hold a fair where every nation for a month’s walk brings what it makes. This year your factor at the trading post is invited.',
    choices: [
      { label: 'Send the best you have', effects: [['ducats', 500], ['regard', 8, 'Good trade at the great fair'], ['research', 5]], text: 'Your factor comes back with goods you have no names for, and a map of where they came from.' },
      { label: 'Send trinkets', effects: [['ducats', 200], ['regard', -6, 'Cheap goods at the great fair']], text: 'They are bought, examined, and understood.' },
    ],
  },
  {
    id: 'guns_asked', family: 'peoples', about: { people: 'peace strong' }, when: [['noflag', 'guns_sold']],
    title: 'Thunder for sale',
    text: 'The war chief of {people} has watched your arquebuses with close attention. He offers gold for fifty of them, and men who can teach their use.',
    choices: [
      { label: 'Sell them', effects: [['ducats', 900], ['regard', 15, 'Firearms sold to them'], ['warriors', 0.3], ['flag', 'guns_sold'], ['later', 'guns_turned', 30]], text: 'The guns go ashore in crates. His neighbours will learn of it soon enough.' },
      { label: 'Sell them old ones that misfire', effects: [['ducats', 500], ['regard', -12, 'Sold guns that burst in their hands']], text: 'The first barrel bursts within the week.' },
      { label: 'Refuse', effects: [['regard', -5, 'Refused firearms']], text: 'He nods as if he expected nothing else.' },
    ],
  },
  {
    id: 'guns_turned', family: 'peoples', chained: true,
    title: 'What the guns did',
    text: 'The firearms you sold to {people} have made them masters of their neighbours. Now those neighbours come to you, asking for guns of their own, or for protection.',
    choices: [
      { label: 'Arm the neighbours too', effects: [['ducats', 600], ['regard', -10, 'Their enemies armed as well'], ['prestige', -3]], text: 'Everyone has guns now. The wars inland get worse.' },
      { label: 'Stand by your first customers', effects: [['regard', 10, 'Their enemies refused firearms']], text: '{people} grow stronger still. One day that may matter to you.' },
    ],
  },
  {
    id: 'shaman', family: 'peoples', again: 36, about: { people: 'mission' },
    title: 'Two kinds of priest',
    text: 'The friars of your mission among {people} have thrown a healer’s masks on the fire. The healer has told the people that the next sickness will be the friars’ doing.',
    choices: [
      { label: 'Rebuke the friars', effects: [['regard', 10, 'The mask-burners rebuked'], ['convert', -0.1], ['prestige', -2]], text: 'New masks are carved. The friars preach more gently, to fewer.' },
      { label: 'Back the friars', effects: [['regard', -12, 'Their healer’s masks burned'], ['convert', 0.1]], text: 'The converted grow in number. The rest stop coming to the mission at all.' },
      { label: 'Have them debate before the people', roll: ['ruler', 'diplomacy', 0.4, 0.15], effects: [['regard', 6, 'Their healer heard with respect'], ['convert', 0.08]], text: 'It lasts three days. Both sides claim to have won, and nobody burns anything.',
        else: { effects: [['regard', -6, 'A debate that ended in blows']], text: 'It ends in shouting, then stones.' } },
    ],
  },
  {
    id: 'two_peoples_wedding', family: 'peoples', about: { colony: 'any', people: 'neighbour friendly' },
    title: 'A wedding of two peoples',
    text: 'A chief’s daughter of {people} and a captain of {colony} wish to marry, by her custom and by yours. Her father consents. Your chaplain does not.',
    choices: [
      { label: 'Bless it and attend', effects: [['regard', 18, 'A marriage between their house and yours'], ['loyalty', 4], ['prestige', -2]], text: 'There are two ceremonies and one very long feast.' },
      { label: 'Allow it, without ceremony', effects: [['regard', 6, 'A marriage allowed']], text: 'They marry. The chaplain looks the other way.' },
      { label: 'Forbid it', effects: [['regard', -14, 'A chief’s daughter refused'], ['loyalty', -3]], text: 'The captain resigns his commission and goes to live with her people.' },
    ],
  },
  {
    id: 'feud_help', family: 'peoples', again: 30, about: { people: 'feud peace' },
    title: 'An ally wanted',
    text: '{people} are at war with their neighbours and it is going badly. Their envoy asks for soldiers, or at least powder and shot.',
    choices: [
      { label: 'Send powder and shot', effects: [['ducats', -250], ['regard', 15, 'Powder sent in their war'], ['warriors', 0.2]], text: 'It turns one battle. They do not forget who sent it.' },
      { label: 'Offer to make the peace', roll: ['ruler', 'diplomacy', 0.35, 0.15], effects: [['regard', 12, 'A peace made for them'], ['prestige', 5]], text: 'Your envoy sits between two fires for a week, and both sides go home.',
        else: { effects: [['regard', -5, 'A peace that came to nothing']], text: 'Neither side wants a stranger’s peace.' } },
      { label: 'Their wars are their own', effects: [['regard', -6, 'Left alone in their war']], text: 'The envoy leaves before dawn.' },
    ],
  },
  {
    id: 'tribute_dispute', family: 'peoples', again: 30, about: { people: 'subject' },
    title: 'The weight of tribute',
    text: 'The elders of {people} say the tribute your officers take is twice what was agreed, and that the difference stays in the officers’ houses.',
    choices: [
      { label: 'Punish the officers and halve it', effects: [['ducats', -200], ['regard', 14, 'Their tribute made just']], text: 'Two officers are sent home. The elders are, cautiously, impressed.' },
      { label: 'The tribute stands', effects: [['ducats', 200], ['regard', -14, 'Robbed in the name of tribute']], text: 'It is collected at pike point.' },
    ],
  },
  {
    id: 'new_crops', family: 'peoples', about: { people: 'friendly' }, when: [['noflag', 'new_crops']],
    title: 'Seeds in a pouch',
    text: 'A farmer of {people} has given your factor a pouch of seeds and a tuber: plants that feed twice as many from the same ground, she says, and grow where wheat will not.',
    choices: [
      { label: 'Plant them at home and in the colonies', effects: [['research', 20], ['loyaltyAll', 3], ['flag', 'new_crops'], ['regard', 5, 'Their gift of seed planted and praised']], text: 'Within a generation, peasants in {me} will not remember a time without them.' },
      { label: 'A garden curiosity', effects: [['prestige', 2], ['flag', 'new_crops']], text: 'They flower prettily in the palace garden. Nobody thinks to eat them.' },
    ],
  },
];
