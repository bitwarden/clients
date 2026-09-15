/**
 * Dimensions shared by the app layout and the side nav, in rem.
 *
 * Neither module can own both: the layout needs the nav's siderail width to size its grid tracks,
 * and the nav service needs the layout's main-content minimum for its initial push-mode estimate.
 * Hosting either constant in the other module means an import cycle or the wrong owner, and
 * splitting them across two homes is worse than one neutral module.
 */

/** Minimum width of the main content column. Bound directly on `<main>` in the layout template. */
export const LAYOUT_MAIN_CONTENT_MIN_WIDTH_REM = 24;

/** Rendered width of the collapsed nav (siderail / icon strip). */
export const SIDERAIL_WIDTH_REM = 4;
