import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

/**
 * This guard is intended to prevent members of an organization from accessing
 * non-organization related features based on compliance with organization
 * features and policies. e.g Emergency access, which is a non-organization
 * feature is restricted by the Auto Confirm policy or plan feature.
 */
export function nonOrganizationFeatureGuard(
  featureCallback: (
    organization: Organization,
    configService: ConfigService,
  ) => boolean | Promise<boolean> | Observable<boolean>,
): CanActivateFn {
  return async () => {
    const router = inject(Router);
    const toastService = inject(ToastService);
    const i18nService = inject(I18nService);
    const accountService = inject(AccountService);
    const organizationService = inject(OrganizationService);
    const configService = inject(ConfigService);

    const compliant = await firstValueFrom(
      accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => organizationService.organizations$(userId)),
        map(async (organizations) => {
          // If the member in question is not a part of any organization they
          // will not be restricted from accessing any non-organization features.
          for (const org of organizations) {
            const featureCompliant = await Promise.resolve(featureCallback(org, configService));

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
