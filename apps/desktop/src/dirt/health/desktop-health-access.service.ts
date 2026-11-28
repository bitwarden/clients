import { inject, Injectable } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { DESKTOP_HEALTH_DISK, StateProvider, UserKeyDefinition } from "@bitwarden/state";

const VAULT_ROUTE = "/vault";
const HEALTH_OVERVIEW_ROUTE = "/health";

const RUN_HEALTH_SCAN_KEY = new UserKeyDefinition<boolean>(
  DESKTOP_HEALTH_DISK,
  "hasRunHealthScan",
  {
    deserializer: (value) => value ?? false,
    clearOn: [],
  },
);

/**
 * Determines access to the desktop Health report feature and remembers whether the
 * user has started their first scan.
 */
@Injectable({ providedIn: "root" })
export class DesktopHealthAccessService {
  private readonly configService = inject(ConfigService);
  private readonly organizationService = inject(OrganizationService);
  private readonly stateProvider = inject(StateProvider);

  /** True when the feature flag is on and the user has no organizations or only Free/Families ones. */
  healthEnabled$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.DesktopVaultHealth),
      this.organizationService.organizations$(userId).pipe(
        map((orgs) => {
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
    ]).pipe(map(([flagEnabled, hasAccess]) => flagEnabled && hasAccess));
  }

  hasRunHealthScan$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(RUN_HEALTH_SCAN_KEY, userId)
      .pipe(map((hasRunScan) => hasRunScan ?? false));
  }

  async setHasRunHealthScan(userId: UserId): Promise<void> {
    await this.stateProvider.setUserState(RUN_HEALTH_SCAN_KEY, true, userId);
  }
}

export const canAccessHealthDesktop: CanActivateFn = () => {
  const router = inject(Router);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);
  const accountService = inject(AccountService);
  const healthAccessService = inject(DesktopHealthAccessService);

  return accountService.activeAccount$.pipe(
    switchMap((user) => (user?.id ? healthAccessService.healthEnabled$(user.id) : of(false))),
    map((hasAccess) => {
      if (!hasAccess) {
        toastService.showToast({
          variant: "error",
          title: "",
          message: i18nService.t("noPermissionsViewPage"),
        });

        return router.createUrlTree([VAULT_ROUTE]);
      }
      return true;
    }),
  );
};

/**
 * Guards the Premium-only risk-category detail routes. Redirects silently rather than
 * toasting, because a lapsed user can land here by following a stale link.
 */
export const canAccessHealthDetailDesktop: CanActivateFn = () => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const billingAccountProfileStateService = inject(BillingAccountProfileStateService);

  return accountService.activeAccount$.pipe(
    switchMap((user) =>
      user?.id ? billingAccountProfileStateService.hasPremiumFromAnySource$(user.id) : of(false),
    ),
    map((hasPremium) => hasPremium || router.createUrlTree([HEALTH_OVERVIEW_ROUTE])),
  );
};
