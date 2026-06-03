"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";

/**
 * Header-bar auth controls. Client component on purpose: Clerk's server-side
 * `<Show>` calls `auth()` during render, which breaks static-prerendered
 * routes (every backtest page, /consensus, /universe, /stock/*, /watchlist)
 * because there's no request context at SSG time. The `useAuth()` hook
 * resolves entirely client-side from ClerkProvider's hydrated state, so
 * static pages keep their SSG-perf benefit and the auth UI hydrates after.
 */
export function AuthButtons() {
  const { isLoaded, isSignedIn } = useAuth();

  // Avoid layout flash by reserving the avatar width before Clerk hydrates.
  if (!isLoaded) return <span className="w-7" aria-hidden="true" />;

  if (isSignedIn) {
    return (
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-7 w-7",
          },
        }}
      />
    );
  }

  return (
    <>
      <SignInButton mode="modal">
        <button
          type="button"
          className="whitespace-nowrap text-sm text-muted transition-colors hover:text-foreground"
        >
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button
          type="button"
          className="whitespace-nowrap rounded border border-hairline px-2.5 py-1 text-[11px] uppercase tracking-widest text-muted transition-colors hover:border-foreground hover:text-foreground"
        >
          Sign up
        </button>
      </SignUpButton>
    </>
  );
}
