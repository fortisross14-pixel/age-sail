/** Armies at a glance and the battle report: who fought, three rounds, who broke, who fell. */
import { useStore } from '../store';
import { UNIT_INFO } from '../data/court';
import { COMBAT } from '../data/army';
import { WALLS } from '../data/army';
import { spriteUrl } from '../render/assets';
import { Art, CrestArt } from './theme/Art';
import { Portrait } from './theme/Portrait';
import { personById } from '../sim/court';
import { nationById } from '../sim/natives';
import type { BattleReport, BattleSide, Unit, UnitType } from '../sim/types';

export const unitArt = (u: UnitType) => <Art slot={`unit/${u}`} fallback={<img src={spriteUrl(UNIT_INFO[u].sprite)} alt="" />} />;

/** Companies grouped by type: a painted figure, how many, and veteran stars. */
export function ArmyRow({ units }: { units: Pick<Unit, 'type' | 'vet'>[] }) {
  const groups: { type: UnitType; n: number; vet: number }[] = [];
  for (const u of units) {
    const g = groups.find((x) => x.type === u.type);
    if (g) { g.n++; g.vet = Math.max(g.vet, u.vet ?? 0); } else groups.push({ type: u.type, n: 1, vet: u.vet ?? 0 });
  }
  if (!groups.length) return <div className="army-row muted small">No one under arms.</div>;
  return (
    <div className="army-row">
      {groups.map((g) => {
        const c = COMBAT[g.type];
        return (
          <span key={g.type} className="company" title={`${UNIT_INFO[g.type].name} ×${g.n}${g.vet ? ` · veterans (${'★'.repeat(g.vet)})` : ''}\nFire ${c.fire} · melee ${c.shock} · toughness ${c.hp} · pursuit ${c.pursuit}\n${UNIT_INFO[g.type].blurb}`}>
            <span className="company-art">{unitArt(g.type)}</span>
            <b>{g.n}</b>
            {g.vet > 0 && <i className="vet">{'★'.repeat(g.vet)}</i>}
          </span>
        );
      })}
    </div>
  );
}

function SideCard({ side, won, morale }: { side: BattleSide; won: boolean; morale: number }) {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const general = side.general != null ? personById(game, side.general) : undefined;
  const nation = side.nation ? nationById(world, side.nation) : undefined;
  return (
    <div className={`battle-side ${won ? 'won' : 'lost'}`}>
      <div className="battle-head">
        {general ? <Portrait p={general} turn={game.turn} /> : side.crown ? <CrestArt realm={side.crown} size={64} fallback={null} /> : <span className="native-mark" aria-hidden>✦</span>}
        <div>
          <b>{nation ? `The ${nation.people}` : side.name}</b>
          <div className="muted small">{general ? `led by ${general.name}` : nation ? 'warriors' : ''}{side.walls ? ` · behind ${WALLS[side.walls].name.toLowerCase()}` : ''}</div>
          <div className="morale" title="Morale at the end of the battle"><span style={{ width: `${morale}%` }} /></div>
        </div>
        <span className={`verdict ${won ? 'good' : 'bad'}`}>{won ? 'Victory' : 'Defeat'}</span>
      </div>
      <div className="battle-units">
        {side.units.filter((u) => u.n > 0).map((u) => (
          <span key={u.type} className="company" title={UNIT_INFO[u.type].name}>
            <span className="company-art">{unitArt(u.type)}</span>
            <b>{u.n - u.lost}</b>
            {u.lost > 0 && <i className="lost">−{u.lost}</i>}
          </span>
        ))}
        {side.warriors && (
          <span className="company warriors" title="Warriors">
            <span className="company-art"><img src={spriteUrl('colonies/trading-post-outpost')} alt="" /></span>
            <b>{side.warriors.n - side.warriors.lost}</b>
            {side.warriors.lost > 0 && <i className="lost">−{side.warriors.lost}</i>}
          </span>
        )}
      </div>
    </div>
  );
}

/** The report: both sides, the three rounds as opposed bars, and the outcome. */
export function BattleReportView({ r }: { r: BattleReport }) {
  const max = Math.max(1, ...r.rounds.flatMap((x) => [x.atk, x.def]));
  return (
    <div className="battle-report">
      <div className="battle-sides">
        <SideCard side={r.attacker} won={r.attackerWon} morale={r.morale.atk} />
        <span className="vs" aria-hidden><Art slot="misc/gun" fallback={<>⚔</>} /></span>
        <SideCard side={r.defender} won={!r.attackerWon} morale={r.morale.def} />
      </div>
      <div className="rounds">
        {r.rounds.map((x) => (
          <div key={x.name} className="round">
            <span className="bar atk"><span style={{ width: `${(x.atk / max) * 100}%` }} /></span>
            <b>{x.name}</b>
            <span className="bar def"><span style={{ width: `${(x.def / max) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <div className="muted small center">{r.terrain} · {r.stance === 'assault' ? 'an all-out assault' : 'a steady advance'}</div>
    </div>
  );
}
