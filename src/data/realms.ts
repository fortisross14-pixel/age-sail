import type { CrownId } from './rivals';

/** Every power that holds cities in the Old World. The five crowns are playable; the rest trade. */
export type MinorId = 'ottoman' | 'morocco' | 'venice' | 'genoa' | 'papacy' | 'naples' | 'hanse' | 'denmark' | 'scotland' | 'empire';
export type RealmId = CrownId | MinorId;

export interface RealmSpec {
  id: RealmId;
  name: string;
  /** "Spanish", "Venetian" */
  adjective: string;
  /** map colour: border band and wash */
  color: number;
  playable: boolean;
}

export const REALMS: RealmSpec[] = [
  { id: 'spain', name: 'Castile', adjective: 'Castilian', color: 0xd9a521, playable: true },
  { id: 'portugal', name: 'Portugal', adjective: 'Portuguese', color: 0x2f7d46, playable: true },
  { id: 'england', name: 'England', adjective: 'English', color: 0xb3202c, playable: true },
  { id: 'france', name: 'France', adjective: 'French', color: 0x2c4f9e, playable: true },
  { id: 'netherlands', name: 'the Netherlands', adjective: 'Dutch', color: 0xe0751f, playable: true },
  { id: 'ottoman', name: 'the Ottomans', adjective: 'Ottoman', color: 0x2f8a83, playable: false },
  { id: 'morocco', name: 'Morocco', adjective: 'Moroccan', color: 0x9c4a2a, playable: false },
  { id: 'venice', name: 'Venice', adjective: 'Venetian', color: 0x6b2d6b, playable: false },
  { id: 'genoa', name: 'Genoa', adjective: 'Genoese', color: 0x8a3b3b, playable: false },
  { id: 'papacy', name: 'the Papal States', adjective: 'Papal', color: 0xb59a3a, playable: false },
  { id: 'naples', name: 'Naples', adjective: 'Neapolitan', color: 0x5d7f3a, playable: false },
  { id: 'hanse', name: 'the Hanse', adjective: 'Hanseatic', color: 0x7a5c3e, playable: false },
  { id: 'denmark', name: 'Denmark', adjective: 'Danish', color: 0x8c2f4a, playable: false },
  { id: 'scotland', name: 'Scotland', adjective: 'Scottish', color: 0x3d5a80, playable: false },
  { id: 'empire', name: 'the Empire', adjective: 'Imperial', color: 0x5a5a5a, playable: false },
];

export const REALM_IDS = REALMS.map((r) => r.id);
export const realmSpec = (id: RealmId) => REALMS.find((r) => r.id === id)!;
/** Realm index in map data: 0 is no realm, otherwise REALM_IDS index + 1. */
export const realmIndex = (id: RealmId) => REALM_IDS.indexOf(id) + 1;
export const realmAt = (code: number): RealmId | null => (code > 0 ? REALM_IDS[code - 1] : null);
