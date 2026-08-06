import { inject, Injectable } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { Observable, of, combineLatest, map, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import {
  HEALTH_TAB_VIEWED_DISK,
  RUN_HEALTH_SCAN_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/state";

/**
 * Service responsible for determining access to the browser extension Health report feature.
 */
@Injectable({
  providedIn: "root",
})
export class HealthAccessService {
  private configService = inject(ConfigService);
  private organizationService = inject(OrganizationService);
  private stateProvider = inject(StateProvider);

  /**
   * Given a UserId, returns an observable that emits true when the User has access to the Health report feature.
   * The Health report feature is only available to Users with personal accounts or belonging to free/family Organizations.
   *
   * @param userId A User's ID.
   * @returns An observable that emits true if the User has access to the Health report feature, false otherwise.
   */
  healthEnabled$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.BrowserExtensionHealthReport),
      of(userId).pipe(
        switchMap((userId) =>
          this.organizationService.organizations$(userId).pipe(
            map((orgs) => {
              // Users with personal accounts (i.e. no Organization membership)
              if (!orgs || orgs.length === 0) {
                return true;
              }

              return orgs.every(
                (org) =>
                  org.productTierType === ProductTierType.Free ||
                  org.productTierType === ProductTierType.Families,
              );
            }),
          ),
        ),
      ),
    ]).pipe(
      map(([healthFlagEnabled, userHasHealthAccess]) => healthFlagEnabled && userHasHealthAccess),
    );
  }

  /**
   * Given a UserId, returns an observable that emits true/false based on whether the User has opened the Health report feature.
   *
   * @param userId A User's ID.
   * @returns An observable that emits true if the User has opened the Health report feature, false otherwise.
   */
  healthHasBeenOpened$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(HEALTH_TAB_OPENED_KEY, userId)
      .pipe(map((hasBeenOpened) => hasBeenOpened ?? false));
  }

  /**
   * For the provided UserId, updates a flag that indicates the User has navigated into the Health report feature.
   *
   * @param userId - A User's ID.
   */
  async setHealthHasBeenOpened(userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(HEALTH_TAB_OPENED_KEY, true, userId);
  }

  /**
   * Given a UserId, returns an observable that emits true/false based on whether the User has run a Health scan (i.e. completed the introduction CTA).
   *
   * @param userId A User's ID.
   * @returns An observable that emits true if the User has run a Health scan, false otherwise.
   */
  hasRunHealthScan$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(RUN_HEALTH_SCAN_KEY, userId)
      .pipe(map((hasRunScan) => hasRunScan ?? false));
  }

  /**
   * For the provided UserId, updates a flag that indicates the User has run a Health scan (i.e. completed the introduction CTA).
   *
   * @param userId - A User's ID.
   */
  async setHasRunHealthScan(userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(RUN_HEALTH_SCAN_KEY, true, userId);
  }
}

const HEALTH_TAB_OPENED_KEY = new UserKeyDefinition<boolean>(
  HEALTH_TAB_VIEWED_DISK,
  "healthTabOpened",
  {
    deserializer: (value) => value ?? false,
    clearOn: [],
  },
);
const RUN_HEALTH_SCAN_KEY = new UserKeyDefinition<boolean>(RUN_HEALTH_SCAN_DISK, "runHealthScan", {
  deserializer: (value) => value ?? false,
  clearOn: [],
});

export const canAccessHealth: CanActivateFn = () => {
  const router = inject(Router);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);
  const accountService = inject(AccountService);
  const healthAccessService = inject(HealthAccessService);

  return accountService.activeAccount$.pipe(
    switchMap((user) => (user?.id ? healthAccessService.healthEnabled$(user.id) : of(false))),
    map((hasAccess) => {
      if (!hasAccess) {
        toastService.showToast({
          variant: "error",
          title: "",
          message: i18nService.t("noPermissionsViewPage"),
        });

        return router.createUrlTree(["/tabs/vault"]);
      }
      return true;
    }),
  );
};
