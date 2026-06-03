// Sentry server SDK init (Node runtime). Loaded by `instrumentation.ts` when
// `NEXT_RUNTIME === "nodejs"`. Without a DSN the SDK no-ops, so this stays
// safe to ship before the env var is configured in Vercel.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
