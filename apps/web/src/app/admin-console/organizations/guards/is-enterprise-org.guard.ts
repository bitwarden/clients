// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { DialogService } from "@bitwarden/components";

/**
 * `CanActivateFn` that checks if the organization matching the id in the URL
 * parameters is of enterprise type. If the organization is not enterprise instructions are
 * provided on how to upgrade into an enterprise organization, and the user is redirected
 * if they have access to upgrade the organization. If the organization is
 * enterprise routing proceeds."
 */
export function isEnterpriseOrgGuard(showError: boolean = true): CanActivateFn {
  return async (route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
    const router = inject(Router);
    const organizationService = inject(OrganizationService);
    const accountService = inject(AccountService);
    const dialogService = inject(DialogService);

    const userId = await firstValueFrom(accountService.activeAccount$.pipe(map((a) => a?.id)));
    const org = await firstValueFrom(
      organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(route.params.organizationId)),
    );

    if (org == null) {
      return router.createUrlTree(["/"]);
    }

    if (org.productTierType != ProductTierType.Enterprise && showError) {
      // Users without billing permission can't access billing
      if (!org.canEditSubscription) {
        await dialogService.openSimpleDialog({
          title: { key: "upgradeOrganizationEnterprise" },
          content: { key: "onlyAvailableForEnterpriseOrganization" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "info",
        });
        return false;
      } else {
        const upgradeConfirmed = await dialogService.openSimpleDialog({
          title: { key: "upgradeOrganizationEnterprise" },
          content: { key: "onlyAvailableForEnterpriseOrganization" },
          acceptButtonText: { key: "upgradeOrganization" },
          type: "info",
          icon: "bwi-plus-circle",
        });
        if (upgradeConfirmed) {
          await router.navigate(["organizations", org.id, "billing", "subscription"], {
            queryParams: { upgrade: true, productTierType: ProductTierType.Enterprise },
          });
        }
      }
    }

    return org.productTierType == ProductTierType.Enterprise;
  };
}
