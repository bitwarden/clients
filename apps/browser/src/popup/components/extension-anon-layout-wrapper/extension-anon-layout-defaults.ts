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
  showLogo: true,
  hideFooter: false,
  secondaryContentLocation: "main",
} as const;
