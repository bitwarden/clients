import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

export function organizationFeatureGuard(
  featureCallback: (organization: Organization) => boolean | Promise<boolean> | Observable<boolean>,
): CanActivateFn {
  return async () => {
    const router = inject(Router);
    const toastService = inject(ToastService);
    const i18nService = inject(I18nService);

    const compliant = await compliantWithOrgFeature(featureCallback);

    if (!compliant) {
      toastService.showToast({
        variant: "error",
        message: i18nService.t("accessDenied"),
      });

      return router.createUrlTree(["/"]);
    }

    return compliant;
  };
}

export async function compliantWithOrgFeature(
  featureCallback: (organization: Organization) => boolean | Promise<boolean> | Observable<boolean>,
): Promise<boolean> {
  const accountService = inject(AccountService);
  const organizationService = inject(OrganizationService);

  return await firstValueFrom(
    accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => organizationService.organizations$(userId)),
      map(async (organizations) => {
        for (const org of organizations) {
          const featureCompliant = await Promise.resolve(featureCallback(org));

          if (typeof featureCompliant !== "boolean") {
            throw new Error("Feature callback must return a boolean.");
          }

          if (!featureCompliant) {
            return false;
          }
        }

        return true;
      }),
    ),
  );
}
