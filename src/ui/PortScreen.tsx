/** A foreign city or a native trading ground: the place first, and its market inside. */
import { useState } from 'react';
import { useStore } from '../store';
import { portById } from '../sim/game';
import { realmSpec } from '../data/realms';
import { CROWNS } from '../data/rivals';
import { nationOfSite, standing, STANDING, populationOf } from '../sim/natives';
import { factoryAt } from '../sim/trade';
import { spriteUrl } from '../render/assets';
import { Art, CrestArt, cityViewSlot } from './theme/Art';
import { PortMarket, Tabs } from './Drawers';
import { Standing } from './Standing';

const SIZE_NAME = { 3: 'Great city', 2: 'City', 1: 'Town' } as const;

export function PortScreen() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const id = useStore((s) => s.selectedPort);
  const set = useStore((s) => s.set);
  const [tab, setTab] = useState<'market' | 'about'>('market');
  const port = id ? portById(world, id, game) : undefined;
  if (!port) return <p className="muted">Choose a port on the map.</p>;
  const nation = port.kind === 'native' ? nationOfSite(world, port.id) : undefined;
  const st = nation ? game.natives[nation.id] : undefined;
  const crown = port.realm ? CROWNS.find((c) => c.id === port.realm) : undefined;
  const rival = crown ? game.rivals[crown.id] : undefined;
  const sub = nation && st
    ? `Trading ground of the ${nation.people} · about ${populationOf(nation, st)} people`
    : [port.realm ? realmSpec(port.realm).name : port.nation, port.size ? SIZE_NAME[port.size] : null, factoryAt(game, port.id) ? 'your factory here' : null].filter(Boolean).join(' · ');
  return (
    <>
      <header className="drawer-head city-head">
        <div className="vignette">
          {nation ? <img src={spriteUrl('colonies/trading-post-town')} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'right center' }} />
            : <Art slot={cityViewSlot(port.id, !!port.inland, port.size ?? 2)} fallback={null} />}
        </div>
        {port.realm ? <CrestArt realm={port.realm} size={64} fallback={null} /> : <span className="native-mark" aria-hidden>✦</span>}
        <div>
          <h2>{port.name}</h2>
          <div className="sub">{sub}</div>
          {st && <Standing st={st} />}
        </div>
      </header>
      <Tabs value={tab} onChange={setTab} tabs={[['market', 'Market'], ['about', nation ? 'The people' : 'The city']]} />
      <div className="tab-pane" key={tab}>
        {tab === 'market' && <PortMarket portId={port.id} bare />}
        {tab === 'about' && (
          <div className="detail-card" style={{ gridTemplateColumns: '1fr' }}>
            <p>{port.blurb}</p>
            {nation && st && <>
              <p><b>{STANDING[standing(st)].name}</b> ({standing(st) > 0 ? '+' : ''}{standing(st)}): {STANDING[standing(st)].blurb}</p>
              <p className="muted small">About {st.warriors} warriors{nation.empire ? ' · an empire' : ''}{st.post ? ' · your trading post' : ''}{st.mission ? ` · a mission (${Math.round(st.converted * 100)}% won over)` : ''}.</p>
              <button onClick={() => set({ drawer: 'court', courtTab: 'peoples' })}>Deal with the {nation.people}</button>
            </>}
            {crown && rival && <p className="small">{crown.name} is <b>{rival.relation === 'war' ? 'at war with you' : rival.attitude >= 30 ? 'friendly' : rival.attitude <= -30 ? 'hostile' : 'at peace'}</b>. Their ports trade with you even so, at a price.</p>}
            {port.realm && !crown && <p className="small">{realmSpec(port.realm).name} is not a colonial rival: their ports trade with anyone.</p>}
          </div>
        )}
      </div>
    </>
  );
}
