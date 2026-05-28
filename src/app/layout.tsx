import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthButtons } from "@/components/auth-buttons";
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
          <header className="border-b border-hairline">
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
              <Link
                href="/"
                className="font-serif text-2xl tracking-tight text-foreground"
                aria-label="13F home"
              >
                13F<span className="text-accent">.</span>
              </Link>
              <nav
                className="flex items-center gap-6 text-sm text-muted"
                aria-label="Primary"
              >
                <Link
                  href="/"
                  className="transition-colors hover:text-foreground"
                >
                  Search
                </Link>
                <Link
                  href="/dashboard"
                  className="transition-colors hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/universe"
                  className="transition-colors hover:text-foreground"
                >
                  Universe
                </Link>
                <Link
                  href="/consensus"
                  className="transition-colors hover:text-foreground"
                >
                  Consensus
                </Link>
                <Link
                  href="/compare"
                  className="transition-colors hover:text-foreground"
                >
                  Compare
                </Link>
                <Link
                  href="/leaderboard"
                  className="transition-colors hover:text-foreground"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/backtest/follower"
                  className="transition-colors hover:text-foreground"
                >
                  Follower
                </Link>
                <Link
                  href="/backtest/conviction"
                  className="transition-colors hover:text-foreground"
                >
                  Conviction
                </Link>
                <Link
                  href="/watchlist"
                  className="transition-colors hover:text-foreground"
                  aria-label="My watchlist"
                >
                  Following
                </Link>
                <a
                  href="https://www.sec.gov/divisions/investment/13ffaq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  About 13F
                </a>
                {/* Auth controls — moved into a client component so static-
                    prerendered routes don't crash on Clerk's server-side
                    auth() call. See src/components/auth-buttons.tsx. */}
                <span className="flex items-center gap-2 border-l border-hairline pl-4">
                  <AuthButtons />
                </span>
              </nav>
            </div>
          </header>
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <footer className="border-t border-hairline">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted">
              <span>Data sourced directly from SEC EDGAR.</span>
              <span>
                Built for personal research. Not investment advice.
              </span>
            </div>
          </footer>
        </ClerkProvider>
      </body>
    </html>
  );
}
