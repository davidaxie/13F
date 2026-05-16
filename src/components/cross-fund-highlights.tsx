import Link from "next/link";
import { getAllFundDiffs, type Move } from "@/lib/dashboard";
import { formatPct, formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function CrossFundHighlights() {
  const diffs = await getAllFundDiffs();
  const allMoves = diffs.flatMap((d) => d.moves);

  const newPositions = allMoves
    .filter((m) => m.type === "new")
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)
    .slice(0, 8);

  const exits = allMoves
    .filter((m) => m.type === "exited")
    .sort((a, b) => b.prevValueUsd - a.prevValueUsd)
    .slice(0, 8);

  const adds = allMoves
    .filter((m) => m.type === "added")
    .sort((a, b) => b.deltaUsd - a.deltaUsd)
    .slice(0, 8);

  const trims = allMoves
    .filter((m) => m.type === "trimmed")
    .sort((a, b) => a.deltaUsd - b.deltaUsd)
    .slice(0, 8);

  return (
    <div className="mt-12 space-y-12">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <MoveSection
          title="New positions"
          subtitle="Opened this quarter"
          moves={newPositions}
          tone="positive"
        />
        <MoveSection
          title="Exits"
          subtitle="Fully sold out"
          moves={exits}
          tone="negative"
        />
      </div>
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <MoveSection
          title="Biggest adds"
          subtitle="Largest dollar additions"
          moves={adds}
          tone="positive"
        />
        <MoveSection
          title="Biggest trims"
          subtitle="Largest dollar reductions"
          moves={trims}
          tone="negative"
        />
      </div>
    </div>
  );
}

function MoveSection({
  title,
  subtitle,
  moves,
  tone,
}: {
  title: string;
  subtitle: string;
  moves: Move[];
  tone: "positive" | "negative";
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <h3 className="font-serif text-xl text-foreground">{title}</h3>
        <span className="text-xs uppercase tracking-widest text-muted">
          {subtitle}
        </span>
      </div>
      {moves.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No data.</p>
      ) : (
        <ul className="divide-y divide-hairline/60">
          {moves.map((m, i) => (
            <li key={`${m.fundCik}-${m.cusip}-${m.titleOfClass}-${i}`}>
              <Link
                href={`/fund/${m.fundCik}/${m.filingAccession}`}
                className="group block py-3 transition-colors hover:bg-subtle/40"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-base leading-tight text-foreground transition-colors group-hover:text-accent">
                      {m.issuer}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      <span>{m.fundName}</span>
                      <span className="mx-1.5">·</span>
                      <span>{m.quarter}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn(
                        "tabular text-sm",
                        tone === "positive" ? "text-positive" : "text-negative",
                      )}
                    >
                      {tone === "positive" ? "+" : "−"}
                      {formatUSD(
                        Math.abs(
                          m.type === "exited"
                            ? m.prevValueUsd
                            : m.type === "new"
                              ? m.currentValueUsd
                              : m.deltaUsd,
                        ),
                        { compact: true },
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted tabular">
                      {m.type === "new" && "NEW"}
                      {m.type === "exited" && "EXITED"}
                      {(m.type === "added" || m.type === "trimmed") &&
                        m.deltaSharesPct != null &&
                        `${m.deltaSharesPct > 0 ? "+" : ""}${formatPct(m.deltaSharesPct, 0)}`}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
