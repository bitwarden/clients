import { Injectable } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import {
  ACCOUNT_DEPROVISIONING_BANNER_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

export const SHOW_BANNER_KEY = new UserKeyDefinition<string[]>(
  ACCOUNT_DEPROVISIONING_BANNER_DISK,
  "accountDeprovisioningBanner",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class AccountDeprovisioningBannerService {
  private _showBanner = this.stateProvider.getActive(SHOW_BANNER_KEY);

  showBanner$ = this._showBanner.state$;

  constructor(private stateProvider: StateProvider) {}

  async hideBanner(organization: Organization) {
    await this._showBanner.update((state) => {
      if (!organization) {
        return state;
      }
      if (!state) {
        return [organization.id];
      } else if (!state.includes(organization.id)) {
        return [...state, organization.id];
      }
      return state;
    });
  }
}
