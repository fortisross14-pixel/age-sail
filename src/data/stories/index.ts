import type { StoryDef } from './types';
import { SEA } from './sea';
import { COURT } from './court';
import { COLONIES } from './colonies';
import { PEOPLES } from './peoples';
import { CROWNS_STORIES } from './crowns';
import { EUROPE, ERAS_STORIES, DYNASTY_STORIES } from './europe';
import { HISTORY } from './history';

/** Every story in the game. To add one, write it in its family's file: nothing else changes. */
export const STORIES: StoryDef[] = [...SEA, ...COURT, ...COLONIES, ...PEOPLES, ...CROWNS_STORIES, ...EUROPE, ...ERAS_STORIES, ...DYNASTY_STORIES, ...HISTORY];

/** How often stories come. Provisional: the balance phase sets it against the number of stories. */
export const STORY_PACE = {
  /** chance each season that a story is told, when one is ready */
  chance: 0.3,
  /** when every story that fits has been told before, an old one returns only this often */
  retold: 0.5,
  /** seasons at the start of a game with none */
  quietStart: 3,
};
