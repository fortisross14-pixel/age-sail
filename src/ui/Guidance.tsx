import { useState } from 'react';
import { useStore } from '../store';
import { Icon } from './theme/icons';
import { sfx } from './sound';
import { pref, setPref } from './prefs';
import { attention, type Target } from './attention';
import { VOYAGE, type ObjectiveDef } from '../data/objectives';
import { activeAmbitions, objectiveDone, objectiveProgress, rewardOf, rewardText, voyageDone } from '../sim/objectives';
import { portById } from '../sim/game';
import { crownSpec } from '../data/rivals';
import { difficultySpec } from '../data/difficulty';
import { fmt } from './format';
import type { GameState } from '../sim/types';

/** Turn an objective's "Show me" into a place on the screen. */
function targetOf(o: ObjectiveDef, g: GameState): Target {
  const t = o.goto ?? {};
  if (t.fleet) {
    const f = (t.fleet === 'led' ? g.fleets.find((x) => x.leader != null) : undefined) ?? g.fleets[0];
    return f ? { fleet: f.id } : { drawer: 'fleets' };
  }
  return { drawer: t.screen, courtTab: t.courtTab };
}

/**
 * The first voyage and your advisers' ambitions, on the right of the map: what to do next, how,
 * and what it pays. Folds away to its title.
 */
