import Link from "next/link";
import { notFound } from "next/navigation";
import { getFundInfo } from "@/lib/edgar";
import { formatDate, quarterLabel } from "@/lib/format";

export const revalidate = 3600;

export default async function FundPage({
  params,
}: {
  params: Promise<{ cik: string }>;
}) {
  const { cik } = await params;
  let fund: Awaited<ReturnType<typeof getFundInfo>>;
  try {
    fund = await getFundInfo(cik);
  } catch {
    notFound();
  }

  if (!fund.name) notFound();

  const latest = fund.filings[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link
        href="/"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Search
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <h1 className="font-serif text-5xl leading-tight tracking-tight text-foreground">
          {fund.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted">
          <span className="font-mono uppercase tracking-wider">
            CIK {fund.cik}
          </span>
          {fund.sicDescription && <span>{fund.sicDescription}</span>}
          <span>
            {fund.filings.length} 13F{" "}
            {fund.filings.length === 1 ? "filing" : "filings"} on record
          </span>
        </div>
      </div>

      {fund.filings.length === 0 ? (
        <p className="mt-12 text-muted">
          No 13F filings found for this entity in EDGAR&apos;s recent
          submissions.
        </p>
      ) : (
        <div className="mt-12">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-foreground">
              Quarterly filings
            </h2>
            {latest && (
              <Link
                href={`/fund/${fund.cik}/${latest.accessionNumber}`}
                className="text-sm text-accent transition-opacity hover:opacity-70"
              >
                Open latest →
              </Link>
            )}
          </div>

          <ul className="divide-y divide-hairline border-y border-hairline">
            {fund.filings.map((f) => (
              <li key={f.accessionNumber}>
                <Link
                  href={`/fund/${fund.cik}/${f.accessionNumber}`}
                  className="group grid grid-cols-[1fr_auto_auto] items-center gap-8 py-5 transition-colors hover:bg-subtle/40"
                >
                  <div>
                    <div className="font-serif text-2xl text-foreground transition-colors group-hover:text-accent">
                      {quarterLabel(f.reportDate)}
                    </div>
                    <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted">
                      {f.form} · {f.accessionNumber}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted">
                    <div className="uppercase tracking-widest text-xs">
                      Period
                    </div>
                    <div className="tabular mt-1 text-foreground/80">
                      {formatDate(f.reportDate)}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted">
                    <div className="uppercase tracking-widest text-xs">
                      Filed
                    </div>
                    <div className="tabular mt-1 text-foreground/80">
                      {formatDate(f.filingDate)}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
