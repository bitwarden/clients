import { map, Observable } from "rxjs";

import { BILLING_DISK, StateProvider, UserKeyDefinition } from "../../../platform/state";
import { UserId } from "../../../types/guid";
import {
  BillingAccountProfile,
  BillingAccountProfileStateService,
} from "../../abstractions/account/billing-account-profile-state.service";

export const BILLING_ACCOUNT_PROFILE_KEY_DEFINITION = new UserKeyDefinition<BillingAccountProfile>(
  BILLING_DISK,
  "accountProfile",
  {
    deserializer: (billingAccountProfile) => billingAccountProfile,
    clearOn: ["logout"],
  },
);

export class DefaultBillingAccountProfileStateService implements BillingAccountProfileStateService {
  constructor(private readonly stateProvider: StateProvider) {}

  hasPremiumFromAnyOrganization$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION)
      .state$.pipe(map((profile) => !!profile?.hasPremiumFromAnyOrganization));
  }

  hasPremiumPersonally$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION)
      .state$.pipe(map((profile) => !!profile?.hasPremiumPersonally));
  }

  hasPremiumFromAnySource$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION)
      .state$.pipe(
        map(
          (profile) =>
            profile?.hasPremiumFromAnyOrganization === true ||
            profile?.hasPremiumPersonally === true,
        ),
      );
  }

  async setHasPremium(
    hasPremiumPersonally: boolean,
    hasPremiumFromAnyOrganization: boolean,
    userId: UserId,
  ): Promise<void> {
    await this.stateProvider.getUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION).update((_) => {
      return {
        hasPremiumPersonally: hasPremiumPersonally,
        hasPremiumFromAnyOrganization: hasPremiumFromAnyOrganization,
      };
    });
  }
}
