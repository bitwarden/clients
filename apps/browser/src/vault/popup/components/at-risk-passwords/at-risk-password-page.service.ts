import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  AT_RISK_PASSWORDS_PAGE_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

const AUTOFILL_CALLOUT_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  AT_RISK_PASSWORDS_PAGE_DISK,
  "autofillCalloutDismissed",
  {
    deserializer: (bannersDismissed) => bannersDismissed,
    clearOn: [], // Do not clear dismissed callout
  },
);

const GETTING_STARTED_CAROUSEL_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  AT_RISK_PASSWORDS_PAGE_DISK,
  "gettingStartedCarouselDismissed",
  {
    deserializer: (bannersDismissed) => bannersDismissed,
    clearOn: [], // Do not clear dismissed carousel
  },
);

@Injectable()
export class AtRiskPasswordPageService {
  private stateProvider = inject(StateProvider);

  isCalloutDismissed(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, AUTOFILL_CALLOUT_DISMISSED_KEY)
      .state$.pipe(map((dismissed) => !!dismissed));
  }

  async dismissCallout(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, AUTOFILL_CALLOUT_DISMISSED_KEY).update(() => true);
  }

  isGettingStartedDismissed(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, GETTING_STARTED_CAROUSEL_DISMISSED_KEY)
      .state$.pipe(map((dismissed) => !!dismissed));
  }

  async dismissGettingStarted(userId: UserId): Promise<void> {
    await this.stateProvider
      .getUser(userId, GETTING_STARTED_CAROUSEL_DISMISSED_KEY)
      .update(() => true);
  }
}
