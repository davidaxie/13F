import type { RollingAlphaPoint } from "@/lib/risk-metrics";
import {
  buildLinePath,
  formatAxisPct,
  formatYear,
  makeScale,
  niceTicks,
  yearTicks,
} from "./chart-helpers";

const W = 880;
const H = 220;
const M = { top: 20, right: 30, bottom: 36, left: 70 };

export function RollingAlphaChart({ data }: { data: RollingAlphaPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="rounded border border-hairline px-6 py-12 text-center text-sm text-muted">
        Not enough data — need at least 1 year of equity curve to compute a
        rolling 1y alpha.
      </div>
    );
  }

  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xMin = new Date(data[0].date + "T00:00:00Z").getTime();
  const xMax = new Date(data[data.length - 1].date + "T00:00:00Z").getTime();
  const xScale = makeScale(xMin, xMax, M.left, M.left + plotW);

  // Symmetric range around 0 so the zero line sits in the middle.
  const maxAbs = Math.max(
    ...data.map((p) => Math.abs(p.excessReturnPct)),
    1,
  );
  const yMin = -maxAbs * 1.05;
  const yMax = maxAbs * 1.05;
  const yScale = makeScale(yMin, yMax, M.top + plotH, M.top);

  // Split path into positive / negative segments so we can color each side.
  // Easier approach: render two separate paths clipped by the zero line.
  // For simplicity here, render the whole line in a single color (foreground)
  // and stripe the zero-line band.
  const points: Array<[number, number]> = data.map((p) => [
    xScale(new Date(p.date + "T00:00:00Z").getTime()),
    yScale(p.excessReturnPct),
  ]);

  const yTicks = niceTicks(yMin, yMax, 4);
  const xTicks = yearTicks(data[0].date, data[data.length - 1].date);

  const avgAlpha =
    data.reduce((s, p) => s + p.excessReturnPct, 0) / data.length;
  const latest = data[data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      {/* Positive-region tint (subtle green) */}
      <rect
        x={M.left}
        y={M.top}
        width={plotW}
        height={yScale(0) - M.top}
        fill="var(--positive)"
        fillOpacity={0.04}
      />
      {/* Negative-region tint (subtle red) */}
      <rect
        x={M.left}
        y={yScale(0)}
        width={plotW}
        height={M.top + plotH - yScale(0)}
        fill="var(--negative)"
        fillOpacity={0.04}
      />

      {/* Y gridlines + labels */}
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
              {formatAxisPct(t)}
            </text>
          </g>
        ))}
      </g>

      {/* Zero line bolder */}
      <line
        x1={M.left}
        x2={M.left + plotW}
        y1={yScale(0)}
        y2={yScale(0)}
        stroke="var(--muted)"
        strokeOpacity={0.6}
        strokeWidth={1}
      />

      {/* Average alpha — horizontal dashed line */}
      <line
        x1={M.left}
        x2={M.left + plotW}
        y1={yScale(avgAlpha)}
        y2={yScale(avgAlpha)}
        stroke={avgAlpha >= 0 ? "var(--positive)" : "var(--negative)"}
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray="2 4"
      />
      <text
        x={M.left + plotW - 4}
        y={yScale(avgAlpha) - 4}
        textAnchor="end"
        fontFamily="var(--font-mono), monospace"
        fontSize={10}
        fill={avgAlpha >= 0 ? "var(--positive)" : "var(--negative)"}
      >
        avg {avgAlpha >= 0 ? "+" : ""}
        {avgAlpha.toFixed(1)}%
      </text>

      {/* Series line */}
      <path
        d={buildLinePath(points)}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Latest-point pin */}
      <g>
        <circle
          cx={points[points.length - 1][0]}
          cy={points[points.length - 1][1]}
          r={3}
          fill={latest.excessReturnPct >= 0 ? "var(--positive)" : "var(--negative)"}
        />
        <text
          x={points[points.length - 1][0] - 6}
          y={points[points.length - 1][1] - 6}
          textAnchor="end"
          fontFamily="var(--font-mono), monospace"
          fontSize={10}
          fill={latest.excessReturnPct >= 0 ? "var(--positive)" : "var(--negative)"}
        >
          now {latest.excessReturnPct >= 0 ? "+" : ""}
          {latest.excessReturnPct.toFixed(1)}%
        </text>
      </g>

      {/* X axis labels */}
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
