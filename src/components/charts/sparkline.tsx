type Point = { v: number };

export function Sparkline({
  data,
  width = 200,
  height = 40,
  stroke,
  baselineAt0 = false,
}: {
  data: Point[];
  width?: number;
  height?: number;
  stroke?: string;
  baselineAt0?: boolean;
}) {
  if (data.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--hairline)"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const values = data.map((d) => d.v);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (baselineAt0) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (max === min) {
    max = min + 1;
  }
  const pad = (max - min) * 0.05;
  const ymin = min - pad;
  const ymax = max + pad;

  const xstep = width / (data.length - 1);
  const yScale = (v: number) =>
    height - ((v - ymin) / (ymax - ymin)) * height;

  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${(i * xstep).toFixed(1)},${yScale(d.v).toFixed(1)}`)
    .join(" ");

  const last = data[data.length - 1].v;
  const first = data[0].v;
  const positive = last >= first;
  const strokeColor =
    stroke ?? (positive ? "var(--positive)" : "var(--negative)");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
    >
      {baselineAt0 ? (
        <line
          x1={0}
          y1={yScale(0)}
          x2={width}
          y2={yScale(0)}
          stroke="var(--hairline)"
          strokeWidth={1}
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
