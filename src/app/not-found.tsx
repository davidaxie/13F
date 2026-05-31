import Link from "next/link";
import type { Metadata } from "next";
import { SearchInput } from "@/components/search-input";

// Per Next 16 file conventions, this lives at app/not-found.tsx and is
// rendered whenever a route or page calls notFound() or no route matches.
// Server component — it just renders static markup, no data fetches.

export const metadata: Metadata = {
  title: "Not found — 13F",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-24">
      <div className="text-xs uppercase tracking-widest text-muted">
        404
      </div>
      <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
        Not found.
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
        We don&apos;t have a page for this URL. The fund or stock may not be in
        our snapshot universe, or the link may be stale.
      </p>

      <div className="mt-12">
        <SearchInput size="lg" />
      </div>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <Link
          href="/dashboard"
          className="border-b border-hairline pb-0.5 transition-colors hover:border-foreground hover:text-foreground"
        >
          Dashboard
        </Link>
        <Link
          href="/consensus"
          className="border-b border-hairline pb-0.5 transition-colors hover:border-foreground hover:text-foreground"
        >
          Consensus
        </Link>
        <Link
          href="/universe"
          className="border-b border-hairline pb-0.5 transition-colors hover:border-foreground hover:text-foreground"
        >
          Universe
        </Link>
        <Link
          href="/"
          className="border-b border-hairline pb-0.5 transition-colors hover:border-foreground hover:text-foreground"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
