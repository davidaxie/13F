import Link from "next/link";
import type { Metadata } from "next";
import {
  LegalContactBlock,
  LegalPage,
  LegalSection,
} from "@/components/legal-content";

const EFFECTIVE_DATE = "June 3, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy · 13F",
  description:
    "What mapperlab collects, who we share it with (Clerk, Vercel, Resend), and what we never do. No ads, no tracking pixels, no data sale.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Privacy Policy"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <p>
          We try to collect as little as possible and to be specific about
          what we do collect, who processes it, and what we never do with it.
          This policy covers{" "}
          <a
            href="https://13f.mapperlab.co"
            className="underline decoration-hairline underline-offset-2 hover:text-foreground"
          >
            13f.mapperlab.co
          </a>{" "}
          (the &ldquo;Service&rdquo;).
        </p>
      }
    >
      <LegalSection title="1. Effective date">
        <p>
          This policy is effective {EFFECTIVE_DATE}. If we make material
          changes we&apos;ll update this date and, where reasonable, notify
          signed-in users.
        </p>
      </LegalSection>

      <LegalSection title="2. What we collect">
        <p>The Service collects only what it needs to function:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Email address</strong> — required for sign-in (via Clerk)
            and used as the destination for any fund alerts you subscribe to.
            We also store it in Vercel KV to drive the alerts pipeline.
          </li>
          <li>
            <strong>Display name (optional)</strong> — only if you set one in
            your Clerk profile.
          </li>
          <li>
            <strong>IP address and basic request metadata</strong> — captured
            by Vercel&apos;s server logs (origin IP, user agent, requested
            path, timestamp) for security, abuse prevention, and debugging.
            Vercel rotates these logs on its own retention schedule.
          </li>
          <li>
            <strong>Authentication cookies</strong> — set by Clerk to keep
            you signed in. We do not set additional analytics or advertising
            cookies.
          </li>
          <li>
            <strong>Your watchlist</strong> — the fund CIKs and stock tickers
            you star, stored in Vercel KV under your user ID so we can sync
            them across your devices.
          </li>
          <li>
            <strong>Your alert subscriptions</strong> — the fund CIKs
            you&apos;ve asked to receive emails about, stored in Vercel KV
            together with your email so the alerts cron can deliver them.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> currently collect any payment
          information — the Service is free today. If we add paid features
          later we will update this policy and route payment data through a
          regulated processor.
        </p>
      </LegalSection>

      <LegalSection title="3. How we use it">
        <p>The data above is used only for:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Authentication</strong> — verifying your identity and
            keeping you signed in across devices (Clerk).
          </li>
          <li>
            <strong>Service features</strong> — persisting your watchlist
            and alert preferences, and rendering personalized views like{" "}
            <Link
              href="/watchlist"
              className="underline decoration-hairline underline-offset-2 hover:text-foreground"
            >
              /watchlist
            </Link>
            .
          </li>
          <li>
            <strong>Email alerts</strong> — delivering the fund updates you
            subscribed to, via Resend, with a one-click unsubscribe link in
            every message.
          </li>
          <li>
            <strong>Security, abuse prevention, and debugging</strong> — for
            example, investigating an error in server logs or rate-limiting
            abusive traffic.
          </li>
        </ul>
        <p>
          We don&apos;t profile you for advertising, sell your data, or use
          it to train third-party machine-learning models.
        </p>
      </LegalSection>

      <LegalSection title="4. Who we share it with">
        <p>
          The Service is built on a small set of named processors. We share
          only what each one needs to do its job:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Clerk Inc.</strong> — authentication. Receives your
            email, optional display name, and session activity. See{" "}
            <a
              href="https://clerk.com/legal/privacy"
              className="underline decoration-hairline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              clerk.com privacy policy
            </a>
            .
          </li>
          <li>
            <strong>Vercel Inc.</strong> — hosting (Next.js runtime), edge
            network, and Vercel KV for your watchlist and alert
            subscriptions. Receives your IP address, request logs, and the
            stored watchlist/alert records. See{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              className="underline decoration-hairline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              vercel.com privacy policy
            </a>
            .
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery for fund
            alerts. Receives your email address, the subject and body of
            each alert, and standard delivery metadata. See{" "}
            <a
              href="https://resend.com/legal/privacy-policy"
              className="underline decoration-hairline underline-offset-2 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              resend.com privacy policy
            </a>
            .
          </li>
        </ul>
        <p>
          We may also disclose information when required by law (subpoena,
          court order, regulatory request) or when necessary to investigate
          or prevent abuse, fraud, or imminent harm. If we ever sell the
          business or merge with another company, your data may transfer to
          the acquirer subject to a privacy policy at least as protective as
          this one.
        </p>
        <p>
          We fetch from SEC EDGAR and other public data sources; those
          sources receive normal server-to-server request metadata
          (originating from our infrastructure, not from your browser) and
          no information about you.
        </p>
      </LegalSection>

      <LegalSection title="5. What we don't do">
        <p>
          We don&apos;t sell your data. We don&apos;t share it with data
          brokers. We don&apos;t run advertising on the Service and we
          don&apos;t embed third-party advertising or analytics tags. There
          are no Facebook pixels, no Google Analytics, no LinkedIn Insight
          tags, no session-replay scripts.
        </p>
        <p>
          We don&apos;t use your data to train third-party AI models, and we
          don&apos;t share your watchlist with other users.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies">
        <p>
          The only cookies the Service sets are the session cookies Clerk
          uses to keep you signed in. They are first-party, secure, and
          expire when your Clerk session ends. We don&apos;t use
          advertising, analytics, or cross-site tracking cookies. Because
          there are no such cookies, the Service does not display a cookie
          consent banner; the Clerk session cookies are strictly necessary
          for authentication and do not require consent under typical
          EU/UK rules.
        </p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>You can exercise the following at any time:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Delete your account.</strong> Use the Clerk user portal
            to delete your account; doing so removes your authentication
            record at Clerk and triggers deletion of your watchlist and
            alert records in Vercel KV.
          </li>
          <li>
            <strong>Export your watchlist.</strong> The{" "}
            <Link
              href="/watchlist"
              className="underline decoration-hairline underline-offset-2 hover:text-foreground"
            >
              /watchlist
            </Link>{" "}
            page shows your full watchlist; you can copy it or take a
            screenshot at any time.
          </li>
          <li>
            <strong>Unsubscribe from email.</strong> Every alert email
            includes a one-click unsubscribe link. You can also remove
            individual fund alerts from your watchlist UI.
          </li>
          <li>
            <strong>Access, correct, or restrict processing.</strong> Email
            us and we&apos;ll respond. If you&apos;re in the EU, UK,
            California, or another jurisdiction with statutory data-subject
            rights (GDPR / UK GDPR / CCPA / CPRA), the same address handles
            those requests. We don&apos;t discriminate against users who
            exercise privacy rights.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Data retention">
        <p>
          We keep account data for as long as your account exists. When you
          delete your account, the corresponding records in Vercel KV
          (watchlist, alert subscriptions, alert dispatch history) are
          removed; certain alerts records carry a Vercel KV time-to-live and
          expire automatically on that schedule even before deletion. Server
          logs (IP address, request paths) are retained on Vercel&apos;s
          standard rotation and are not associated with your user ID after
          deletion. Resend retains delivery records on its own rotation,
          which we do not control.
        </p>
        <p>
          We may retain anonymized or aggregated data (counts, error rates)
          indefinitely; that data cannot be tied back to you.
        </p>
      </LegalSection>

      <LegalSection title="9. Children">
        <p>
          The Service is not intended for children under 13, and we don&apos;t
          knowingly collect personal information from anyone under 13. If
          you believe a child has provided us with personal information,
          please contact us and we&apos;ll delete it.
        </p>
      </LegalSection>

      <LegalSection title="10. International users">
        <p>
          The Service is operated from the United States. Our primary Vercel
          region is <code className="rounded bg-subtle px-1 py-0.5 font-mono text-[11px] text-foreground/80">iad1</code>{" "}
          (US East). If you access the Service from outside the US, your
          information will be transferred to, stored, and processed in the
          US (and may transit other regions through Vercel&apos;s edge
          network). By using the Service you consent to that transfer.
        </p>
        <p>
          Our subprocessors (Clerk, Vercel, Resend) are US-based companies
          that operate global infrastructure; consult their privacy policies
          for the data-transfer mechanisms they rely on.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We&apos;ll update this policy when our practices change. For
          material changes we&apos;ll update the effective date at the top
          and, where reasonable, notify signed-in users by email or via an
          in-product notice before the change takes effect.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <LegalContactBlock />
        <p>
          For the legal framework around use of the Service, see our{" "}
          <Link
            href="/terms"
            className="underline decoration-hairline underline-offset-2 hover:text-foreground"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
