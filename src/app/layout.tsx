import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthButtons } from "@/components/auth-buttons";
import { MobileNav } from "@/components/mobile-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "13F — Holdings research",
  description:
    "Elegant research tool for SEC Form 13F filings — track institutional fund holdings, quarter over quarter.",
  icons: {
    // Default: keep the existing src/app/favicon.ico (Next.js auto-serves it)
    // as the fallback for older browsers; add the SVG variants for modern
    // ones. Browsers prefer SVG when both are present.
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          {/* Skip-to-content link for keyboard / screen-reader users — visible
              only on focus, jumps past the site nav. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:border focus:border-foreground focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground"
          >
            Skip to content
          </a>
          <header className="relative border-b border-hairline">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
              <Link
                href="/"
                className="font-serif text-2xl tracking-tight text-foreground"
                aria-label="13F home"
              >
                13F<span className="text-accent">.</span>
              </Link>
              {/* Desktop nav — hidden below xl (1280px). Below that, the
                  links go into MobileNav (hamburger) on the right so the
                  logo + auth controls never get word-wrapped. */}
              <nav
                className="hidden items-center gap-5 text-sm text-muted xl:flex"
                aria-label="Primary"
              >
                <Link
                  href="/"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Search
                </Link>
                <Link
                  href="/dashboard"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/entries"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Entries
                </Link>
                <Link
                  href="/consensus"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Consensus
                </Link>
                <Link
                  href="/universe"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Universe
                </Link>
                <Link
                  href="/leaderboard"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/compare"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Compare
                </Link>
                <Link
                  href="/backtest/follower"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Follower
                </Link>
                <Link
                  href="/backtest/conviction"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Conviction
                </Link>
                <Link
                  href="/watchlist"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                  aria-label="My watchlist"
                >
                  Following
                </Link>
              </nav>
              {/* Right cluster: auth (always visible) + mobile hamburger
                  (visible below xl). whitespace-nowrap on the auth wrapper
                  prevents the Sign in / Sign up buttons from word-breaking
                  when the row is tight. */}
              <div className="flex items-center gap-2 whitespace-nowrap sm:gap-3">
                <span className="flex items-center gap-2 xl:border-l xl:border-hairline xl:pl-4">
                  <AuthButtons />
                </span>
                <MobileNav />
              </div>
            </div>
          </header>
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <footer className="border-t border-hairline">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-muted">
              <span>Data sourced directly from SEC EDGAR.</span>
              <span className="flex items-center gap-5">
                <Link
                  href="/about"
                  className="transition-colors hover:text-foreground"
                >
                  About &amp; methodology
                </Link>
                <span>
                  Built for personal research. Not investment advice.
                </span>
              </span>
            </div>
          </footer>
        </ClerkProvider>
      </body>
    </html>
  );
}
