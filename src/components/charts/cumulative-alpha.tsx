import type { RealizedPoint } from "@/lib/follower-backtest";
import {
  buildLinePath,
  formatAxisDollar,
  formatYear,
  makeScale,
  niceTicks,
  yearTicks,
} from "./chart-helpers";

const W = 880;
const H = 360;
const M = { top: 30, right: 30, bottom: 36, left: 90 };

export function CumulativeAlphaChart({ data }: { data: RealizedPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="rounded border border-hairline px-6 py-12 text-center text-sm text-muted">
        Not enough closed signals to draw the curve.
      </div>
    );
  }

  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xMin = new Date(data[0].date + "T00:00:00Z").getTime();
  const xMax = new Date(data[data.length - 1].date + "T00:00:00Z").getTime();
  const xScale = makeScale(xMin, xMax, M.left, M.left + plotW);

  const allVals = data.flatMap((d) => [
    d.cumulativeFollowerPnlUsd,
    d.cumulativeSpyPnlUsd,
  ]);
  let yMin = Math.min(0, ...allVals);
  let yMax = Math.max(0, ...allVals);
  if (yMin === yMax) yMax = yMin + 1;
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;
  const yScale = makeScale(yMin, yMax, M.top + plotH, M.top);

  const followerPoints: Array<[number, number]> = data.map((d) => [
    xScale(new Date(d.date + "T00:00:00Z").getTime()),
    yScale(d.cumulativeFollowerPnlUsd),
  ]);
  const spyPoints: Array<[number, number]> = data.map((d) => [
    xScale(new Date(d.date + "T00:00:00Z").getTime()),
    yScale(d.cumulativeSpyPnlUsd),
  ]);

  const yTicks = niceTicks(yMin, yMax, 6);
  const xTicks = yearTicks(data[0].date, data[data.length - 1].date);

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
              {formatAxisDollar(t)}
            </text>
          </g>
        ))}
      </g>

      <path
        d={buildLinePath(spyPoints)}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.25}
        strokeDasharray="4 4"
      />
      <path
        d={buildLinePath(followerPoints)}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />

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
