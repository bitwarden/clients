import { map, Observable } from "rxjs";

import {
  BillingAccountProfile,
  BillingAccountProfileStateService,
} from "@bitwarden/common/billing/abstractions";
import { BILLING_DISK, StateProvider, UserKeyDefinition } from "@bitwarden/state";

import { UserId } from "../../../types/guid";

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
    await this.stateProvider.getUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION).update(
      (_) => {
        return {
          hasPremiumPersonally: hasPremiumPersonally,
          hasPremiumFromAnyOrganization: hasPremiumFromAnyOrganization,
        };
      },
      {
        shouldUpdate: (state) =>
          state == null ||
          state.hasPremiumFromAnyOrganization !== hasPremiumFromAnyOrganization ||
          state.hasPremiumPersonally !== hasPremiumPersonally,
      },
    );
  }
}
