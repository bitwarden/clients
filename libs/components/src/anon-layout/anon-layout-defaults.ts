import { AnonLayoutWrapperData } from "./anon-layout-wrapper.component";

/**
 * Default values for every field on {@link AnonLayoutWrapperData}.
 *
 * Spread under the cached route payload in `resetToCachedRouteData()` so the reset
 * emits a complete payload — route-declared values win where present, defaults clear
 * any imperative overrides for fields the route didn't declare.
 *
 * Also referenced from `AnonLayoutComponent`'s `input<>()` declarations to keep the
 * component-level default and the reset-time default in lockstep.
 */
export const BASE_LAYOUT_DEFAULTS: Required<AnonLayoutWrapperData> = {
  pageTitle: null,
  pageSubtitle: null,
  pageIcon: null,
  hidePageIcon: false,
  contentTopPadding: "default",
  heroTextAlignment: "center",
  showReadonlyHostname: false,
  maxWidth: "md",
  hideCardWrapper: false,
  hideBackgroundIllustration: false,
};
