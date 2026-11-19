import { useStore, newWorldOpen } from '../store';
import { dateLabel, seasonOf, SEASONS } from '../sim/types';
import { GOAL } from '../sim/game';
import { fmt } from './format';
import { spriteUrl } from '../render/assets';

/** The top bar: date, money, standing, the map switch and the end of the season. */
export function Hud() {
  const game = useStore((s) => s.game)!;
  const busy = useStore((s) => s.busy);
  const map = useStore((s) => s.map);
  const showWind = useStore((s) => s.showWind);
  const set = useStore((s) => s.set);
  const setMap = useStore((s) => s.setMap);
  const endTurn = useStore((s) => s.endTurn);
  const open = newWorldOpen(game);
  const idle = game.fleets.filter((f) => f.moves > 0 && !f.order && !f.at).length;
  const goalPct = Math.max(0, Math.min(100, (game.treasury / GOAL.treasury) * 100));
  const turnsLeft = GOAL.turn - game.turn;
  return (
    <header className="hud">
      <div className="cartouche" style={{ backgroundImage: `url(${spriteUrl('ornaments/cartouche')})` }}>
        <div className="cartouche-season">{SEASONS[seasonOf(game.turn)]}</div>
        <div className="cartouche-year">Anno {dateLabel(game.turn).split(' ')[1]}</div>
      </div>
      <div className="stat" title="Treasury, in ducats">
        <img src={spriteUrl('goods/gold')} alt="" width={28} height={28} />
        <div><div className="stat-value">{fmt(game.treasury)}</div><div className="stat-label">ducats</div></div>
      </div>
      <div className="stat" title="Prestige: from discoveries and the Crown’s favour">
        <span className="prestige-mark" aria-hidden>✦</span>
        <div><div className="stat-value">{fmt(game.prestige)}</div><div className="stat-label">prestige</div></div>
      </div>
      <div className="goal" title={`The Crown asks for ${fmt(GOAL.treasury)} ducats by ${dateLabel(GOAL.turn)}`}>
        <div className="goal-text">{turnsLeft > 0 ? <>Crown’s charge: {fmt(GOAL.treasury)} by {dateLabel(GOAL.turn)}</> : <>The Crown’s deadline has passed</>}</div>
        <div className="goal-bar"><div style={{ width: `${goalPct}%` }} /></div>
      </div>
      <div className="spacer" />
      <div className="maps" role="tablist" aria-label="Map">
        <button role="tab" aria-selected={map === 'old'} className={map === 'old' ? 'on' : ''} onClick={() => setMap('old')} title="The Old World (M)">Old World</button>
        <button role="tab" aria-selected={map === 'new'} className={map === 'new' ? 'on' : ''} disabled={!open} onClick={() => setMap('new')}
          title={open ? 'The Mar Océano and beyond (M)' : 'Unknown. Send a fleet led by an explorer west to find it.'}>
          {open ? (game.newWorldFound ? 'New World' : 'Mar Océano') : '🔒 Unknown west'}
        </button>
      </div>
      <button className={`icon-btn ${showWind ? 'on' : ''}`} onClick={() => set({ showWind: !showWind })} title="Show winds (V)" aria-label="Show winds">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      <button className="icon-btn" onClick={() => set({ showHelp: true })} title="How to play (H)" aria-label="How to play">?</button>
      <button className="end-turn" onClick={() => void endTurn()} disabled={busy} title="End the season (Enter)">
        {busy ? 'The season passes…' : 'End season'}
        {idle > 0 && !busy && <span className="end-hint">{idle} fleet{idle > 1 ? 's' : ''} without orders</span>}
      </button>
    </header>
  );
}
