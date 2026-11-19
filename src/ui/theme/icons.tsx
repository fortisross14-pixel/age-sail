/**
 * The Admiralty icon set: line icons drawn in gold leaf. They stand in for the painted icon sheet
 * (see art/PROMPTS.md); `Art` swaps in painted art when it exists.
 */
const PATHS = {
  cities: 'M3 21V10l4-3 4 3v11M11 21V6l5-3 5 3v15M2 21h20M6 14h2M14 9h3M14 13h3M14 17h3',
  markets: 'M12 3v18M7 21h10M4 7h16M4 7l-3 6h6zM20 7l-3 6h6z',
  fleets: 'M12 3v13M12 4l7 9h-7M12 6l-6 7h6M3 17h18l-2 4H5z',
  court: 'M3 9l4 3 5-7 5 7 4-3-2 10H5zM5 22h14',
  research: 'M9 3h6M10 3v6L4.5 19A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-2L14 9V3M7.5 15h9',
  chronicle: 'M6 4h11a2 2 0 0 1 2 2v12M6 4a2 2 0 0 0-2 2v1h4M6 4a2 2 0 0 1 2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1H10M11 9h5M11 12h5M11 15h3',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2c3 3 4 6.5 4 10s-1 7-4 10c-3-3-4-6.5-4-10s1-7 4-10z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7',
  grid: 'M7 3l4 2.3v4.6L7 12.2 3 9.9V5.3zM17 3l4 2.3v4.6l-4 2.3-4-2.3V5.3zM12 11.8l4 2.3v4.6L12 21l-4-2.3v-4.6z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  home: 'M3 11l9-7 9 7M5 9.5V21h14V9.5M10 21v-6h4v6',
  next: 'M12 3v10M12 4l6 8h-6M3 14h14l-2 4H5zM17 6l4 3-4 3',
  coins: 'M12 7c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 4v4c0 1.7 3.6 3 8 3s8-1.3 8-3V4M4 8v4c0 1.7 3.6 3 8 3s8-1.3 8-3V8M4 12v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4',
  star: 'M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  prev: 'M15 5l-7 7 7 7',
  nextArrow: 'M9 5l7 7-7 7',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  sound: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mute: 'M4 9v6h4l5 4V5L8 9zM22 9l-6 6M16 9l6 6',
  docks: 'M12 5v15M8 8h8M5 14c0 4 3 6 7 6s7-2 7-6M3 14h4M17 14h4M12 2a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 12 2z',
  barracks: 'M5 3l12 12M19 3L7 15M3.5 16.5l3 3M20.5 16.5l-3 3M8 13l-3 3M16 13l3 3',
  church: 'M12 2v6M9.5 4.5h5M5 22V12l7-4 7 4v10zM10 22v-5h4v5',
  university: 'M2 9l10-5 10 5-10 5zM6 11v6c3 2 9 2 12 0v-6M22 9v6',
  market: 'M3 10l2-6h14l2 6M3 10h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 14v7h14v-7M10 21v-4h4v4',
  navigation: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 5l2 7-2 7-2-7z',
  military: 'M5 19L19 5M15 5h4v4M7 13l4 4M4 20l2-2',
  commerce: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM14.5 9c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6v1.5M12 16.5V18',
  construction: 'M14 6l4 4-9 9-4-4zM14 6l2-2 4 4-2 2M3 21l2-2',
  diplomacy: 'M20 4c-6 1-11 6-13 13l-2 3M20 4c0 6-4 11-10 12M9 14l2 2',
  taxes: 'M4 21V9l8-5 8 5v12M2 21h20M8 21v-7M12 21v-7M16 21v-7',
  units: 'M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 22c.5-5 3-8 7-8s6.5 3 7 8',
} as const;

export type IconName = keyof typeof PATHS;

/** A gold icon. `tone="ink"` draws it in ink for parchment surfaces. */
export function Icon({ name, size = 24, tone = 'gold', title }: { name: IconName; size?: number; tone?: 'gold' | 'ink' | 'light'; title?: string }) {
  return (
    <svg className={`adm-icon tone-${tone}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Gradients and filters every gold surface refers to. Rendered once. */
export function GoldDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="adm-gold" gradientUnits="userSpaceOnUse" x1="0" y1="1" x2="0" y2="23">
          <stop offset="0" stopColor="#fff3c6" />
          <stop offset=".35" stopColor="#e9c46c" />
          <stop offset=".62" stopColor="#b5832e" />
          <stop offset="1" stopColor="#f0d58a" />
        </linearGradient>
        <linearGradient id="adm-gold-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c6" />
          <stop offset=".35" stopColor="#e9c46c" />
          <stop offset=".62" stopColor="#b5832e" />
          <stop offset="1" stopColor="#f0d58a" />
        </linearGradient>
        <linearGradient id="adm-gold-flat" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6dc90" />
          <stop offset=".5" stopColor="#c8953a" />
          <stop offset="1" stopColor="#8a5c1c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** One gold filigree corner, drawn for the top-left and mirrored for the others. */
export function Corner({ at }: { at: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg className={`adm-corner adm-corner-${at}`} viewBox="0 0 64 64" aria-hidden>
      <path className="c-shadow" d="M4 60V22C4 12 12 4 22 4h38" />
      <path className="c-gold" d="M4 60V22C4 12 12 4 22 4h38" />
      <path className="c-gold thin" d="M11 52V25c0-8 6-14 14-14h27" />
      <path className="c-gold leaf" d="M18 30c2-8 6-12 13-13-1 7-5 11-13 13zM30 18c4-1 7 0 9 3-3 2-6 2-9-3zM18 30c-1 4 0 7 3 9 2-3 2-6-3-9z" />
      <circle className="c-gold dot" cx="11" cy="11" r="3.4" />
    </svg>
  );
}

/** A heraldic shield in the crown's colours, with a ship for the sea-going crowns' arms. */
export function Crest({ primary, secondary, size = 44 }: { primary: string; secondary: string; size?: number }) {
  return (
    <svg className="adm-crest" width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden>
      <path d="M3 3h34v18c0 12-8 19-17 22C11 40 3 33 3 21z" fill={primary} stroke="url(#adm-gold-box)" strokeWidth="2.6" />
      <path d="M3 3h34v18c0 12-8 19-17 22C11 40 3 33 3 21z" fill="none" stroke="rgba(0,0,0,.35)" strokeWidth=".8" transform="translate(0 .8)" />
      <g fill="none" stroke={secondary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 9v18M20 10l7 10h-7M20 13l-5 7h5M11 28h18l-3 5H14z" />
      </g>
    </svg>
  );
}
