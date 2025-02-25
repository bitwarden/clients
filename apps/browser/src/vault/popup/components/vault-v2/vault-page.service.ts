import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  BANNERS_DISMISSED_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

export const NEW_CUSTOMIZATION_OPTIONS_CALLOUT_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  BANNERS_DISMISSED_DISK,
  "newCustomizationOptionsCalloutDismissed",
  {
    deserializer: (calloutDismissed) => calloutDismissed,
    clearOn: [], // Do not clear dismissed callouts
  },
);

@Injectable()
export class VaultPageService {
  private stateProvider = inject(StateProvider);

  isCalloutDismissed(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, NEW_CUSTOMIZATION_OPTIONS_CALLOUT_DISMISSED_KEY)
      .state$.pipe(map((dismissed) => !!dismissed));
  }

  async dismissCallout(userId: UserId): Promise<void> {
    await this.stateProvider
      .getUser(userId, NEW_CUSTOMIZATION_OPTIONS_CALLOUT_DISMISSED_KEY)
      .update(() => true);
  }
}
