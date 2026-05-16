import Link from "next/link";
import { SearchInput } from "@/components/search-input";
import { searchManagers } from "@/lib/edgar";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  let results: Awaited<ReturnType<typeof searchManagers>> = [];
  let error: string | null = null;
  if (query) {
    try {
      results = await searchManagers(query);
    } catch (e) {
      error = e instanceof Error ? e.message : "Unknown error";
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="mb-12">
        <SearchInput size="lg" initial={query} />
      </div>

      {!query && (
        <p className="text-muted">Enter a fund manager name to begin.</p>
      )}

      {query && error && (
        <p className="text-negative">
          Failed to fetch results from SEC EDGAR: {error}
        </p>
      )}

      {query && !error && results.length === 0 && (
        <p className="text-muted">
          No 13F filers matched <em className="font-serif">{query}</em>.
        </p>
      )}

      {query && results.length > 0 && (
        <>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              {results.length} {results.length === 1 ? "match" : "matches"}
            </h2>
            <span className="text-xs uppercase tracking-widest text-muted">
              for &ldquo;{query}&rdquo;
            </span>
          </div>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {results.map((r) => (
              <li key={r.cik}>
                <Link
                  href={`/fund/${r.cik}`}
                  className="group flex items-center justify-between py-5 transition-colors hover:bg-subtle/40"
                >
                  <div>
                    <div className="font-serif text-xl text-foreground transition-colors group-hover:text-accent">
                      {r.name || "Unknown"}
                    </div>
                    <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
                      CIK {r.cik}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted">
                    <div className="uppercase tracking-widest text-xs">
                      Last 13F
                    </div>
                    <div className="tabular mt-1 text-foreground/70">
                      {r.latestFilingDate
                        ? formatDate(r.latestFilingDate)
                        : "—"}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
