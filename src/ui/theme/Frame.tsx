import type { ReactNode, HTMLAttributes } from 'react';
import { Corner } from './icons';

/**
 * The Admiralty frame: a lacquered band, a gold-leaf edge with filigree corners, and either a
 * parchment interior (default) or a lacquer one for controls that sit on the map.
 */
export function Frame({ children, surface = 'parchment', corners = true, className = '', ...rest }:
  { children: ReactNode; surface?: 'parchment' | 'lacquer'; corners?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`adm-frame surface-${surface} ${className}`} {...rest}>
      <div className="adm-frame-inner">{children}</div>
      {corners && <>
        <Corner at="tl" /><Corner at="tr" /><Corner at="bl" /><Corner at="br" />
      </>}
      <span className="adm-shine" aria-hidden />
    </div>
  );
}
