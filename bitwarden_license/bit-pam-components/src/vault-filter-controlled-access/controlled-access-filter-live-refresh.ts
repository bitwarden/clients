import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Whether {@link ControlledAccessVaultFilterService} re-reads a row's access state when
 * `AccessRefreshService` reports a change for that cipher, so the Controlled access chip's counts,
 * its selection and the column sort follow the badges instead of waiting for a reload.
 *
 * The web vault binds `true`. Unbound, each list's states are read once.
 */
export const CONTROLLED_ACCESS_FILTER_LIVE_REFRESH = new SafeInjectionToken<boolean>(
  "ControlledAccessFilterLiveRefresh",
);
