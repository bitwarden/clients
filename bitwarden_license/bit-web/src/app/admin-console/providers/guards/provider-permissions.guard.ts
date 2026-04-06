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

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

/**
 * `CanActivateFn` that asserts the logged in user has permission to access
 * the page being navigated to. Two high-level checks are performed:
 *
 * 1. If the user is not a member of the provider in the URL parameters, they
 *    are redirected to the home screen.
 * 2. If the provider in  the URL parameters is disabled and the user is not
 *    an admin, they are redirected to the home screen.
 *
 * In addition to these high level checks the guard accepts a callback
 * function as an argument that will be called to check for more granular
 * permissions. Based on the return from this callback one of the following
 * will happen:
 *
 * 1. If the logged in user does not have the required permissions they are
 *    redirected to `/providers`.
 * 2. If the logged in user does have the required permissions navigation
 *    proceeds as expected.
 */
export function providerPermissionsGuard(
  permissionsCallback?: (provider: Provider) => boolean,
): CanActivateFn {
  return async (route: ActivatedRouteSnapshot, _state: RouterStateSnapshot) => {
    const providerService = inject(ProviderService);
    const router = inject(Router);
    const i18nService = inject(I18nService);
    const toastService = inject(ToastService);
    const accountService = inject(AccountService);

    const provider = await firstValueFrom(
      accountService.activeAccount$.pipe(
        getUserId,
        switchMap((userId) => providerService.get$(route.params.providerId, userId)),
      ),
    );
    if (provider == null) {
      return router.createUrlTree(["/"]);
    }

    if (!provider.isProviderAdmin && !provider.enabled) {
      toastService.showToast({
        variant: "error",
        title: null,
        message: i18nService.t("providerIsDisabled"),
      });
      return router.createUrlTree(["/"]);
    }

    const hasSpecifiedPermissions = permissionsCallback == null || permissionsCallback(provider);

    if (!hasSpecifiedPermissions) {
      toastService.showToast({
        variant: "error",
        title: null,
        message: i18nService.t("accessDenied"),
      });
      return router.createUrlTree(["/providers", provider.id]);
    }

    return true;
  };
}
