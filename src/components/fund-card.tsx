import Link from "next/link";
import { getFundDiff, type Move } from "@/lib/dashboard";
import { formatPct, formatUSD, quarterLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function FundCard({
  cik,
  displayName,
}: {
  cik: string;
  displayName: string;
}) {
  const diff = await getFundDiff(cik, displayName);
  if (!diff) {
    return (
      <article className="opacity-60">
        <div className="font-serif text-2xl text-foreground">{displayName}</div>
        <div className="mt-2 text-xs text-muted">
          No 13F data currently available
        </div>
      </article>
    );
  }

  const totalChangePct =
    diff.totalValuePrevUsd > 0
      ? ((diff.totalValueCurrentUsd - diff.totalValuePrevUsd) /
          diff.totalValuePrevUsd) *
        100
      : null;

  const newest = topByValue(diff.moves, "new").slice(0, 2);
  const exits = topByValue(diff.moves, "exited").slice(0, 2);
  const adds = topByDeltaAbs(diff.moves, "added").slice(0, 2);
  const trims = topByDeltaAbs(diff.moves, "trimmed").slice(0, 2);

  return (
    <article>
      <Link
        href={`/fund/${cik}/${diff.latest.accessionNumber}`}
        className="group"
      >
        <div className="font-serif text-2xl text-foreground transition-colors group-hover:text-accent">
          {displayName}
        </div>
      </Link>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span>{quarterLabel(diff.latest.reportDate)}</span>
        <span>·</span>
        <span className="tabular">
          {diff.positionsCurrent.toLocaleString()} positions
        </span>
        <span>·</span>
        <span className="tabular">
          {formatUSD(diff.totalValueCurrentUsd, { compact: true })}
        </span>
        {totalChangePct !== null && (
          <>
            <span>·</span>
            <span
              className={cn(
                "tabular",
                totalChangePct >= 0 ? "text-positive" : "text-negative",
              )}
            >
              {totalChangePct >= 0 ? "+" : ""}
              {formatPct(totalChangePct, 1)} QoQ
            </span>
          </>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
        <MoveList label="New" moves={newest} valueOf={(m) => m.currentValueUsd} />
        <MoveList
          label="Exited"
          moves={exits}
          valueOf={(m) => m.prevValueUsd}
          negative
        />
        <MoveList
          label="Added"
          moves={adds}
          valueOf={(m) => Math.abs(m.deltaUsd)}
        />
        <MoveList
          label="Trimmed"
          moves={trims}
          valueOf={(m) => Math.abs(m.deltaUsd)}
          negative
        />
      </div>
    </article>
  );
}

function MoveList({
  label,
  moves,
  valueOf,
  negative,
}: {
  label: string;
  moves: Move[];
  valueOf: (m: Move) => number;
  negative?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-muted">{label}</div>
      {moves.length === 0 ? (
        <div className="mt-1.5 text-sm text-muted">—</div>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {moves.map((m, i) => (
            <li
              key={`${m.cusip}-${m.titleOfClass}-${i}`}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="truncate text-foreground">{m.issuer}</span>
              <span
                className={cn(
                  "shrink-0 tabular text-xs",
                  negative ? "text-negative" : "text-positive",
                )}
              >
                {negative ? "−" : "+"}
                {formatUSD(valueOf(m), { compact: true })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function topByValue(moves: Move[], type: Move["type"]): Move[] {
  return moves
    .filter((m) => m.type === type)
    .sort((a, b) => {
      const av = type === "exited" ? a.prevValueUsd : a.currentValueUsd;
      const bv = type === "exited" ? b.prevValueUsd : b.currentValueUsd;
      return bv - av;
    });
}

function topByDeltaAbs(moves: Move[], type: Move["type"]): Move[] {
  return moves
    .filter((m) => m.type === type)
    .sort((a, b) => Math.abs(b.deltaUsd) - Math.abs(a.deltaUsd));
}
