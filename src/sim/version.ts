/**
 * Bump whenever generateWorld's output changes for an existing seed. Saves store the state only
 * and rebuild the world from the seed, so a save made under another generator would load onto a
 * different map; src/save.ts refuses those.
 */
export const GEN_VERSION = 2;
