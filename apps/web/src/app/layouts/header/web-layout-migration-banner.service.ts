import { Injectable } from "@angular/core";

import {
  GlobalStateProvider,
  KeyDefinition,
  NEW_WEB_LAYOUT_BANNER_DISK,
} from "@bitwarden/common/platform/state";

const SHOW_BANNER_KEY = new KeyDefinition<boolean>(NEW_WEB_LAYOUT_BANNER_DISK, "showBanner", {
  deserializer: (b) => {
    if (b === null) {
      return true;
    }
    return b;
  },
});

/** Displays a banner that introduces users to the new web vault layout. */
@Injectable({ providedIn: "root" })
export class WebLayoutMigrationBannerService {
  private _showBannerState = this.globalStateProvider.get(SHOW_BANNER_KEY);
  showBanner$ = this._showBannerState.state$;

  constructor(private globalStateProvider: GlobalStateProvider) {}

  async hideBanner() {
    await this._showBannerState.update(() => false);
  }
}
