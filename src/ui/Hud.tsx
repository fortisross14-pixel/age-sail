import { useStore } from '../store';
import { turnLabel, turnStride, yearOf } from '../sim/types';
import { score } from '../sim/colony';
import { rivalScore } from '../sim/rivals';
import { rivalsOf, crownSpec } from '../data/rivals';
import { CROWN } from '../render/palette';
import { eraAt } from '../data/eras';
import { fmt } from './format';
import { spriteUrl } from '../render/assets';
import { Icon, Crest } from './theme/icons';
import { Medal, CrestArt } from './theme/Art';
import { sfx } from './sound';
import { attention } from './attention';

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th'];

/** The top bar: your arms, the date, the treasury and standing, quick panels and the end of the season. */
export function Hud() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const busy = useStore((s) => s.busy);
  const drawer = useStore((s) => s.drawer);
  const showSettings = useStore((s) => s.showSettings);
  const set = useStore((s) => s.set);
  const endTurn = useStore((s) => s.endTurn);
  const sc = score(game, world);
  const rank = 1 + rivalsOf(game.crown).filter((r) => rivalScore(game, r.id).total > sc.total).length;
  const waiting = attention(game, world).filter((a) => a.urgent);
  const crown = crownSpec(game.crown);
  const colours = CROWN[game.crown];
  const era = eraAt(yearOf(game.turn));
  const toggle = (d: 'research' | 'chronicle' | 'court') => set({ drawer: drawer === d ? null : d });
  return (
    <header className="hud">
      <Armillary />
      <div className="hud-crest" title={`${crown.name}. ${crown.edge.label}`}>
        <CrestArt realm={game.crown} size={56} fallback={<Crest primary={colours.css2} secondary={colours.css} size={46} />} />
      </div>
      <div className="hud-date" title={`${era.blurb} The age ends in ${1492 + Math.floor(game.endTurn / 4)}${game.ended ? ' (passed: playing on)' : ''}.`}>
        <div className="season">{turnLabel(game.turn)}</div>
        <div className="era">{era.name}</div>
      </div>
      <span className="hud-sep" />
      <div className="stat" title="Treasury, in ducats">
        <Medal name="coins" size={44} fallback={<img src={spriteUrl('goods/gold')} alt="" />} />
        <div><div className="stat-value">{fmt(game.treasury)}</div><div className="stat-label">ducats</div></div>
      </div>
      <span className="hud-sep" />
      <div className="stat" title="Prestige: from discoveries, victories and great deeds">
        <Medal name="star" size={44} fallback={<Icon name="star" size={30} />} />
        <div><div className="stat-value">{fmt(game.prestige)}</div><div className="stat-label">prestige</div></div>
      </div>
      <span className="hud-sep" />
      <button className="stat plain" onClick={() => set({ drawer: 'court', courtTab: 'crowns' })}
        title={`Score: ${sc.pop} colonists ×10, ${sc.territory} hexes of territory ×2, ${sc.commerce} from ${fmt(game.revenue)} ducats of sales`}>
        <Medal name="court" size={44} fallback={<Icon name="court" size={30} />} />
        <div><div className="stat-value">{fmt(sc.total)}</div><div className="stat-label">score ({ORDINAL[rank - 1]} of 5)</div></div>
      </button>
      <div className="spacer" />
      <div className="hud-tools">
        <button className={`adm-square ${drawer === 'chronicle' ? 'on' : ''}`} onClick={() => toggle('chronicle')} title="Chronicle (6)" aria-label="Chronicle"><Medal name="chronicle" size={50} fallback={<Icon name="chronicle" size={26} />} /></button>
        <button className={`adm-square ${drawer === 'research' ? 'on' : ''}`} onClick={() => toggle('research')} title="Research (5)" aria-label="Research"><Medal name="research" size={50} fallback={<Icon name="research" size={26} />} /></button>
        <button className={`adm-square ${drawer === 'court' ? 'on' : ''}`} onClick={() => toggle('court')} title="Court (4)" aria-label="Court"><Medal name="people" size={50} fallback={<Icon name="units" size={26} />} /></button>
        <button className={`adm-square ${showSettings ? 'on' : ''}`} onClick={() => { sfx(showSettings ? 'close' : 'open'); set({ showSettings: !showSettings }); }} title="Settings" aria-label="Settings"><Medal name="settings" size={50} fallback={<Icon name="settings" size={26} />} /></button>
      </div>
      <button className="end-turn" onClick={() => void endTurn()} disabled={busy} title={waiting.length ? `${waiting.map((a) => a.text).join('\n')}\n(Enter)` : `End the turn: ${turnStride(game.turn) === 2 ? 'half a year' : 'a year'} passes (Enter)`}>
        {busy ? 'Time passes…' : 'End Turn'}
        {!busy && waiting.length > 0 && <span className="end-count" aria-label={`${waiting.length} things need you`}>{waiting.length}</span>}
        <Icon name="arrow" size={22} tone="light" />
      </button>
    </header>
  );
}

/** A faint brass armillary sphere behind the bar, as on the concept. */
function Armillary() {
  return (
    <svg className="armillary" viewBox="0 0 200 200" aria-hidden>
      <g fill="none" stroke="url(#adm-gold)" strokeWidth="2">
        <circle cx="100" cy="100" r="88" />
        <ellipse cx="100" cy="100" rx="88" ry="30" />
        <ellipse cx="100" cy="100" rx="88" ry="30" transform="rotate(60 100 100)" />
        <ellipse cx="100" cy="100" rx="88" ry="30" transform="rotate(-60 100 100)" />
        <ellipse cx="100" cy="100" rx="30" ry="88" />
        <circle cx="100" cy="100" r="14" />
      </g>
    </svg>
  );
}
