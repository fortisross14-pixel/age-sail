import type { StoryDef } from './types';

/** Europe: the world you sail from does not stand still while you look west. */
export const EUROPE: StoryDef[] = [
  {
    id: 'papal_tithe', family: 'europe', again: 48,
    title: 'A letter from Rome',
    text: 'The Pope asks every Christian prince for a tenth of a year’s revenue, for the defence of the faith. Princes who give generously are remembered when lands beyond the sea are divided.',
    choices: [
      { label: 'Send the tenth', effects: [['ducats', -600], ['prestige', 10], ['attitudeAll', 3]], text: 'A cardinal says Mass for your fleets.' },
      { label: 'Send half, with apologies', effects: [['ducats', -300], ['prestige', 3]], text: 'Rome accepts it, and the apologies.' },
      { label: 'Your ships defend the faith already', effects: [['prestige', -6]], text: 'The legate notes your answer word for word.' },
    ],
  },
  {
    id: 'great_loan', family: 'europe', again: 60, when: [['treasury', '<', 0]],
    title: 'The price of credit',
    text: 'Your treasury is empty and {bankers} know it. They will lend 8,000 ducats, at a rate that would shame a pawnbroker, against the customs of {capital}.',
    choices: [
      { label: 'Sign', effects: [['loan', 8000, 320, 40]], text: 'Their clerks move into your customs house.' },
      { label: 'Debase the coinage instead', effects: [['ducats', 3000], ['prestige', -10], ['loyaltyAll', -5]], text: 'There is more copper in the silver now. Everyone notices within a month.' },
      { label: 'Neither', effects: [], text: 'The bankers can wait. They always can.' },
    ],
  },
  {
    id: 'turk_advances', family: 'europe', again: 60, when: [['year', '>=', 1500]],
    title: 'The Sultan’s galleys',
    text: 'The Ottoman fleet has taken another island, and Venice begs for ships. Every court in Europe is watching who answers.',
    choices: [
      { label: 'Send money for galleys', effects: [['ducats', -700], ['prestige', 12], ['attitudeAll', 4]], text: 'Your banner flies beside the lion of Saint Mark.' },
      { label: 'Send prayers', effects: [['prestige', -3]], text: 'The Venetian envoy thanks you with exquisite coldness.' },
      { label: 'Open talks with the Sultan about trade', hint: 'Good for merchants; Christendom is scandalised', effects: [['ducats', 600], ['prestige', -10], ['attitudeAll', -5]], text: 'Your merchants are welcome in the Levant. Your name is less welcome in Rome.' },
    ],
  },
  {
    id: 'mercenaries', family: 'europe', again: 40, when: [['atWar']],
    title: 'Pikes for hire',
    text: 'A captain of Swiss pikemen, between employers, offers his company for the season. They are the best in Europe, and they know it.',
    choices: [
      { label: 'Hire them to guard the colonies', effects: [['ducats', -600], ['loyaltyAll', 3], ['prestige', 3]], text: 'They complain about the heat and frighten everyone.' },
      { label: 'Too dear', effects: [], text: 'They march off to someone else’s war.' },
    ],
  },
  {
    id: 'map_printed', family: 'europe', when: [['newWorld'], ['noflag', 'map_printed']],
    title: 'The world, printed',
    text: 'A mapmaker in the Rhineland has asked for your pilots’ reports. He means to print a map of the whole world, new lands and all, and to put a name on them.',
    choices: [
      { label: 'Give him everything, and your name for it', effects: [['prestige', 15], ['attitudeAll', -4], ['flag', 'map_printed']], text: 'Ten thousand copies. Every schoolboy in Europe will learn {land} by the name you gave it, and every rival pilot will learn the way.' },
      { label: 'Give him nothing', effects: [['research', 5], ['flag', 'map_printed']], text: 'He prints it anyway, from rumours, and names it after someone else.' },
    ],
  },
  {
    id: 'comet', family: 'europe', again: 80, when: [['chance', 0.4]],
    title: 'A star with a tail',
    text: 'A comet hangs over {capital} every night. The preachers say it means war, the astrologers say a death, and the price of candles has doubled.',
    choices: [
      { label: 'Order processions', effects: [['ducats', -100], ['loyaltyAll', 2]], text: 'The city walks barefoot for three days. The comet fades on schedule.' },
      { label: 'Have your astronomers measure it', effects: [['research', 12]], text: 'They find it is further away than the Moon, which upsets Aristotle and nobody else.' },
    ],
  },
  {
    id: 'refugees', family: 'europe', again: 60, about: { realm: 'any' },
    title: 'Strangers at the gate',
    text: 'Families driven out of {realm} for their faith are asking to settle in {capital}: physicians, weavers, mapmakers, moneychangers. Your bishops object.',
    choices: [
      { label: 'Admit them', effects: [['research', 20], ['ducats', 400], ['prestige', -3]], text: 'A street of new workshops opens by the harbour. The bishops preach about it.' },
      { label: 'Admit them, for a price', effects: [['ducats', 900], ['research', 8]], text: 'They pay for the right to stay, and remember what it cost.' },
      { label: 'Turn them away', effects: [['prestige', 3]], text: 'They sail on, to enrich some other city.' },
    ],
  },
  {
    id: 'bread_riots', family: 'europe', again: 48, when: [['chance', 0.5]],
    title: 'No bread in {capital}',
    text: 'The harvest failed and the bakers have shut their doors. A crowd is at the gates of {court}, and it is not cheering.',
    choices: [
      { label: 'Buy grain abroad at any price', effects: [['ducats', -500], ['prestige', 4], ['shock', 'famine', 'home']], text: 'Grain ships are unloaded under guard. The crowd goes home.' },
      { label: 'Open the royal granaries', effects: [['ducats', -200], ['prestige', 2]], text: 'It is enough, just.' },
      { label: 'Call out the guard', effects: [['prestige', -8], ['courtAll', -2, 'The guard turned on a hungry crowd']], text: 'The square is cleared. It takes a day to wash.' },
    ],
  },
  {
    id: 'reformer', family: 'europe', when: [['year', '>=', 1517], ['noflag', 'reform']],
    title: 'A monk with a hammer',
    text: 'A German friar has written that salvation cannot be bought, and half the printers in Europe are selling his words. His books are in {capital} already. Your bishops want them burned; some of your merchants are reading them.',
    choices: [
      { label: 'Burn the books', effects: [['prestige', 5], ['research', -6], ['flag', 'reform'], ['flag', 'old_faith']], text: 'There is a bonfire in the cathedral square. The books keep coming.' },
      { label: 'Let people read', effects: [['research', 10], ['prestige', -5], ['attitudeAll', -3], ['flag', 'reform'], ['flag', 'new_ideas']], text: 'The arguments move from the pulpit to the tavern. Rome takes note.' },
      { label: 'Say nothing, and watch', effects: [['flag', 'reform']], text: 'You will have to choose one day. Not today.' },
    ],
  },
  {
    id: 'hanse_quarrel', family: 'europe', again: 60, when: [['chance', 0.5]],
    title: 'The towns of the North close their ports',
    text: 'The merchants of the Hanse accuse your sailors of piracy in the Baltic and have shut their harbours to your flag until someone pays.',
    choices: [
      { label: 'Pay the damages', effects: [['ducats', -400]], text: 'The harbours open. Timber and furs flow again.' },
      { label: 'Find timber elsewhere', effects: [['shock', 'war', 'north'], ['prestige', 2]], text: 'Your shipwrights pay more for masts this year.' },
    ],
  },
];

