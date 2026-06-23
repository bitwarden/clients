/**
 * Default values for the landing-layout primitive components.
 *
 * These are referenced from each landing-* component's `input<>()` declaration *and* from
 * `ANON_LAYOUT_DEFAULTS` in the `anon-layout` folder, so the standalone-component default and
 * the reset-time default in `resetToCachedRouteData()` cannot drift. Co-locating them here
 * also keeps the dependency one-way: `anon-layout → landing-layout`.
 */
export const LANDING_CONTENT_VERTICAL_PADDING_DEFAULT = "default" as const;
export const LANDING_FOOTER_VERTICAL_PADDING_DEFAULT = "default" as const;
export const LANDING_HERO_TEXT_ALIGNMENT_DEFAULT = "center" as const;
