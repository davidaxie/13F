import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Permissive starter CSP. We rely on inline styles in a handful of places
// (font-loading helpers, the global-error fallback), and Next's RSC payload
// + dev runtime both expect 'unsafe-inline' / 'unsafe-eval' in places. Tighten
// later by enumerating real sources (Clerk, Vercel KV, SEC iframe targets,
// Google Fonts) and dropping unsafe-* once we audit each inline use.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://data.sec.gov https://www.sec.gov",
  "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  typescript: {
    // The in-build `tsc` pass was ~85s of every Vercel build (the single
    // biggest step). We run `tsc --noEmit` locally before every push, so the
    // build-time type-check is redundant — skipping it cuts ~85s off each
    // deploy. Tradeoff: a push that bypassed the local check could ship a type
    // error, so the discipline of running tsc locally before pushing stays.
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        // Apply to every route. The route handlers (sitemap.xml,
        // robots.txt) don't need a CSP since they aren't HTML, but it
        // does no harm to set them too.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

// Sentry source-map upload is keyed off `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` +
// `SENTRY_PROJECT`. Without them the build still succeeds; the plugin just
// skips uploading source maps and prints a one-line notice. `silent: true`
// and `disableLogger: true` keep the build output clean in that case.
//
// Note: the `hideSourceMaps` option that older Sentry SDKs took was removed
// in @sentry/nextjs v10. The same effect — keep uploaded source maps out of
// the public build output — is now the default behaviour of
// `sourcemaps.deleteSourcemapsAfterUpload: true`, so we don't need a flag.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  disableLogger: true,
});
