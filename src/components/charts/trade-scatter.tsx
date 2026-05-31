import type { BacktestTrade } from "@/lib/backtest";
import {
  formatAxisPct,
  formatYear,
  makeScale,
  seededSample,
  yearTicks,
} from "./chart-helpers";

const W = 880;
const H = 400;
const M = { top: 30, right: 30, bottom: 36, left: 70 };

// Max SVG circles. Above this every fund's perf page blows past 3MB of HTML
// (Point72 = 4.1k trades, Mill = 1.1k). Deterministic random sampling keeps
// the visual character intact without the bloat.
const MAX_CIRCLES = 1500;

export function TradeScatterChart({
  trades,
  seed,
}: {
  trades: BacktestTrade[];
  /**
   * Stable seed for the sampling PRNG — pass the fund's CIK so the rendered
   * scatter is identical across SSR and CSR for the same fund.
   */
  seed?: string;
}) {
  const usable = trades.filter(
    (t) => t.ticker && t.entrySharePrice > 0 && isFinite(t.returnPct),
  );
  if (usable.length < 2) {
    return (
      <div className="rounded border border-hairline px-6 py-12 text-center text-sm text-muted">
        Not enough resolved trades to plot.
      </div>
    );
  }

  // Deterministic down-sample for funds with too many trades. Axes/scales
  // derive from the *full* usable set so the plot's framing doesn't shift
  // based on sampling.
  const dotsToRender = seededSample(
    usable,
    MAX_CIRCLES,
    seed ?? `n${usable.length}`,
  );

  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const dates = usable.map((t) => new Date(t.entryDate + "T00:00:00Z").getTime());
  const xMin = Math.min(...dates);
  const xMax = Math.max(...dates);
  const xScale = makeScale(xMin, xMax, M.left, M.left + plotW);

  const returns = usable.map((t) => t.returnPct);
  let yMin = Math.min(0, ...returns);
  let yMax = Math.max(0, ...returns);
  // Cap extreme outliers to avoid squashing the rest
  if (yMax > 500) yMax = 500;
  if (yMin < -90) yMin = -90;
  const yPad = (yMax - yMin) * 0.06;
  yMin -= yPad;
  yMax += yPad;
  const yScale = makeScale(yMin, yMax, M.top + plotH, M.top);

  // Bubble radius from sqrt(entry value), clamped.
  const maxValue = Math.max(...usable.map((t) => t.entryValueUsd));
  const minR = 3;
  const maxR = 18;
  const rScale = (v: number) => {
    if (maxValue <= 0) return minR;
    const ratio = Math.sqrt(v / maxValue);
    return minR + (maxR - minR) * ratio;
  };

  // Coarse Y gridlines at meaningful pct levels.
  const yTickCandidates = [-50, -25, 0, 25, 50, 100, 200, 500];
  const yTicks = yTickCandidates.filter((t) => t >= yMin && t <= yMax);
  if (!yTicks.includes(0)) yTicks.push(0);
  yTicks.sort((a, b) => a - b);

  const xTicks = yearTicks(
    usable.reduce((min, t) => (t.entryDate < min ? t.entryDate : min), usable[0].entryDate),
    usable.reduce((max, t) => (t.entryDate > max ? t.entryDate : max), usable[0].entryDate),
  );

  // Find a couple of standout trades to annotate.
  const sortedByAbs = [...usable].sort(
    (a, b) => Math.abs(b.returnPct) - Math.abs(a.returnPct),
  );
  const callouts = new Set(sortedByAbs.slice(0, 3));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      <g>
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={M.left + plotW}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke={t === 0 ? "var(--foreground)" : "var(--hairline)"}
              strokeOpacity={t === 0 ? 0.4 : 1}
              strokeWidth={1}
            />
            <text
              x={M.left - 10}
              y={yScale(t) + 4}
              textAnchor="end"
              fontFamily="var(--font-mono), monospace"
              fontSize={10}
              fill="var(--muted)"
            >
              {formatAxisPct(t)}
            </text>
          </g>
        ))}
      </g>

      {/* Dots */}
      <g>
        {dotsToRender.map((t, i) => {
          const cx = xScale(new Date(t.entryDate + "T00:00:00Z").getTime());
          const cy = yScale(Math.max(yMin, Math.min(yMax, t.returnPct)));
          const r = rScale(t.entryValueUsd);
          const positive = t.returnPct >= 0;
          const fill = positive ? "var(--positive)" : "var(--negative)";
          const opacity = t.status === "open" ? 0.55 : 0.85;
          return (
            <circle
              key={`${t.cusip}-${i}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={fill}
              fillOpacity={opacity}
              stroke={t.status === "open" ? fill : "none"}
              strokeWidth={t.status === "open" ? 1 : 0}
              strokeDasharray={t.status === "open" ? "2 2" : ""}
            />
          );
        })}
      </g>

      {/* Callouts */}
      <g>
        {Array.from(callouts).map((t) => {
          const cx = xScale(new Date(t.entryDate + "T00:00:00Z").getTime());
          const cy = yScale(Math.max(yMin, Math.min(yMax, t.returnPct)));
          const r = rScale(t.entryValueUsd);
          const labelY = cy - r - 6;
          const ticker = t.ticker ?? t.issuer.slice(0, 18);
          const label = `${ticker} · ${t.returnPct >= 0 ? "+" : ""}${t.returnPct.toFixed(0)}%`;
          return (
            <g key={`cb-${t.cusip}`}>
              <text
                x={cx}
                y={labelY}
                textAnchor="middle"
                fontFamily="var(--font-serif), serif"
                fontSize={12}
                fill="var(--foreground)"
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>

      {/* X axis */}
      <g>
        {xTicks.map((iso) => {
          const t = new Date(iso + "T00:00:00Z").getTime();
          if (t < xMin || t > xMax) return null;
          const x = xScale(t);
          return (
            <g key={iso}>
              <line
                x1={x}
                x2={x}
                y1={M.top + plotH}
                y2={M.top + plotH + 4}
                stroke="var(--hairline)"
              />
              <text
                x={x}
                y={M.top + plotH + 18}
                textAnchor="middle"
                fontFamily="var(--font-mono), monospace"
                fontSize={10}
                fill="var(--muted)"
              >
                {formatYear(iso)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
