// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same runtime, same
// matcher API, friendlier name). Clerk's `clerkMiddleware()` factory is the
// canonical way to thread Clerk's auth context through every request — it
// validates session cookies, populates the auth() context for server
// components and route handlers, and serves Clerk's auto-proxy endpoints.
//
// We don't gate routes here (no auth.protect() calls). Every page stays
// publicly reachable; sign-in only unlocks the watchlist sync and email
// alerts. Move gates here when we want to lock specific routes.

import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals + any path that ends in a static file
    // extension (images, fonts, etc.). The negative lookahead keeps proxy
    // overhead off requests it has no business inspecting.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path — Clerk uses /__clerk/* for
    // OAuth callbacks, frontend API calls, etc. Required.
    "/__clerk/(.*)",
    // Run on API + tRPC routes for auth context in route handlers.
    "/(api|trpc)(.*)",
  ],
};
