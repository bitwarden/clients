/**
 * Application layout: `bit-layout`, `bit-page`, and scroll behaviors.
 *
 * - `layoutFooter.attach(el)` / `detach(el)` replace `LayoutFooterService` portals.
 * - `scrollLayout` / `attachScrollLayoutHost` replace `ScrollLayoutService` /
 *   `bitScrollLayoutHost`; virtual scrollers can use `scrollLayout.scrollable` as their scroller.
 * - `attachCollapseOnScroll` / `collapseOnScroll()` and `attachScrollCollapseSource` /
 *   `scrollCollapseSource()` replace `bitCollapseOnScroll` / `bitScrollCollapseSource`.
 */
export * from "./layout";
export * from "./layout-footer";
export * from "./page";
export * from "./scroll-collapse";
export * from "./scroll-direction";
export * from "./scroll-layout";
export * from "./settled-height";
