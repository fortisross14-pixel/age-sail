/** The reign told back: a short history written from the chronicle, the dynasty and the standings. */
import { rivalSpec } from '../data/rivals';
import { ERAS } from '../data/eras';
import { allNations } from './natives';
import { standings } from './empire';
import { yearOf, type GameState, type World } from './types';

const count = (s: GameState, re: RegExp) => s.chronicle.filter((c) => re.test(c.text)).length;
const firstYear = (s: GameState, re: RegExp) => { const c = s.chronicle.find((x) => re.test(x.text)); return c ? yearOf(c.turn) : null; };
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** A few paragraphs on what happened in this game, for the Chronicle and the end of the age. */
export function reignHistory(w: World, s: GameState): string[] {
  const me = rivalSpec(s.crown).name;
  const out: string[] = [];
  const d = s.dynasty;
  out.push(`The house of ${d.house} ruled ${me} through ${d.reigns.length === 1 ? 'one reign' : `${d.reigns.length} reigns`}: ${list(d.reigns.map((r) => `${r.name} (${r.from}–${r.to ?? ''})`))}.`);
  const land = firstYear(s, /¡Tierra!/);
  const firstColony = firstYear(s, /is founded|found the colony|founds? /i);
  const sea: string[] = [];
  if (land) sea.push(`In ${land} their sailors first sighted land across the Mar Océano${s.land ? `, which was named ${s.land.name}` : ''}.`);
  else sea.push('No ship of theirs found land across the Mar Océano.');
  const lost = count(s, /never seen again|drift on, empty|is lost\./);
  if (lost) sea.push(`${lost} expedition${lost === 1 ? ' was' : 's were'} lost at sea.`);
  out.push(sea.join(' '));
  const pop = s.colonies.reduce((t, c) => t + c.pop, 0);
  if (s.colonies.length) {
    const big = [...s.colonies].sort((a, b) => b.pop - a.pop)[0];
    out.push(`${firstColony ? `The first colony was planted in ${firstColony}. ` : ''}At the last count ${me} held ${s.colonies.length} colon${s.colonies.length === 1 ? 'y' : 'ies'} with ${pop} colonists, the greatest of them ${big.name}.${s.freeStates.length ? ` ${s.freeStates.length} more had thrown off the Crown.` : ''}`);
  } else out.push(`${me} planted no colony that lasted.`);
  const met = allNations(w).filter((n) => s.natives[n.id]?.met);
  if (met.length) {
    const by = (r: string) => met.filter((n) => s.natives[n.id].relation === r).map((n) => `the ${n.people}`);
    const parts = [`They met ${met.length} people${met.length === 1 ? '' : 's'}`];
    if (by('allied').length) parts.push(`made allies of ${list(by('allied'))}`);
    if (by('subject').length) parts.push(`made subjects of ${list(by('subject'))}`);
    if (by('war').length) parts.push(`were at war with ${list(by('war'))} at the end`);
    out.push(`${list(parts)}.`);
  }
  const wars = count(s, /declares war on|means war with/);
  out.push(wars ? `There ${wars === 1 ? 'was one war' : `were ${wars} wars`} with other crowns.` : 'They kept the peace with the other crowns.');
  const kept = count(s, /promise kept/), unkept = count(s, /promise unkept/);
  if (kept + unkept) out.push(`Of the ${ERAS.length - 1} ages after the first, ${kept} kept ${kept === 1 ? 'its' : 'their'} promise and ${unkept} did not.`);
  const st = standings(w, s), place = st.findIndex((x) => x.mine);
  out.push(`${me} stands ${['first', 'second', 'third', 'fourth', 'fifth'][place]} among the crowns, with ${st[place].total.toLocaleString('en-US')} points to the ${st[place === 0 ? 1 : 0].total.toLocaleString('en-US')} of ${st[place === 0 ? 1 : 0].name}.`);
  return out;
}