/** The age itself: changes that come to everyone, sooner or later. */
export const ERAS_STORIES: StoryDef[] = [
  {
    id: 'prices', family: 'eras', when: [['year', '>=', 1550], ['found', 'silver', 'gold']],
    title: 'The price revolution',
    text: 'So much gold and silver has come from beyond the sea that prices rise all over Europe. Bread, cloth and timber cost more every year.',
    choices: [
      { label: 'So be it', hint: 'European staples cost a third more', effects: [['special', 'priceRevolution']], text: 'The price of everything in your cities rises.' },
    ],
  },
  {
    id: 'tobacco_fashion', family: 'eras', when: [['newWorld'], ['year', '>=', 1530]],
    title: 'The smoking weed',
    text: 'Sailors brought the habit home; now courtiers have it. Your physicians cannot agree whether the smoke of this leaf cures everything or nothing.',
    choices: [
      { label: 'Tax it', effects: [['ducats', 500], ['shock', 'fashion', 'north']], text: 'A new line appears in the customs book. It will be a long one.' },
      { label: 'Ban it at court', effects: [['prestige', 2], ['courtAll', -1, 'Forbidden to smoke at court']], text: 'They smoke on the stairs instead.' },
    ],
  },
  {
    id: 'new_hulls', family: 'eras', when: [['year', '>=', 1530]],
    title: 'A longer, lower ship',
    text: 'A shipwright shows a model: no towering castles, a longer keel, guns along the side. She would sail closer to the wind and fight better. The old masters call it a coffin.',
    choices: [
      { label: 'Build one and see', effects: [['ducats', -500], ['research', 25]], text: 'She outsails everything in the harbour. The old masters ask for the plans.' },
      { label: 'The old ships have served', effects: [], text: 'Someone else builds her.' },
    ],
  },
  {
    id: 'bubble', family: 'eras', when: [['year', '>=', 1620], ['treasury', '>=', 3000]],
    title: 'Everyone is getting rich',
    text: 'Shares in a new trading company have tripled in a season. Your treasurer wants to put the Crown’s money in. So does your cook.',
    choices: [
      { label: 'Buy', roll: ['none', 'commerce', 0.45, 0], effects: [['ducats', 2500]], text: 'You sell at the top, by luck, and call it judgment.',
        else: { effects: [['ducats', -2000], ['prestige', -4]], text: 'The shares are worth the paper by Christmas. The cook is ruined too.' } },
      { label: 'Stay out', effects: [['prestige', 2]], text: 'When it bursts, you look very wise.' },
    ],
  },
  {
    id: 'learned_society', family: 'eras', when: [['year', '>=', 1640]],
    title: 'A society of the curious',
    text: 'Gentlemen who weigh air and cut up frogs ask for a royal charter. They promise nothing useful, and are honest enough to say so.',
    choices: [
      { label: 'Charter them', effects: [['ducats', -400], ['research', 40], ['prestige', 8]], text: 'Their first paper concerns the pendulum, which turns out to matter a great deal at sea.' },
      { label: 'Let them meet in a tavern', effects: [['research', 10]], text: 'They do, and argue just as well.' },
    ],
  },
];

