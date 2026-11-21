/**
 * Side navigation: `bit-side-nav`, `bit-nav-item`, `bit-nav-group`, `bit-nav-section`,
 * `bit-nav-section-empty`, `bit-nav-divider`, `bit-nav-logo`.
 *
 * - Router inputs become `href` + `active`; the app decides what is active and sets `active`
 *   (an active item opens its ancestor groups).
 * - `SideNavState` replaces `SideNavService`/`SideNavWidthService`. `bit-layout` provides it via
 *   `sideNavContext`; `defaultSideNavState` is shared unless a layout is given its own.
 * - Width persistence is pluggable (`SideNavWidthStorage`); `localStorage` by default.
 * - `legacy` on `bit-layout` / `bit-side-nav` selects the pre-VFO1 design.
 */
export * from "./nav-divider";
export * from "./nav-group";
export * from "./nav-item";
export * from "./nav-logo";
export * from "./nav-section";
export * from "./nav-section-empty";
export * from "./side-nav";
export * from "./side-nav-resize";
export * from "./side-nav-state";
export * from "./side-nav-width";
export { NavToggleScope, navGroupContext, navToggleScopeContext } from "./nav-context";
export type { NavGroupParent } from "./nav-context";
