export function Sparkline({ values, width = 64, height = 18 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} aria-hidden />;
  const lo = Math.min(...values), hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 2) + 1},${height - 2 - ((v - lo) / span) * (height - 4)}`).join(' ');
  const up = values[values.length - 1] >= values[values.length - 2];
  return (
    <svg width={width} height={height} className="spark" aria-label={`price trend, ${up ? 'rising' : 'falling'}`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
