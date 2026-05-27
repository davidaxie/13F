import Link from "next/link";
import { SearchInput } from "@/components/search-input";

const SUGGESTIONS = [
  { label: "Berkshire Hathaway", q: "berkshire hathaway" },
  { label: "Bridgewater Associates", q: "bridgewater" },
  { label: "Renaissance Technologies", q: "renaissance technologies" },
  { label: "Tiger Global", q: "tiger global" },
  { label: "Pershing Square", q: "pershing square" },
  { label: "Appaloosa", q: "appaloosa" },
];

const STOCK_SUGGESTIONS = [
  { label: "AAPL", t: "AAPL" },
  { label: "NVDA", t: "NVDA" },
  { label: "GOOGL", t: "GOOGL" },
  { label: "META", t: "META" },
];

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-2xl py-24">
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
          Holdings research,
          <br />
          <em className="font-serif italic text-accent">beautifully.</em>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
          Search any institutional fund manager and explore their 13F filings,
          quarter over quarter. Data sourced directly from SEC EDGAR.
        </p>

        <div className="mt-12">
          <SearchInput size="lg" autoFocus />
        </div>

        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span className="text-xs uppercase tracking-widest text-muted/70">
            Try
          </span>
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.q}
              href={`/search?q=${encodeURIComponent(s.q)}`}
              className="transition-colors hover:text-foreground"
            >
              {s.label}
            </Link>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span className="text-xs uppercase tracking-widest text-muted/70">
            or a stock
          </span>
          {STOCK_SUGGESTIONS.map((s) => (
            <Link
              key={s.t}
              href={`/stock/${s.t}`}
              className="font-mono transition-colors hover:text-foreground"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
