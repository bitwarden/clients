import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, createUrlTreeFromSnapshot } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ServiceAccountService } from "../service-account.service";

/**
 * Redirects to service accounts page if the user doesn't have access to service account.
 */
export const serviceAccountAccessGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const serviceAccountService = inject(ServiceAccountService);
  const platformUtilsService = inject(PlatformUtilsService);
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
    platformUtilsService.showToast(
      "error",
      null,
      i18nService.t("notFound", i18nService.t("serviceAccount")),
    );

    return createUrlTreeFromSnapshot(route, [
      "/sm",
      route.params.organizationId,
      "machine-accounts",
    ]);
  }
  return createUrlTreeFromSnapshot(route, ["/sm", route.params.organizationId, "machine-accounts"]);
};
