import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

import { clientIsGovMode$ } from "../../platform/gov-mode";

/**
 * Returns a CanActivateFn that blocks navigation when the client is connected to a Gov
 * environment, showing an "Access denied" toast and redirecting.
 *
 * Works on authenticated and unauthenticated routes: {@link clientIsGovMode$} checks the active
 * account's environment, or the global environment when signed out.
 *
 * @param redirectUrl - Url to redirect to when navigation is blocked. Defaults to `/vault`.
 */
export const govModeBlockedGuard = (redirectUrl = "/vault"): CanActivateFn => {
  return async () => {
    const govModeService = inject(GovModeService);
    const accountService = inject(AccountService);
    const router = inject(Router);
    const i18nService = inject(I18nService);
    const toastService = inject(ToastService);

    const isGovMode = await firstValueFrom(clientIsGovMode$(accountService, govModeService));

    if (!isGovMode) {
      return true;
    }

    toastService.showToast({
      variant: "error",
      title: undefined,
      message: i18nService.t("accessDenied"),
    });

    return router.createUrlTree([redirectUrl]);
  };
};
