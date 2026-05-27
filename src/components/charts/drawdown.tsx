import type { EquityCurvePoint } from "@/lib/backtest";
import {
  buildAreaPath,
  buildLinePath,
  formatAxisPct,
  formatYear,
  makeScale,
  niceTicks,
  yearTicks,
} from "./chart-helpers";

const W = 880;
const H = 200;
const M = { top: 18, right: 30, bottom: 36, left: 70 };

export function DrawdownChart({ data }: { data: EquityCurvePoint[] }) {
  if (data.length < 2) {
    return (
      <div className="rounded border border-hairline px-6 py-12 text-center text-sm text-muted">
        Not enough data to draw the drawdown curve.
      </div>
    );
  }

  // Build the underwater series: at each sample, (mirror - running_peak) / peak.
  let peak = data[0].mirror;
  const dds: number[] = [];
  for (const p of data) {
    if (p.mirror > peak) peak = p.mirror;
    const dd = peak > 0 ? (p.mirror - peak) / peak : 0;
    dds.push(dd * 100); // percent
  }

  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xMin = new Date(data[0].date + "T00:00:00Z").getTime();
  const xMax = new Date(data[data.length - 1].date + "T00:00:00Z").getTime();
  const xScale = makeScale(xMin, xMax, M.left, M.left + plotW);

  // y-axis: 0 at the top (best), most negative DD at the bottom.
  const minDD = Math.min(...dds, -1); // ensure a small floor so flat-zero curves still render
  const yMin = minDD * 1.05;
  const yMax = 0;
  const yScale = makeScale(yMin, yMax, M.top + plotH, M.top);

  const points: Array<[number, number]> = data.map((d, i) => [
    xScale(new Date(d.date + "T00:00:00Z").getTime()),
    yScale(dds[i]),
  ]);

  const yTicks = niceTicks(yMin, yMax, 4);
  const xTicks = yearTicks(data[0].date, data[data.length - 1].date);

  // Find trough for the annotation pin.
  let troughIdx = 0;
  for (let i = 1; i < dds.length; i++) {
    if (dds[i] < dds[troughIdx]) troughIdx = i;
  }
  const troughDd = dds[troughIdx];
  const troughX = points[troughIdx][0];
  const troughY = points[troughIdx][1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      {/* Y gridlines + labels (percentages) */}
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
        strokeOpacity={0.5}
        strokeWidth={1}
      />

      {/* Underwater area + line */}
      <path
        d={buildAreaPath(points, yScale(0))}
        fill="var(--negative)"
        fillOpacity={0.15}
      />
      <path
        d={buildLinePath(points)}
        fill="none"
        stroke="var(--negative)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Trough annotation */}
      {troughDd < -1 && (
        <g>
          <circle
            cx={troughX}
            cy={troughY}
            r={3}
            fill="var(--negative)"
          />
          <text
            x={troughX}
            y={troughY + 14}
            textAnchor="middle"
            fontFamily="var(--font-mono), monospace"
            fontSize={10}
            fill="var(--negative)"
          >
            {troughDd.toFixed(1)}%
          </text>
        </g>
      )}

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
