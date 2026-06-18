"use client";

import { useEffect, useState } from "react";
import { breakpoints } from "@/shared/ui/tokens";

/**
 * Parses a breakpoint token value (e.g. "768px") into a numeric pixel value.
 */
function parseBreakpoint(value: string): number {
  return Number.parseInt(value, 10);
}

/**
 * SSR-safe media query hook.
 *
 * Returns `false` during SSR and the initial client render, then updates
 * after mount to avoid hydration mismatches. Accepts a breakpoint token
 * key (sm/md/lg/xl/2xl) and returns whether the viewport is at least that wide.
 *
 * @example
 * const isMobile = useMediaQuery("sm"); // viewport >= 640px
 * const isDesktop = useMediaQuery("lg"); // viewport >= 1024px
 */
export function useMediaQuery(
  breakpoint: keyof typeof breakpoints = "md",
): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const query = `(min-width: ${breakpoints[breakpoint]})`;
    const mql = globalThis.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return matches;
}

/**
 * Convenience hook: returns `true` when the viewport is below the `md`
 * breakpoint (768px). Useful for switching to mobile-specific layouts.
 */
export function useIsMobile(): boolean {
  const isMd = useMediaQuery("md");
  return !isMd;
}