import type { PnlPoint } from "@/lib/backtest";
import {
  buildStepPath,
  formatAxisDollar,
  formatYear,
  makeScale,
  niceTicks,
  seededSample,
  yearTicks,
} from "./chart-helpers";

const W = 880;
const H = 360;
const M = { top: 30, right: 30, bottom: 36, left: 80 };

// Cap per-step dot circles. Heavy multi-strat funds (Point72 ≈ 3.3k closed
// trades) would otherwise add ~800KB to the rendered HTML and push the perf
// page well past the 1.5MB budget. The stair-step path and top-trade callouts
// still use the full series — only the dot decorations sample.
const MAX_DOTS = 400;

export function PnlStairstepChart({
  data,
  mirrorScale = 1,
}: {
  data: PnlPoint[];
  /**
   * Multiplier applied to every cumulative-PnL and per-trade callout so the
   * chart reflects the $10k-mirror narrative. Defaults to 1 (raw full-book
   * values). For Berkshire's $89B first filing, mirrorScale ≈ 1.12e-7 — DEO's
   * −$20.6B raw P&L renders as roughly −$2.3k after scaling.
   */
  mirrorScale?: number;
}) {
  if (data.length < 2) {
    return (
      <div className="rounded border border-hairline px-6 py-12 text-center text-sm text-muted">
        No closed trades yet — every position the fund opened is still held.
      </div>
    );
  }

  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xMin = new Date(data[0].date + "T00:00:00Z").getTime();
  const xMax = new Date(data[data.length - 1].date + "T00:00:00Z").getTime();
  const xScale = makeScale(xMin, xMax, M.left, M.left + plotW);

  const allVals = data.map((d) => d.cumulative * mirrorScale);
  let yMin = Math.min(0, ...allVals);
  let yMax = Math.max(0, ...allVals);
  if (yMin === yMax) yMax = yMin + 1;
  const yPad = (yMax - yMin) * 0.1;
  yMin -= yPad;
  yMax += yPad;
  const yScale = makeScale(yMin, yMax, M.top + plotH, M.top);

  const points: Array<[number, number]> = data.map((d) => [
    xScale(new Date(d.date + "T00:00:00Z").getTime()),
    yScale(d.cumulative * mirrorScale),
  ]);
  // Anchor the start at y=0 so the step path starts from the zero line.
  const anchored: Array<[number, number]> = [
    [points[0][0], yScale(0)],
    ...points,
  ];

  const yTicks = niceTicks(yMin, yMax, 5);
  const xTicks = yearTicks(data[0].date, data[data.length - 1].date);

  // Label the top 4 biggest trades by abs P&L. Rank by raw magnitude (the
  // mirror scale is uniform, so it doesn't change ordering).
  const topTrades = [...data]
    .sort((a, b) => Math.abs(b.trade.pnlUsd) - Math.abs(a.trade.pnlUsd))
    .slice(0, 4);

  // Decide which indices get a dot circle. Heavy funds (Point72 ≈ 3.3k closed
  // trades) would otherwise emit one circle per point. Always keep the
  // top-trade indices so their annotation pins still anchor on a visible dot.
  const topIdxSet = new Set(topTrades.map((t) => data.indexOf(t)));
  const sampleableIdx = data
    .map((_, i) => i)
    .filter((i) => !topIdxSet.has(i));
  const sampledIdx = seededSample(
    sampleableIdx,
    Math.max(0, MAX_DOTS - topIdxSet.size),
    `n${data.length}`,
  );
  const dotIdxSet = new Set([...topIdxSet, ...sampledIdx]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      {/* Y gridlines */}
      <g>
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={M.left + plotW}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="var(--hairline)"
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
              {formatAxisDollar(t)}
            </text>
          </g>
        ))}
      </g>
      {/* Zero baseline emphasized */}
      <line
        x1={M.left}
        x2={M.left + plotW}
        y1={yScale(0)}
        y2={yScale(0)}
        stroke="var(--foreground)"
        strokeOpacity={0.4}
        strokeWidth={1}
      />

      {/* Stair-step path */}
      <path
        d={buildStepPath(anchored)}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />

      {/* Dots at each step */}
      <g>
        {data.map((d, i) => {
          if (!dotIdxSet.has(i)) return null;
          const x = points[i][0];
          const y = points[i][1];
          const pnl = d.trade.pnlUsd ?? 0;
          const color = pnl >= 0 ? "var(--positive)" : "var(--negative)";
          return (
            <circle key={i} cx={x} cy={y} r={2.5} fill={color} />
          );
        })}
      </g>

      {/* Top-trade annotations */}
      <g>
        {topTrades.map((p) => {
          const i = data.indexOf(p);
          if (i < 0) return null;
          const x = points[i][0];
          const y = points[i][1];
          const labelY = y - 14;
          const scaledPnl = p.trade.pnlUsd * mirrorScale;
          const labelText = `${p.trade.ticker ?? p.trade.issuer} ${scaledPnl >= 0 ? "+" : "−"}${formatAxisDollar(Math.abs(scaledPnl))}`;
          return (
            <g key={i}>
              <line
                x1={x}
                x2={x}
                y1={y - 4}
                y2={labelY + 2}
                stroke="var(--accent)"
                strokeWidth={1}
              />
              <text
                x={x}
                y={labelY}
                textAnchor="middle"
                fontFamily="var(--font-serif), serif"
                fontSize={12}
                fill="var(--foreground)"
              >
                {labelText}
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
