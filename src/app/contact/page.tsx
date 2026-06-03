import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact · 13F",
  description:
    "Email addresses for general support, data corrections, and press / partnership inquiries.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/dashboard"
        className="text-xs uppercase tracking-widest text-muted transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-4 border-b border-hairline pb-10">
        <div className="text-xs uppercase tracking-widest text-muted">
          Contact
        </div>
        <h1 className="mt-2 font-serif text-5xl leading-tight tracking-tight text-foreground sm:text-6xl">
          Contact
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted">
          Questions, bug reports, data corrections, partnership inquiries — all
          go here.
        </p>
      </div>

      <div className="mt-12 space-y-4">
        <ContactCard
          label="General"
          email="support@mapperlab.co"
          description="Anything that doesn't fit the categories below — questions about the platform, feedback, feature requests."
        />
        <ContactCard
          label="Data issues"
          email="data@mapperlab.co"
          description="Spotted a wrong number, missing ticker, or off snapshot date? Email this with the URL and what you saw."
        />
        <ContactCard
          label="Press / partnerships"
          email="hello@mapperlab.co"
          description="Press inquiries, partnership conversations, anything commercial."
        />
      </div>

      <p className="mt-12 text-sm leading-relaxed text-muted">
        Typical response time: 1–2 business days.
      </p>
    </div>
  );
}

function ContactCard({
  label,
  email,
  description,
}: {
  label: string;
  email: string;
  description: string;
}) {
  return (
    <section className="rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5">
      <div className="text-[10px] uppercase tracking-widest text-foreground/70">
        {label}
      </div>
      <a
        href={`mailto:${email}`}
        className="mt-2 inline-block font-mono text-sm text-foreground underline decoration-hairline underline-offset-2 hover:text-accent"
      >
        {email}
      </a>
      <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
    </section>
  );
}
