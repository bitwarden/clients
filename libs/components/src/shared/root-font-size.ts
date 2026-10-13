/**
 * Returns the root font size in pixels, falling back to 16 if unavailable (e.g. SSR).
 */
export const getRootFontSizePx = (): number =>
  typeof document !== "undefined"
    ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    : 16;

/** Converts rem to px. Read the root font size once with `getRootFontSizePx()` and pass it in. */
export const remToPx = (rem: number, rootFontSizePx: number): number => rem * rootFontSizePx;

/** Converts px to rem. */
export const pxToRem = (px: number, rootFontSizePx: number): number => px / rootFontSizePx;
