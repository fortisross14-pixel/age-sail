export enum T {
  Sea = 0,
  Shallows = 1,
  Desert = 2,
  Plains = 3,
  Savanna = 4,
  Forest = 5,
  Jungle = 6,
  Taiga = 7,
  Tundra = 8,
  Hills = 9,
  Mountains = 10,
  Marsh = 11,
}

export const isWater = (t: number) => t <= T.Shallows;

export const TERRAIN_INFO: Record<T, { name: string; wash: string }> = {
  [T.Sea]: { name: 'Open sea', wash: '#9db3b8' },
  [T.Shallows]: { name: 'Shallows', wash: '#a9c0bd' },
  [T.Desert]: { name: 'Desert', wash: '#dcc48c' },
  [T.Plains]: { name: 'Plains', wash: '#c3bf7c' },
  [T.Savanna]: { name: 'Savanna', wash: '#c6bb6a' },
  [T.Forest]: { name: 'Forest', wash: '#93a862' },
  [T.Jungle]: { name: 'Jungle', wash: '#6f8c4b' },
  [T.Taiga]: { name: 'Northern forest', wash: '#8a9a72' },
  [T.Tundra]: { name: 'Tundra', wash: '#b8b4a0' },
  [T.Hills]: { name: 'Hills', wash: '#c4a676' },
  [T.Mountains]: { name: 'Mountains', wash: '#a8937a' },
  [T.Marsh]: { name: 'Marsh', wash: '#9aa57e' },
};
