import { map, Observable, combineLatest, concatMap } from "rxjs";

import { ApiService } from "../../../abstractions/api.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
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
  constructor(
    private readonly stateProvider: StateProvider,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly apiService: ApiService,
  ) {}

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

  canViewSubscription$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.hasPremiumPersonally$(userId),
      this.hasPremiumFromAnyOrganization$(userId),
    ]).pipe(
      concatMap(async ([hasPremiumPersonally, hasPremiumFromOrg]) => {
        if (hasPremiumPersonally === true || !hasPremiumFromOrg === true) {
          return true;
        }

        const isCloud = !this.platformUtilsService.isSelfHost();

        if (isCloud) {
          const billing = await this.apiService.getUserBillingHistory();
          return !billing?.hasNoHistory;
        }

        return false;
      }),
    );
  }
}
