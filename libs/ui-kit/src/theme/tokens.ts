/**
 * Design tokens — TypeScript mirror of the CSS custom properties declared in
 * ./fork-theme.css. Use these in component logic (e.g. animation timings, ring
 * geometry) so there are no magic numbers. The CSS file remains the source of
 * truth for *rendered* values; keep the two in sync.
 */

/** 4px-based spacing scale (px). */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

/** Motion timings (ms) — match --fk-dur-* (zeroed under prefers-reduced-motion). */
export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

export const easing = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Typographic scale: [fontSizePx, fontWeight, lineHeight]. */
export const typeScale = {
  display: [28, 700, 1.2],
  h1: [22, 600, 1.25],
  h2: [18, 600, 1.3],
  body: [14, 450, 1.5],
  label: [13, 500, 1.4],
  caption: [12, 450, 1.4],
  mono: [13, 450, 1.5],
} as const;

export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
export type TypeToken = keyof typeof typeScale;
