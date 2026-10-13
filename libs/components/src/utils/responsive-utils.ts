import { DestroyRef, Signal, inject, signal } from "@angular/core";

/**
 * Breakpoint definitions in pixels matching Tailwind CSS default breakpoints.
 * These values must stay in sync with tailwind.config.base.js theme.extend configuration.
 *
 * @see {@link https://tailwindcss.com/docs/responsive-design} for tailwind default breakpoints
 * @see {@link /libs/components/src/stories/responsive-design.mdx} for design system usage
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

/**
 * Checks if the current viewport is at or larger than the specified breakpoint.
 * @param size The breakpoint to check.
 * @returns True if the viewport is at or larger than the breakpoint, false otherwise.
 */
export const isAtOrLargerThanBreakpoint = (size: keyof typeof BREAKPOINTS): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  const query = `(min-width: ${BREAKPOINTS[size]}px)`;
  return window.matchMedia(query).matches;
};

/**
 * Reactive form of {@link isAtOrLargerThanBreakpoint}: a signal that tracks whether
 * the viewport is at or larger than `size`, updating as the media query changes.
 * Must be called in an injection context (cleans up its listener on destroy).
 */
export const isAtOrLargerThanBreakpointSignal = (
  size: keyof typeof BREAKPOINTS,
): Signal<boolean> => {
  const matches = signal(isAtOrLargerThanBreakpoint(size));
  if (typeof window !== "undefined" && window.matchMedia) {
    const query = window.matchMedia(`(min-width: ${BREAKPOINTS[size]}px)`);
    const listener = (event: MediaQueryListEvent) => matches.set(event.matches);
    query.addEventListener("change", listener);
    inject(DestroyRef).onDestroy(() => query.removeEventListener("change", listener));
  }
  return matches.asReadonly();
};
