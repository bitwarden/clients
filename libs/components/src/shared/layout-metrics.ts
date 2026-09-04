/**
 * Dimensions shared by the app layout and the side nav, in rem.
 *
 * These live here because both `../layout` and `../navigation` need them and the layout already
 * imports the side nav service — importing back the other way would be a cycle.
 */

/** Minimum width of the main content column. Matches `tw-min-w-96` on `<main>`. */
export const MAIN_MIN_WIDTH_REM = 24;

/** Rendered width of the collapsed nav (siderail / icon strip). */
export const SIDERAIL_WIDTH_REM = 4;
