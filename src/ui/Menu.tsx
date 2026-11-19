import { useEffect, useState } from 'react';
import { useStore, clearSave } from '../store';
import { spriteUrl } from '../render/assets';

export function Menu() {
  const hasSave = useStore((s) => s.hasSave);
  const phase = useStore((s) => s.phase);
  const newGame = useStore((s) => s.newGame);
  const continueGame = useStore((s) => s.continueGame);
  const checkSave = useStore((s) => s.checkSave);
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 1e6)));
  useEffect(() => { void checkSave(); }, [checkSave]);
  const loading = phase === 'loading';
  return (
    <div className="menu">
      <div className="menu-card">
        <img className="menu-rose" src={spriteUrl('ornaments/compass-large')} alt="" />
        <h1>Age of Sail</h1>
        <p className="tagline">Chart the unknown. Trade across the ocean. Fill the Crown’s treasury.</p>
        <div className="menu-actions">
          {hasSave && <button className="primary" disabled={loading} onClick={() => void continueGame()}>Continue voyage</button>}
          <button className={hasSave ? '' : 'primary'} disabled={loading} onClick={async () => { await clearSave(); await newGame(Number(seed) || 1492); }}>
            {loading ? 'Preparing the charter…' : 'New voyage'}
          </button>
          <label className="seed">World seed <input value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></label>
        </div>
        <p className="muted small">Version 0.2 · one crown (Castile): a fixed Europe, a new African coast and a new New World every voyage.</p>
      </div>
    </div>
  );
}
