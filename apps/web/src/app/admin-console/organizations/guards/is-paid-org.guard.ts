// @ts-strict-ignore
import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { DialogService } from "@bitwarden/components";

/**
 * `CanActivateFn` that checks if the organization matching the id in the URL
 * parameters is paid or free. If the organization is free instructions are
 * provided on how to upgrade a free organization, and the user is redirected
 * if they have access to upgrade the organization. If the organization is
 * paid routing proceeds."
 */
export function isPaidOrgGuard(): CanActivateFn {
  return async (route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
    const router = inject(Router);
    const organizationService = inject(OrganizationService);
    const dialogService = inject(DialogService);

    const org = await organizationService.get(route.params.organizationId);

    if (org == null) {
      return router.createUrlTree(["/"]);
    }

    if (org.isFreeOrg) {
      // Users without billing permission can't access billing
      if (!org.canEditSubscription) {
        await dialogService.openSimpleDialog({
          title: { key: "upgradeOrganizationCloseSecurityGaps" },
          content: { key: "upgradeOrganizationCloseSecurityGapsDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: "info",
        });
        return false;
      } else {
        const upgradeConfirmed = await dialogService.openSimpleDialog({
          title: { key: "upgradeOrganizationCloseSecurityGaps" },
          content: { key: "upgradeOrganizationCloseSecurityGapsDesc" },
          acceptButtonText: { key: "upgradeOrganization" },
          type: "info",
          icon: "bwi-arrow-circle-up",
        });
        if (upgradeConfirmed) {
          await router.navigate(["organizations", org.id, "billing", "subscription"], {
            queryParams: { upgrade: true },
          });
        }
      }
    }

    return !org.isFreeOrg;
  };
}
