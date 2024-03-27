import { map, Observable, of, switchMap } from "rxjs";

import {
  ActiveUserState,
  BILLING_DISK,
  KeyDefinition,
  StateProvider,
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

  constructor(stateProvider: StateProvider) {
    this.billingAccountProfileState = stateProvider.getActive(
      BILLING_ACCOUNT_PROFILE_KEY_DEFINITION,
    );

    // Setup an observable that will always track the currently active user
    // but will fallback to emitting null when there is no active user.
    const billingAccountProfileOrNull = stateProvider.activeUserId$.pipe(
      switchMap((userId) =>
        userId != null
          ? stateProvider.getUser(userId, BILLING_ACCOUNT_PROFILE_KEY_DEFINITION).state$
          : of(null),
      ),
    );

    this.hasPremiumFromAnyOrganization$ = billingAccountProfileOrNull.pipe(
      map((billingAccountProfile) => !!billingAccountProfile?.hasPremiumFromAnyOrganization),
    );

    this.hasPremiumPersonally$ = billingAccountProfileOrNull.pipe(
      map((billingAccountProfile) => !!billingAccountProfile?.hasPremiumPersonally),
    );

    this.hasPremiumFromAnySource$ = billingAccountProfileOrNull.pipe(
      map(
        (billingAccountProfile) =>
          billingAccountProfile?.hasPremiumFromAnyOrganization === true ||
          billingAccountProfile?.hasPremiumPersonally === true,
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
