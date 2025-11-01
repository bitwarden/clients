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
 * Checks if the current viewport is within the specified breakpoint.
 * @param size The breakpoint to check.
 * @returns True if the viewport is within the breakpoint, false otherwise.
 */
export const isWithinBreakpoint = (size: keyof typeof BREAKPOINTS): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  const query = `(max-width: ${BREAKPOINTS[size]}px)`;
  return window.matchMedia(query).matches;
};
