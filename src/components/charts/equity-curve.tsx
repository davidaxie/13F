import type { EquityCurvePoint } from "@/lib/backtest";
import {
  buildAreaPath,
  buildLinePath,
  formatAxisDollar,
  formatYear,
  makeScale,
  niceTicks,
  yearTicks,
} from "./chart-helpers";

const W = 880;
const H = 360;
const M = { top: 30, right: 30, bottom: 36, left: 70 };

export function EquityCurveChart({
  data,
  startingCash,
}: {
  data: EquityCurvePoint[];
  startingCash: number;
}) {
  if (data.length < 2) {
    return (
      <div className="rounded border border-hairline px-6 py-12 text-center text-sm text-muted">
        Not enough data to draw the equity curve.
      </div>
    );
  }

  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xMin = new Date(data[0].date + "T00:00:00Z").getTime();
  const xMax = new Date(data[data.length - 1].date + "T00:00:00Z").getTime();
  const xScale = makeScale(xMin, xMax, M.left, M.left + plotW);

  const allVals = data.flatMap((d) => [d.mirror, d.spy]);
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  yMin = Math.min(yMin, startingCash);
  const yPad = (yMax - yMin) * 0.08;
  yMin = yMin - yPad;
  yMax = yMax + yPad;
  const yScale = makeScale(yMin, yMax, M.top + plotH, M.top);

  const mirrorPoints: Array<[number, number]> = data.map((d) => [
    xScale(new Date(d.date + "T00:00:00Z").getTime()),
    yScale(d.mirror),
  ]);
  const spyPoints: Array<[number, number]> = data.map((d) => [
    xScale(new Date(d.date + "T00:00:00Z").getTime()),
    yScale(d.spy),
  ]);

  const yTicks = niceTicks(yMin, yMax, 5);
  const xTicks = yearTicks(data[0].date, data[data.length - 1].date);

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

      {/* Baseline (starting cash) */}
      <line
        x1={M.left}
        x2={M.left + plotW}
        y1={yScale(startingCash)}
        y2={yScale(startingCash)}
        stroke="var(--muted)"
        strokeOpacity={0.3}
        strokeDasharray="2 3"
        strokeWidth={1}
      />

      {/* SPY (dashed) */}
      <path
        d={buildLinePath(spyPoints)}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.25}
        strokeDasharray="4 4"
      />

      {/* Mirror — area + line */}
      <path
        d={buildAreaPath(mirrorPoints, yScale(yMin))}
        fill="var(--foreground)"
        fillOpacity={0.04}
      />
      <path
        d={buildLinePath(mirrorPoints)}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />

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