/** The dynasty: your own house, its children, its marriages and its deaths. */
export const DYNASTY_STORIES: StoryDef[] = [
  {
    id: 'heir_tutor', family: 'dynasty', when: [['heir']],
    title: 'A tutor for {heir}',
    text: '{heir} will rule one day. Three masters have been proposed, and each would make a different ruler.',
    choices: [
      { label: 'A pilot and cosmographer', effects: [['heirGift', 'navigation']], text: 'The schoolroom fills with globes.' },
      { label: 'A merchant banker', effects: [['heirGift', 'commerce']], text: 'The first lesson is double-entry.' },
      { label: 'An old soldier', effects: [['heirGift', 'military']], text: 'There is a great deal of riding in the rain.' },
      { label: 'A diplomat', effects: [['heirGift', 'diplomacy']], text: 'Five languages, and how to say nothing in each.' },
    ],
  },
  {
    id: 'heir_to_sea', family: 'dynasty', again: 60, when: [['heir'], ['fleets', '>=', 2]],
    title: 'The heir wants to sail',
    text: '{heir} is tired of maps and wants to see what is on them: one voyage down the coast with your best captain.',
    choices: [
      { label: 'Let them go', roll: ['none', 'navigation', 0.85, 0], effects: [['prestige', 10], ['heirGift', 'navigation'], ['courtAll', 2, 'An heir who has been to sea']], text: 'They come home brown, thin and insufferably well informed.',
        else: { effects: [['rulerFrail', 3], ['prestige', -5]], text: 'A fever on the coast. They live, barely, and you age ten years waiting for news.' } },
      { label: 'An heir is not a cabin boy', effects: [], text: 'The maps go back on the wall.' },
    ],
  },
  {
    id: 'ruler_ill', family: 'dynasty', again: 40, when: [['rulerOld']],
    title: 'The physicians confer',
    text: '{ruler} has kept to the royal chamber for a week. The physicians agree on nothing except their fees.',
    choices: [
      { label: 'Rest, and let the council govern', effects: [['rulerFrail', -3], ['ducats', -200]], text: 'A month of broth and quiet. The colour comes back.' },
      { label: 'Show the court a healthy ruler', effects: [['rulerFrail', 3], ['prestige', 5]], text: 'A hunt, a banquet, a long audience. The court is reassured. The physicians are not.' },
      { label: 'A pilgrimage to {saint}', effects: [['ducats', -300], ['rulerFrail', -1], ['prestige', 3]], text: 'The road is hard and the shrine is cold, but something works.' },
    ],
  },
  {
    id: 'no_heir', family: 'dynasty', again: 40, when: [['noheir'], ['noregency']],
    title: 'The empty cradle',
    text: '{ruler} has no heir. The great families have begun to count cousins, and the house of {house} has more than most.',
    choices: [
      { label: 'Name a cousin as heir', effects: [['heirBorn'], ['prestige', -3]], text: 'A child of the blood is brought to court to be raised as your own.' },
      { label: 'God will provide', effects: [['courtAll', -2, 'No heir, and no plan for one']], text: 'The court prays, and calculates.' },
    ],
  },
  {
    id: 'consort_kin', family: 'dynasty', again: 40, about: { realm: 'tied' }, when: [['married']],
    title: 'A favour for the in-laws',
    text: 'Your consort’s family in {realm} ask a favour: their merchants would like the same terms in your ports as your own.',
    choices: [
      { label: 'Grant it', effects: [['ducats', -200], ['prestige', 4], ['courtAll', -1, 'Foreign merchants favoured']], text: 'The marriage is a happier one this year.' },
      { label: 'Family is family, customs are customs', effects: [['prestige', -2]], text: 'Dinner is quiet for a month.' },
    ],
  },
  {
    id: 'regent', family: 'dynasty', again: 30, about: { courtier: 'ambitious' }, when: [['regency']],
    title: 'The regent’s friends',
    text: 'While {ruler} is a child, {courtier} has gathered a party at court and speaks of “guiding” the young ruler well past the day they come of age.',
    choices: [
      { label: 'Break up the party', effects: [['opinion', 'courtier', -12, 'A faction broken up'], ['courtAll', 2, 'The regency kept honest']], text: '{courtier.first} is sent to inspect distant fortresses.' },
      { label: 'Buy them off', effects: [['ducats', -400], ['opinion', 'courtier', 8, 'Paid to be patient']], text: '{courtier.first} discovers a sudden interest in country estates.' },
      { label: 'Let it be', effects: [['prestige', -4], ['opinion', 'courtier', 4, 'Left to gather friends']], text: 'The party grows.' },
    ],
  },
];
