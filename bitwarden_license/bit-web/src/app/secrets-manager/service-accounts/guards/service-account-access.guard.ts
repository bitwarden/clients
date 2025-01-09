// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, createUrlTreeFromSnapshot } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { ServiceAccountService } from "../service-account.service";

/**
 * Redirects to service accounts page if the user doesn't have access to service account.
 */
export const serviceAccountAccessGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const serviceAccountService = inject(ServiceAccountService);
  const toastService = inject(ToastService);
  const i18nService = inject(I18nService);

  try {
    const serviceAccount = await serviceAccountService.getByServiceAccountId(
      route.params.serviceAccountId,
      route.params.organizationId,
    );
    if (serviceAccount) {
      return true;
    }
  } catch {
    toastService.showToast({
      variant: "error",
      title: null,
      message: i18nService.t("notFound", i18nService.t("machineAccount")),
    });

    return createUrlTreeFromSnapshot(route, [
      "/sm",
      route.params.organizationId,
      "machine-accounts",
    ]);
  }
  return createUrlTreeFromSnapshot(route, ["/sm", route.params.organizationId, "machine-accounts"]);
};
