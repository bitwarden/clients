// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import {
  canAccessOrgAdmin,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";

/**
 * `CanActivateFn` that asserts the logged in user has permission to access
 * the page being navigated to. Two high-level checks are performed:
 *
 * 1. If the user is not a member of the organization in the URL parameters, they
 *    are redirected to the home screen.
 * 2. If the organization in the URL parameters is disabled and the user is not
 *    an admin, they are redirected to the home screen.
 *
 * In addition to these high level checks the guard accepts a callback
 * function as an argument that will be called to check for more granular
 * permissions. Based on the return from callback one of the following
 * will happen:
 *
 * 1. If the logged in user does not have the required permissions they are
 *    redirected to `/organizations/{id}` or `/` based on admin console access
 *    permissions.
 * 2. If the logged in user does have the required permissions navigation
 *    proceeds as expected.
 */
export function organizationPermissionsGuard(
  permissionsCallback?: (organization: Organization) => boolean,
): CanActivateFn {
  return async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const router = inject(Router);
    const organizationService = inject(OrganizationService);
    const toastService = inject(ToastService);
    const i18nService = inject(I18nService);
    const syncService = inject(SyncService);
    const accountService = inject(AccountService);

    // TODO: We need to fix issue once and for all.
    if ((await syncService.getLastSync()) == null) {
      await syncService.fullSync(false);
    }

    const org = await firstValueFrom(
      accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => organizationService.organizations$(userId)),
        getById(route.params.organizationId),
      ),
    );

    if (org == null) {
      return router.createUrlTree(["/"]);
    }

    if (!org.isOwner && !org.enabled) {
      toastService.showToast({
        variant: "error",
        title: null,
        message: i18nService.t("organizationIsDisabled"),
      });
      return router.createUrlTree(["/"]);
    }

    const hasPermissions = permissionsCallback == null || permissionsCallback(org);

    if (!hasPermissions) {
      // Handle linkable ciphers for organizations the user only has view access to
      // https://bitwarden.atlassian.net/browse/EC-203
      const cipherId =
        state.root.queryParamMap.get("itemId") || state.root.queryParamMap.get("cipherId");
      if (cipherId) {
        return router.createUrlTree(["/vault"], {
          queryParams: {
            itemId: cipherId,
          },
        });
      }

      toastService.showToast({
        variant: "error",
        title: null,
        message: i18nService.t("accessDenied"),
      });
      return canAccessOrgAdmin(org)
        ? router.createUrlTree(["/organizations", org.id])
        : router.createUrlTree(["/"]);
    }

    return true;
  };
}
