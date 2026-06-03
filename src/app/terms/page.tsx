import Link from "next/link";
import type { Metadata } from "next";
import {
  LegalContactBlock,
  LegalPage,
  LegalSection,
} from "@/components/legal-content";

const EFFECTIVE_DATE = "June 3, 2026";

export const metadata: Metadata = {
  title: "Terms of Service · 13F",
  description:
    "Terms governing use of mapperlab's 13F research platform — a free, personal-research tool. Not investment advice.",
};

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <p>
          These terms govern your use of the 13F research platform at{" "}
          <a
            href="https://13f.mapperlab.co"
            className="underline decoration-hairline underline-offset-2 hover:text-foreground"
          >
            13f.mapperlab.co
          </a>{" "}
          (the &ldquo;Service&rdquo;). By using the Service you agree to them.
          If you don&apos;t, please don&apos;t use the Service.
        </p>
      }
    >
      <LegalSection title="1. Acceptance and age">
        <p>
          You must be at least 13 years old to use the Service. If you&apos;re
          under 18, you confirm a parent or guardian has agreed to these terms
          on your behalf. Creating an account or signing in means you accept
          these terms and our{" "}
          <Link
            href="/privacy"
            className="underline decoration-hairline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. What the Service is">
        <p>
          The Service is a web-based research tool for exploring institutional
          fund holdings disclosed on SEC Form 13F, plus supplemental public
          data (Form 4 insider activity, 13D/G ownership, XBRL company
          fundamentals, and public price series). It is free to use. Signed-in
          users get cross-device sync of a watchlist and email alerts on
          tracked funds.
        </p>
        <p>
          The Service is published by mapperlab (&ldquo;we,&rdquo;
          &ldquo;our,&rdquo; &ldquo;us&rdquo;). Full methodology and data
          lineage live on{" "}
          <Link
            href="/about"
            className="underline decoration-hairline underline-offset-2 hover:text-foreground"
          >
            /about
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="3. Not investment advice">
        <p className="rounded border-l-2 border-accent/40 bg-subtle/30 px-6 py-5 text-base text-foreground/80">
          Nothing on this site is investment advice, a recommendation, a
          solicitation, or an offer to buy or sell any security. Everything
          here is for personal research and curiosity.
        </p>
        <p>
          Form 13F is filed up to 45 days after the end of a calendar quarter,
          so the holdings you see are <strong>historical and possibly stale</strong>.
          A fund may have already added to, trimmed, or exited a position by
          the time you see it. Backtest results displayed on the Service are{" "}
          <strong>hypothetical</strong>: they assume idealized fills, no
          transaction costs, no borrow costs, and no taxes, and they are not
          records of actual trading. Past performance does not predict future
          returns.
        </p>
        <p>
          You are solely responsible for your own investment decisions. Do
          your own work and, where appropriate, consult a licensed financial
          adviser, accountant, or attorney.
        </p>
      </LegalSection>

      <LegalSection title="4. Your account">
        <p>
          Authentication is handled by Clerk Inc. You&apos;re responsible for
          keeping your account credentials confidential and for activity that
          happens under your account. Let us know promptly if you suspect
          unauthorized access. We may suspend or terminate accounts that
          appear to be compromised, abusive, or used in violation of these
          terms.
        </p>
        <p>
          You can delete your account at any time through the Clerk user
          portal. See the{" "}
          <Link
            href="/privacy"
            className="underline decoration-hairline underline-offset-2 hover:text-foreground"
          >
            Privacy Policy
          </Link>{" "}
          for what we store and how to remove it.
        </p>
      </LegalSection>

      <LegalSection title="5. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Scrape, crawl, or systematically extract data from the Service
            outside of the human-facing UI, or place automated load on the
            Service that materially exceeds a normal interactive session;
          </li>
          <li>
            Reverse engineer, decompile, or attempt to derive non-public
            source code;
          </li>
          <li>
            Use the Service to send spam, harass, dox, or defame any person,
            or to generate or amplify misleading market information;
          </li>
          <li>
            Probe, scan, or attempt to breach the Service&apos;s security
            controls, or to access another user&apos;s data;
          </li>
          <li>
            Resell, sublicense, or commercially redistribute the Service or
            data extracted from it; or
          </li>
          <li>Use the Service in violation of any applicable law.</li>
        </ul>
        <p>
          We provide the Service free of charge today. If you build something
          that depends on it, you should expect that interfaces may change
          and that there is no service-level guarantee.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          mapperlab owns the Service&apos;s code, design, copy, and curated
          materials (such as the marquee fund list, methodology notes, and
          assembled backtest pages). You may view and link to public pages of
          the Service for personal, non-commercial purposes. You may not copy
          substantial portions of the Service&apos;s presentation, code, or
          curated content without our written permission.
        </p>
        <p>
          You own the inputs you provide: the watchlist items you star, the
          fund alerts you subscribe to, your email address, and any feedback
          you send us. By submitting feedback you grant us a non-exclusive
          right to use it to improve the Service.
        </p>
      </LegalSection>

      <LegalSection title="7. Third-party data and sources">
        <p>
          The Service surfaces information drawn from public data sources.
          These sources have their own terms, and we use them subject to
          those terms:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>SEC EDGAR</strong> (Form 13F, Form 4, 13D/G, 10-K, 10-Q):
            US government works, generally in the public domain. We attribute
            EDGAR on /about and link back to original filings where possible.
          </li>
          <li>
            <strong>SEC XBRL company facts</strong>: the same EDGAR
            companyconcept API used in EDGAR&apos;s own financial summaries.
          </li>
          <li>
            <strong>Yahoo Finance</strong>: daily price bars, used subject to
            Yahoo&apos;s terms.
          </li>
          <li>
            <strong>OpenFIGI (Bloomberg)</strong>: CUSIP-to-ticker mapping,
            used subject to OpenFIGI&apos;s terms.
          </li>
        </ul>
        <p>
          We don&apos;t guarantee these sources are complete, current, or
          error-free. Parser limits, vendor outages, and source-side
          revisions can all affect what appears on the Service. If you spot
          something wrong, please tell us.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimers and limitation of liability">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS
          OR IMPLIED, INCLUDING WITHOUT LIMITATION WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT,
          OR ACCURACY OF DATA. We don&apos;t warrant that the Service will be
          uninterrupted, error-free, or free of harmful components.
        </p>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, mapperlab and its
          contributors will not be liable for any indirect, incidental,
          special, consequential, or punitive damages, or any loss of
          profits, revenue, data, or goodwill, arising out of or related to
          your use of (or inability to use) the Service — including any
          investment decisions you make in reliance on information you find
          here. Our aggregate liability for any direct damages will not
          exceed one hundred US dollars (USD $100).
        </p>
        <p>
          Some jurisdictions don&apos;t allow the exclusion of certain
          warranties or the limitation of certain damages; in those
          jurisdictions our liability is limited to the smallest amount the
          law allows.
        </p>
      </LegalSection>

      <LegalSection title="9. Termination">
        <p>
          You may stop using the Service at any time and delete your account
          via the Clerk user portal. We may suspend or terminate access if
          you violate these terms, if continued access creates legal or
          security risk for the Service or other users, or if we discontinue
          the Service. Sections that by their nature should survive
          termination — intellectual property, disclaimers, limitation of
          liability, governing law — will survive.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to these terms">
        <p>
          We may update these terms from time to time. If we make a material
          change, we&apos;ll update the effective date at the top of this
          page and, where reasonable, notify signed-in users by email or via
          an in-product notice. Continued use of the Service after a change
          takes effect means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Governing law">
        <p>
          These terms are governed by the laws of the State of Delaware,
          USA, without regard to its conflict-of-laws rules. Any dispute
          arising out of or relating to these terms or the Service will be
          resolved exclusively in the state or federal courts located in
          Delaware, and you consent to the personal jurisdiction of those
          courts. The UN Convention on Contracts for the International Sale
          of Goods does not apply.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <LegalContactBlock />
      </LegalSection>
    </LegalPage>
  );
}
