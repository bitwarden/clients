/**
 * Default values for the fields {@link ExtensionAnonLayoutWrapperData} adds on top of
 * {@link AnonLayoutWrapperData}
 *
 * Used together with `ANON_LAYOUT_DEFAULTS` in `ExtensionAnonLayoutWrapperDataService`'s
 * `resetToCachedRouteData()` override so the reset emits a complete payload across both
 * the base and the extension-only fields.
 */
export const EXTENSION_ANON_LAYOUT_DEFAULTS = {
  showAcctSwitcher: false,
  showBackButton: false,
  // Note: `false` preserves the current observable behavior — most extension auth routes
  // historically had the logo hidden because `resetPageData()` wiped `showLogo` to a falsy
  // value before the route-init handler ran (and most routes don't declare `showLogo`).
  // The class-level `protected showLogo: boolean = true;` only takes effect briefly on
  // first render before any NavigationEnd fires, which is essentially unobservable in
  // practice.
  showLogo: false,
  hideFooter: false,
  secondaryContentLocation: "main",
} as const;
