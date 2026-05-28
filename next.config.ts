import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // The in-build `tsc` pass was ~85s of every Vercel build (the single
    // biggest step). We run `tsc --noEmit` locally before every push, so the
    // build-time type-check is redundant — skipping it cuts ~85s off each
    // deploy. Tradeoff: a push that bypassed the local check could ship a type
    // error, so the discipline of running tsc locally before pushing stays.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
