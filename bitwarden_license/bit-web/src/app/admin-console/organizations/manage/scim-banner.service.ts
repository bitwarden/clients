import { inject, Injectable } from "@angular/core";
import { map } from "rxjs";

import { SCIM_BANNER, StateProvider, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { OrganizationId } from "@bitwarden/common/types/guid";

export const SCIM_BANNER_SEEN_KEY = new UserKeyDefinition<OrganizationId[]>(
  SCIM_BANNER,
  "scimBannerSeen",
  {
    deserializer: (b) => b,
    clearOn: [],
  },
);

@Injectable({ providedIn: "root" })
export class ScimBannerService {
  private readonly _seen = inject(StateProvider).getActive(SCIM_BANNER_SEEN_KEY);

  bannerSeen$(organizationId: OrganizationId) {
    return this._seen.state$.pipe(map((ids) => ids?.includes(organizationId) ?? false));
  }

  async markBannerSeen(organizationId: OrganizationId): Promise<void> {
    await this._seen.update((state) => {
      if (!state) {
        return [organizationId];
      }
      if (!state.includes(organizationId)) {
        return [...state, organizationId];
      }
      return state;
    });
  }
}