export function ObjectivesPanel() {
  const game = useStore((s) => s.game)!;
  const world = useStore((s) => s.world)!;
  const goTo = useStore((s) => s.goTo);
  const [folded, setFolded] = useState(pref('objectivesFolded'));
  const [picked, setPicked] = useState<string | null>(null);
  const voyage = !voyageDone(game);
  const ambitions = activeAmbitions(game);
  if (!voyage && !ambitions.length) return null;
  const next = VOYAGE.find((o) => !objectiveDone(game, o.id));
  const open = picked && (VOYAGE.some((o) => o.id === picked && !objectiveDone(game, o.id)) || ambitions.some((o) => o.id === picked)) ? picked : next?.id ?? ambitions[0]?.id;
  const done = VOYAGE.filter((o) => objectiveDone(game, o.id)).length;
  const fold = () => { const v = !folded; setFolded(v); setPref('objectivesFolded', v); sfx(v ? 'close' : 'open'); };

  const row = (o: ObjectiveDef, n?: number) => {
    const isDone = objectiveDone(game, o.id);
    const isOpen = !isDone && open === o.id;
    const paid = rewardText(rewardOf(game, o));
    const prog = isDone ? null : objectiveProgress(world, game, o.id);
    return (
      <li key={o.id} className={`obj ${isDone ? 'done' : ''} ${isOpen ? 'open' : ''}`}>
        <button className="obj-head" disabled={isDone} aria-expanded={isOpen} onClick={() => { sfx('select'); setPicked(o.id); }}>
          <span className="obj-mark" aria-hidden>{isDone ? '✓' : n ?? '◆'}</span>
          <span className="obj-title">{o.title}</span>
          {prog && <span className="obj-count">{fmt(Math.min(prog.have, prog.need))} / {fmt(prog.need)}</span>}
        </button>
        {isOpen && (
          <div className="obj-body">
            {o.from && <div className="obj-from">{o.from} asks</div>}
            <p>{o.how}</p>
            <div className="obj-foot">
              {paid && <span className="obj-reward">Reward: {paid}</span>}
              <button className="small-btn" onClick={() => goTo(targetOf(o, game))}>Show me</button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className={`objectives ${folded ? 'folded' : ''}`} aria-label="Objectives">
      <button className="obj-fold" onClick={fold} aria-expanded={!folded} title={folded ? 'Show objectives' : 'Fold away'}>
        <Icon name="chronicle" size={18} />
        <span>{voyage ? 'First voyage' : 'Ambitions'}</span>
        <span className="obj-tally">{voyage ? `${done} / ${VOYAGE.length}` : ambitions.length}</span>
      </button>
      {!folded && (
        <div className="obj-scroll">
          {voyage && <ol className="obj-list">{VOYAGE.map((o, i) => row(o, i + 1))}</ol>}
          {ambitions.length > 0 && (
            <>
              {voyage && <h4 className="obj-sub">Ambitions</h4>}
              <ul className="obj-list">{ambitions.map((o) => row(o))}</ul>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

/** End Turn asks first when something urgent is undone: each line jumps to the thing itself. */
export function EndTurnGuard() {
  const show = useStore((s) => s.showGuard);
  const game = useStore((s) => s.game);
  const world = useStore((s) => s.world);
  const set = useStore((s) => s.set);
  const goTo = useStore((s) => s.goTo);
  const endTurn = useStore((s) => s.endTurn);
  if (!show || !game || !world) return null;
  const items = attention(game, world);
  const urgent = items.filter((a) => a.urgent), rest = items.filter((a) => !a.urgent);
  const line = (a: (typeof items)[number]) => (
    <li key={a.id}>
      <button onClick={() => goTo(a.go)}><span>{a.text}</span><Icon name="arrow" size={16} /></button>
    </li>
  );
  return (
    <div className="modal-back" onClick={() => set({ showGuard: false })}>
      <div className="modal guard" role="dialog" aria-label="Before the turn ends" onClick={(e) => e.stopPropagation()}>
        <h2>Before the turn ends</h2>
        <p className="muted">Your advisers ask for a word. Choose one to see to it, or let the turn pass.</p>
        <ul className="guard-list urgent">{urgent.map(line)}</ul>
        {rest.length > 0 && <>
          <h4>Also worth a look</h4>
          <ul className="guard-list">{rest.map(line)}</ul>
        </>}
        <div className="row center">
          <button className="primary" autoFocus onClick={() => void endTurn(true)}>End the turn anyway</button>
          <button onClick={() => set({ showGuard: false })}>Back to the map</button>
        </div>
        <p className="muted small">You are asked about each of these only once. Settings turns these reminders off.</p>
      </div>
    </div>
  );
}

/** A short greeting at the start of a voyage; the objectives panel carries the teaching from here. */
export function Welcome() {
  const show = useStore((s) => s.showWelcome);
  const game = useStore((s) => s.game);
  const world = useStore((s) => s.world);
  const set = useStore((s) => s.set);
  if (!show || !game || !world) return null;
  const crown = crownSpec(game.crown);
  const d = difficultySpec(game.difficulty);
  return (
    <div className="modal-back">
      <div className="modal welcome" role="dialog" aria-label="Your realm">
        <h2>Your realm</h2>
        <p>It is 1492, and you rule {crown.name}. Two ships wait in {portById(world, crown.home)?.name}, with a colonist, a soldier, your court and {fmt(game.treasury)} ducats. South lies the African coast beyond Cape Bojador, uncharted and different every voyage. West lies the open Mar Océano: pilots say no ship that sails far into it comes back.</p>
        <p>Your advisers have set out a <b>first voyage</b>, step by step, in the panel on the right. Each step says how, and <b>Show me</b> opens the right screen. Nothing forces the order: this is your realm.</p>
        <p className="muted small">{d.name}: {d.blurb} The full guide is under the question mark, or <kbd>H</kbd>.</p>
        <div className="row center">
          <button className="primary" autoFocus onClick={() => set({ showWelcome: false })}>Set out</button>
          <button onClick={() => set({ showWelcome: false, showHelp: true })}>Read the guide first</button>
        </div>
      </div>
    </div>
  );
}

/** The reminders switch, for Settings. */
export function GuardSwitch() {
  const [on, setOn] = useState(pref('guard'));
  return (
    <label>Reminders at End Turn
      <button className={on ? 'on' : ''} aria-pressed={on} onClick={() => { const v = !on; setOn(v); setPref('guard', v); sfx('select'); }}>{on ? 'On' : 'Off'}</button>
    </label>
  );
}
