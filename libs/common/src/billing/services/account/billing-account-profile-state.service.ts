import { map, Observable } from "rxjs";

import {
  ActiveUserState,
  ActiveUserStateProvider,
  BILLING_DISK,
  KeyDefinition,
} from "../../../platform/state";
import {
  BillingAccountProfile,
  BillingAccountProfileStateService,
} from "../../abstractions/account/billing-account-profile-state.service";

export const BILLING_ACCOUNT_PROFILE_KEY_DEFINITION = new KeyDefinition<BillingAccountProfile>(
  BILLING_DISK,
  "accountProfile",
  {
    deserializer: (billingAccountProfile) => billingAccountProfile,
  },
);

export class DefaultBillingAccountProfileStateService implements BillingAccountProfileStateService {
  private billingAccountProfileState: ActiveUserState<BillingAccountProfile>;

  hasPremiumFromAnyOrganization$: Observable<boolean>;
  hasPremiumPersonally$: Observable<boolean>;
  hasPremiumFromAnySource$: Observable<boolean>;

  constructor(activeUserStateProvider: ActiveUserStateProvider) {
    this.billingAccountProfileState = activeUserStateProvider.get(
      BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
    );

    this.hasPremiumFromAnyOrganization$ = this.billingAccountProfileState.state$.pipe(
      map((billingAccountProfile) => !!billingAccountProfile?.hasPremiumFromAnyOrganization),
    );

    this.hasPremiumPersonally$ = this.billingAccountProfileState.state$.pipe(
      map((billingAccountProfile) => !!billingAccountProfile?.hasPremiumPersonally),
    );

    this.hasPremiumFromAnySource$ = this.billingAccountProfileState.state$.pipe(
      map(
        (billingAccountProfile) =>
          billingAccountProfile?.hasPremiumFromAnyOrganization ||
          billingAccountProfile?.hasPremiumPersonally,
      ),
    );
  }

  async setHasPremium(
    hasPremiumPersonally: boolean,
    hasPremiumFromAnyOrganization: boolean,
  ): Promise<void> {
    await this.billingAccountProfileState.update((billingAccountProfile) => {
      return {
        hasPremiumPersonally: hasPremiumPersonally,
        hasPremiumFromAnyOrganization: hasPremiumFromAnyOrganization,
      };
    });
  }
}
