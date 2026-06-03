// Sentry client SDK init. This file is picked up by `withSentryConfig` and
// bundled into every client entry point.
//
// No-DSN fallback: when `NEXT_PUBLIC_SENTRY_DSN` is unset, `Sentry.init` still
// runs cleanly (the SDK no-ops with an undefined DSN), and `beforeSend` returns
// `null` so even synthetic / boot-time events are dropped instead of buffered.
// This makes the wiring safe to ship before the DSN is configured in Vercel.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  beforeSend(event) {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return null;
    return event;
  },
});
