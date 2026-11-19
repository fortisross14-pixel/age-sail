import { useStore, newWorldOpen } from '../store';
import { dateLabel, seasonOf, SEASONS } from '../sim/types';
import { GOAL } from '../sim/game';
import { fmt } from './format';
import { spriteUrl } from '../render/assets';

export function TopBar() {
  const game = useStore((s) => s.game)!;
  const busy = useStore((s) => s.busy);
  const map = useStore((s) => s.map);
  const showWind = useStore((s) => s.showWind);
  const showChronicle = useStore((s) => s.showChronicle);
  const set = useStore((s) => s.set);
  const setMap = useStore((s) => s.setMap);
  const endTurn = useStore((s) => s.endTurn);
  const open = newWorldOpen(game);
  const ready = game.fleets.filter((f) => f.moves > 0 && !f.order && !f.at).length;
  const goalPct = Math.max(0, Math.min(100, (game.treasury / GOAL.treasury) * 100));
  const turnsLeft = GOAL.turn - game.turn;
  return (
    <header className="topbar">
      <div className="cartouche" style={{ backgroundImage: `url(${spriteUrl('ornaments/cartouche')})` }}>
        <div className="cartouche-season">{SEASONS[seasonOf(game.turn)]}</div>
        <div className="cartouche-year">Anno {dateLabel(game.turn).split(' ')[1]}</div>
      </div>
      <div className="stat" title="Treasury, in ducats">
        <img src={spriteUrl('goods/gold')} alt="" width={30} height={30} />
        <div>
          <div className="stat-value">{fmt(game.treasury)}</div>
          <div className="stat-label">ducats</div>
        </div>
      </div>
      <div className="stat" title="Prestige: from discoveries and the Crown’s favour">
        <span className="prestige-mark" aria-hidden>✦</span>
        <div>
          <div className="stat-value">{fmt(game.prestige)}</div>
          <div className="stat-label">prestige</div>
        </div>
      </div>
      <div className="maps" role="tablist" aria-label="Map">
        <button role="tab" aria-selected={map === 'old'} className={map === 'old' ? 'on' : ''} onClick={() => setMap('old')} title="The Old World (M)">Old World</button>
        <button role="tab" aria-selected={map === 'new'} className={map === 'new' ? 'on' : ''} disabled={!open} onClick={() => setMap('new')}
          title={open ? 'The Mar Océano and the New World (M)' : 'Unknown. Send a fleet led by an explorer west to find it.'}>
          {open ? (game.newWorldFound ? 'New World' : 'Mar Océano') : '🔒 Unknown west'}
        </button>
      </div>
      <div className="goal" title="The Crown’s charge">
        <div className="goal-text">
          {turnsLeft > 0
            ? <>The Crown asks for <b>{fmt(GOAL.treasury)}</b> ducats by {dateLabel(GOAL.turn)} · {turnsLeft} seasons left</>
            : <>The Crown’s deadline has passed</>}
        </div>
        <div className="goal-bar"><div style={{ width: `${goalPct}%` }} /></div>
      </div>
      <div className="spacer" />
      <button className={`tool ${showChronicle ? 'on' : ''}`} onClick={() => set({ showChronicle: !showChronicle })} title="Chronicle (C)">Chronicle</button>
      <button className={`tool ${showWind ? 'on' : ''}`} onClick={() => set({ showWind: !showWind })} title="Show winds (W)">Winds</button>
      <button className="tool" onClick={() => set({ showHelp: true })} title="How to play (H)">?</button>
      <button className="end-turn" onClick={() => void endTurn()} disabled={busy} title="End the season (Enter)">
        {busy ? 'The season passes…' : 'End season'}
        {ready > 0 && !busy && <span className="end-hint">{ready} fleet{ready > 1 ? 's' : ''} at sea without orders</span>}
      </button>
    </header>
  );
}
