import type { AnonLayoutWrapperData } from "@bitwarden/components";

import type { ExtensionAnonLayoutWrapperData } from "./extension-anon-layout-wrapper.component";

/**
 * Default values for the fields {@link ExtensionAnonLayoutWrapperData} adds on top of
 * {@link AnonLayoutWrapperData}.
 *
 * Used together with `ANON_LAYOUT_DEFAULTS` in `ExtensionAnonLayoutWrapperDataService`'s
 * `resetToCachedRouteData()` override so the reset emits a complete payload across both
 * the base and the extension-only fields.
 *
 * Typed as `Required<Omit<...>>` against the extension delta so adding a new extension-only
 * field to {@link ExtensionAnonLayoutWrapperData} forces a defaults entry here at compile
 * time, mirroring the base-side guarantee in `ANON_LAYOUT_DEFAULTS`.
 */
export const EXTENSION_ANON_LAYOUT_DEFAULTS: Required<
  Omit<ExtensionAnonLayoutWrapperData, keyof AnonLayoutWrapperData>
> = {
  showAcctSwitcher: false,
  showBackButton: false,
  showLogo: true,
  hideFooter: false,
};
