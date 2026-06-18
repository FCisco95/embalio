export interface Fit {
  slope: number;
  intercept: number;
  r2: number;
}

/** Ordinary least-squares fit. Throws on <2 points. r2 is 0 (not NaN) when y is flat. */
export function linearRegression(points: { x: number; y: number }[]): Fit {
  const n = points.length;
  if (n < 2) throw new Error("linearRegression needs at least 2 points");
  const xBar = points.reduce((s, p) => s + p.x, 0) / n;
  const yBar = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    const dx = p.x - xBar, dy = p.y - yBar;
    sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = yBar - slope * xBar;
  let ssres = 0;
  for (const p of points) { const e = p.y - (slope * p.x + intercept); ssres += e * e; }
  const r2 = syy === 0 ? 0 : Math.max(0, 1 - ssres / syy);
  return { slope, intercept, r2 };
}

/** Exponential moving average. alpha in (0,1]; throws on empty input. */
export function ema(values: number[], alpha: number): number {
  if (values.length === 0) throw new Error("ema needs at least 1 value");
  let acc = values[0];
  for (let i = 1; i < values.length; i++) acc = alpha * values[i] + (1 - alpha) * acc;
  return acc;
}
