"use client";

import { useCallback, useSyncExternalStore } from "react";
import { breakpoints } from "@/shared/ui/tokens";

/**
 * SSR-safe media query hook.
 *
 * Returns `false` during SSR and the initial client render, then updates
 * after mount to avoid hydration mismatches. Accepts a breakpoint token
 * key (sm/md/lg/xl/2xl) and returns whether the viewport is at least that wide.
 *
 * Uses `useSyncExternalStore` for correct React 18+ subscription semantics.
 *
 * @example
 * const isMobile = useMediaQuery("sm"); // viewport >= 640px
 * const isDesktop = useMediaQuery("lg"); // viewport >= 1024px
 */
export function useMediaQuery(
  breakpoint: keyof typeof breakpoints = "md",
): boolean {
  const query = `(min-width: ${breakpoints[breakpoint]})`;

  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = globalThis.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => globalThis.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Convenience hook: returns `true` when the viewport is below the `md`
 * breakpoint (768px). Useful for switching to mobile-specific layouts.
 */
export function useIsMobile(): boolean {
  const isMd = useMediaQuery("md");
  return !isMd;
}
