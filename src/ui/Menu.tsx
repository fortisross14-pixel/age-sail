import { useEffect, useState } from 'react';
import { useStore, clearSave } from '../store';
import { spriteUrl } from '../render/assets';
import { GAME_LENGTHS, DEFAULT_UNTIL } from '../data/eras';
import { CROWNS, type CrownId } from '../data/rivals';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, type Difficulty } from '../data/difficulty';
import { CROWN } from '../render/palette';
import { cityById } from '../data/europe';
import { CrestArt } from './theme/Art';

export function Menu() {
  const hasSave = useStore((s) => s.hasSave);
  const saveProblem = useStore((s) => s.saveProblem);
  const phase = useStore((s) => s.phase);
  const newGame = useStore((s) => s.newGame);
  const continueGame = useStore((s) => s.continueGame);
  const checkSave = useStore((s) => s.checkSave);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  const [until, setUntil] = useState<number>(DEFAULT_UNTIL);
  const [crown, setCrown] = useState<CrownId>('spain');
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  useEffect(() => { void checkSave(); }, [checkSave]);
  const loading = phase === 'loading';
  return (
    <div className="menu painted" style={{ backgroundImage: `linear-gradient(180deg, rgba(8, 16, 24, .15), rgba(8, 16, 24, .55)), url(${import.meta.env.BASE_URL}sprites/art/title.webp)` }}>
      <div className="menu-card adm-menu-card">
        <img className="menu-rose" src={spriteUrl('ornaments/compass-large')} alt="" />
        <h1>Age of Sail</h1>
        <p className="tagline">Chart the unknown. Trade across the ocean. Build an empire.</p>
        <div className="menu-actions">
          {saveProblem && <p className="save-problem" role="status">{saveProblem}</p>}
          {hasSave && <button className="primary" disabled={loading} onClick={() => void continueGame()}>Continue voyage</button>}
          <button className={hasSave ? '' : 'primary'} disabled={loading} onClick={async () => { await clearSave(); await newGame(Number(seed) || 1492, until, crown, difficulty); }}>
            {loading ? 'Preparing the charter…' : 'New voyage'}
          </button>
          <div className="crowns" role="radiogroup" aria-label="Crown to lead">
            {CROWNS.map((c) => (
              <button key={c.id} role="radio" aria-checked={crown === c.id} className={`crown-pick ${crown === c.id ? 'on' : ''}`} onClick={() => setCrown(c.id)} title={c.blurb}>
                <CrestArt realm={c.id} size={56} fallback={<span className="crown-flag big" style={{ background: CROWN[c.id].css, borderColor: CROWN[c.id].css2 }} aria-hidden />} />
                <span className="crown-pick-name">{c.name.replace(/^the /, "")}</span>
                <span className="crown-pick-home">{cityById(c.home)?.name}</span>
              </button>
            ))}
          </div>
          <p className="crown-edge">{CROWNS.find((c) => c.id === crown)!.edge.label}</p>
          <div className="lengths" role="radiogroup" aria-label="Length of the game">
            {GAME_LENGTHS.map((l) => (
              <button key={l.id} role="radio" aria-checked={until === l.until} className={until === l.until ? 'on' : ''} title={l.blurb} onClick={() => setUntil(l.until)}>
                {l.name} <span className="muted small">to {l.until}</span>
              </button>
            ))}
          </div>
          <div className="lengths" role="radiogroup" aria-label="Difficulty">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} role="radio" aria-checked={difficulty === d.id} className={difficulty === d.id ? 'on' : ''} title={d.blurb} onClick={() => setDifficulty(d.id)}>{d.name}</button>
            ))}
          </div>
          <p className="muted small menu-note">{DIFFICULTIES.find((d) => d.id === difficulty)!.blurb}</p>
          <label className="seed">World seed <input value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></label>
        </div>
        <p className="muted small">Version 0.14 · lead one of the five Atlantic crowns through the age of sail: a fixed Europe, a new African coast and a new New World every voyage.</p>
      </div>
    </div>
  );
}
