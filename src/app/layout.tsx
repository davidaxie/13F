import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
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
        <header className="border-b border-hairline">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <Link
              href="/"
              className="font-serif text-2xl tracking-tight text-foreground"
            >
              13F<span className="text-accent">.</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted">
              <Link
                href="/"
                className="transition-colors hover:text-foreground"
              >
                Search
              </Link>
              <a
                href="https://www.sec.gov/divisions/investment/13ffaq"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                About 13F
              </a>
            </nav>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
        <footer className="border-t border-hairline">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted">
            <span>Data sourced directly from SEC EDGAR.</span>
            <span>
              Built for personal research. Not investment advice.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
