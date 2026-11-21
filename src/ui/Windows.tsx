import { useEffect } from 'react';
import { useStore, type WindowRef } from '../store';
import type { GameState, World } from '../sim/types';
import { portById } from '../sim/game';
import { Frame } from './theme/Frame';
import { Icon } from './theme/icons';
import { sfx } from './sound';
import { FleetWindow } from './FleetsDrawer';
import { PersonWindow } from './CourtDrawer';
import { CityWindow } from './CityScreen';
import { ColonyWindow } from './CitiesDrawer';

/** What a window is called, for its Back button and its label; undefined once the thing is gone. */
function nameOf(w: WindowRef, g: GameState, world: World): string | undefined {
  switch (w.kind) {
    case 'fleet': return g.fleets.find((f) => f.id === w.id)?.name;
    case 'person': return g.people.find((p) => p.id === w.id)?.name;
    case 'city': return g.cities[w.id] ? portById(world, w.id)?.name : undefined;
    case 'colony': return g.colonies.find((c) => c.id === w.id)?.name;
  }
}

const keyOf = (w: WindowRef) => `${w.kind}:${w.id}`;

/**
 * One thing's own window — a fleet, a person, a city, a colony — over the screen it was opened from,
 * or over the map. Back returns to the window underneath; Close (or a click outside) to the screen or map.
 */
export function Windows() {
  const windows = useStore((s) => s.windows);
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const set = useStore((s) => s.set);
  const back = useStore((s) => s.closeWindow);
  // a fleet sunk or a person dead while their window was open: drop it
  const live = windows.filter((w) => nameOf(w, game, world) != null);
  useEffect(() => { if (live.length !== windows.length) set({ windows: live }); }, [live.length, windows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = live.at(-1);
  useEffect(() => { if (top) setTimeout(() => document.querySelector<HTMLElement>('.window .adm-close')?.focus({ preventScroll: true }), 60); }, [top && keyOf(top)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!top) return null;
  const under = live.at(-2);
  const close = () => { sfx('close'); set({ windows: [] }); };
  const fleet = top.kind === 'fleet' ? game.fleets.find((f) => f.id === top.id)! : undefined;
  const person = top.kind === 'person' ? game.people.find((p) => p.id === top.id)! : undefined;
  return (
    <>
      <div className="screen-back window-back" onClick={close} aria-hidden />
      <Frame className={`panel drawer window window-${top.kind}`} role="dialog" aria-label={nameOf(top, game, world)}>
        <button className="adm-medal adm-close" onClick={close} aria-label="Close" title="Close (Esc)"><Icon name="close" size={20} /></button>
        {under && <button className="window-back-btn" onClick={() => { sfx('page'); back(); }} title="Back (Esc)">‹ {nameOf(under, game, world)}</button>}
        <div className="drawer-body" key={keyOf(top)}>
          {fleet && <FleetWindow fleet={fleet} tab={top.kind === 'fleet' ? top.tab : undefined} />}
          {person && <PersonWindow p={person} />}
          {top.kind === 'city' && <CityWindow key={top.id} cityId={top.id} tab={top.tab} />}
          {top.kind === 'colony' && <ColonyWindow colonyId={top.id} />}
        </div>
      </Frame>
    </>
  );
}
