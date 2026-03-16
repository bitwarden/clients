/**
 * Returns the root font size in pixels, falling back to 16 if unavailable (e.g. SSR).
 */
export const getRootFontSizePx = (): number =>
  typeof document !== "undefined"
    ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    : 16;
