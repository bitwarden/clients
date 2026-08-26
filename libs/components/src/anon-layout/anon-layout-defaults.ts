import {
  LANDING_CONTENT_VERTICAL_PADDING_DEFAULT,
  LANDING_FOOTER_VERTICAL_PADDING_DEFAULT,
  LANDING_HERO_TEXT_ALIGNMENT_DEFAULT,
} from "../landing-layout";

import type { AnonLayoutWrapperData } from "./anon-layout-wrapper.component";

/**
 * Default values for every field on {@link AnonLayoutWrapperData}.
 *
 * Spread under the cached route payload in `resetToCachedRouteData()` so the reset
 * emits a complete payload — route-declared values win where present, defaults clear
 * any imperative overrides for fields the route didn't declare.
 *
 * Also referenced from `AnonLayoutComponent`'s `input<>()` declarations to keep the
 * component-level default and the reset-time default in lockstep. Landing-layout
 * primitives source their defaults from {@link ../landing-layout/landing-defaults}
 * so the dependency stays one-way (`anon-layout → landing-layout`).
 */
export const ANON_LAYOUT_DEFAULTS: Required<AnonLayoutWrapperData> = {
  pageTitle: null,
  pageSubtitle: null,
  pageIcon: null,
  hidePageIcon: false,
  contentVerticalPadding: LANDING_CONTENT_VERTICAL_PADDING_DEFAULT,
  footerVerticalPadding: LANDING_FOOTER_VERTICAL_PADDING_DEFAULT,
  heroTextAlignment: LANDING_HERO_TEXT_ALIGNMENT_DEFAULT,
  showReadonlyHostname: false,
  maxWidth: "md",
  hideCardWrapper: false,
  hideBackgroundIllustration: false,
  secondaryContentLocation: "main",
};
