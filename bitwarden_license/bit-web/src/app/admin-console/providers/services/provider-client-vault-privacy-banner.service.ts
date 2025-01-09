import { Injectable } from "@angular/core";

import {
  StateProvider,
  AC_BANNERS_DISMISSED_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

export const SHOW_BANNER_KEY = new UserKeyDefinition<boolean>(
  AC_BANNERS_DISMISSED_DISK,
  "showProviderClientVaultPrivacyBanner",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

/** Displays a banner warning provider users that client organization vaults
 * will soon become inaccessible directly. */
@Injectable({ providedIn: "root" })
export class ProviderClientVaultPrivacyBannerService {
  private _showBanner = this.stateProvider.getActive(SHOW_BANNER_KEY);

  showBanner$ = this._showBanner.state$;

  constructor(private stateProvider: StateProvider) {}

  async hideBanner() {
    await this._showBanner.update(() => false);
  }
}
