import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, Observable, switchMap, tap } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

/**
 * This guard is intended to prevent members of an organization from accessing
 * routes based on compliance with organization
 * policies. e.g Emergency access, which is a non-organization
 * feature is restricted by the Auto Confirm policy.
 */
export function organizationPolicyGuard(
  featureCallback: (
    userId: UserId,
    configService: ConfigService,
    policyService: PolicyService,
  ) => Observable<boolean>,
): CanActivateFn {
  return async () => {
    const router = inject(Router);
    const toastService = inject(ToastService);
    const i18nService = inject(I18nService);
    const accountService = inject(AccountService);
    const policyService = inject(PolicyService);
    const configService = inject(ConfigService);
    const syncService = inject(SyncService);

    const synced = await firstValueFrom(
      accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => syncService.lastSync$(userId)),
      ),
    );

    if (synced == null) {
      await syncService.fullSync(false);
    }

    const compliant = await firstValueFrom(
      accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => featureCallback(userId, configService, policyService)),
        tap((compliant) => {
          if (typeof compliant !== "boolean") {
            throw new Error("Feature callback must return a boolean.");
          }
        }),
      ),
    );

    if (!compliant) {
      toastService.showToast({
        variant: "error",
        message: i18nService.t("noPageAccess"),
      });

      return router.createUrlTree(["/"]);
    }

    return compliant;
  };
}
