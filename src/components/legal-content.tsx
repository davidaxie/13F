import Link from "next/link";
import type { ReactNode } from "react";

type LegalPageProps = {
  kicker: string;
  title: string;
  effectiveDate: string;
  intro: ReactNode;
  children: ReactNode;
};

export function LegalPage({
  kicker,
  title,
  effectiveDate,
  intro,
  children,
}: LegalPageProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 max-w-3xl border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          {kicker}
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
          {title}
        </h1>
        <div className="mt-4 text-xs uppercase tracking-widest text-muted">
          Effective {effectiveDate}
        </div>
        <div className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          {intro}
        </div>
      </div>

      <div className="max-w-3xl">{children}</div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-serif text-2xl text-foreground">{title}</h2>
      <div className="mt-6 space-y-3 text-base leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export function LegalContactBlock() {
  return (
    <p>
      Questions? Email{" "}
      <a
        href="mailto:hello@mapperlab.co"
        className="underline decoration-hairline underline-offset-2 hover:text-foreground"
      >
        hello@mapperlab.co
      </a>
      . We try to answer within a few business days.
    </p>
  );
}
