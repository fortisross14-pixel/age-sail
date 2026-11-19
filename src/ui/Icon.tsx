import { spriteUrl } from '../render/assets';

export function GoodIcon({ good, size = 26 }: { good: string; size?: number }) {
  return <img className="good-icon" src={spriteUrl(`goods/${good}`)} width={size} height={size} alt="" />;
}

export function ShipIcon({ type, size = 44 }: { type: string; size?: number }) {
  return <img className="ship-icon" src={spriteUrl(`ships/${type}`)} width={size} alt="" />;
}
