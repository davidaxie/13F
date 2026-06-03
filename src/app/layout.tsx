import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthButtons } from "@/components/auth-buttons";
import { MobileNav } from "@/components/mobile-nav";
import { NavDropdown } from "@/components/nav-dropdown";
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
              {/* Desktop nav — hidden below lg (1024px). 5 primary text
                  items + 2 grouping dropdowns (Funds / Backtest) + a
                  compact Watchlist star. Below lg the links collapse
                  into MobileNav (hamburger) on the right so the logo +
                  auth controls always have room. */}
              <nav
                className="hidden items-center gap-5 text-sm text-muted lg:flex"
                aria-label="Primary"
              >
                <Link
                  href="/dashboard"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Dashboard
                </Link>
                <Link
                  href="/consensus"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Consensus
                </Link>
                <Link
                  href="/entries"
                  className="whitespace-nowrap transition-colors hover:text-foreground"
                >
                  Entries
                </Link>
                <NavDropdown
                  label="Funds"
                  items={[
                    { href: "/universe", label: "Universe", sub: "All 27 tracked funds" },
                    { href: "/leaderboard", label: "Leaderboard", sub: "Ranked by mirror return" },
                    { href: "/compare", label: "Compare", sub: "Two-fund overlay" },
                  ]}
                />
                <NavDropdown
                  label="Backtest"
                  items={[
                    { href: "/backtest/follower", label: "Follower", sub: "Trade alongside the fund" },
                    { href: "/backtest/conviction", label: "Conviction", sub: "Buy & hold filtered" },
                  ]}
                />
              </nav>
              {/* Right cluster: Watchlist star (desktop) + auth (always)
                  + mobile hamburger (below lg). whitespace-nowrap on
                  the auth wrapper prevents Sign in / Sign up word-breaks. */}
              <div className="flex items-center gap-2 whitespace-nowrap sm:gap-3">
                <Link
                  href="/watchlist"
                  aria-label="Watchlist"
                  className="hidden h-8 w-8 items-center justify-center rounded text-muted transition-colors hover:text-foreground lg:inline-flex"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="12 2 15 8.5 22 9.3 17 14 18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5" />
                  </svg>
                </Link>
                <span className="flex items-center gap-2 lg:border-l lg:border-hairline lg:pl-4">
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
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-xs text-muted sm:px-6">
              <span>Data sourced directly from SEC EDGAR.</span>
              <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link
                  href="/about"
                  className="transition-colors hover:text-foreground"
                >
                  About &amp; methodology
                </Link>
                <a
                  href="https://www.sec.gov/divisions/investment/13ffaq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  About 13F (SEC)
                </a>
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
