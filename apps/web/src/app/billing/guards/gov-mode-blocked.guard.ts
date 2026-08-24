import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { activeUserIsGovMode$ } from "../../platform/gov-mode";

/**
 * Returns a CanActivateFn that blocks navigation when the client is connected to the Gov cloud.
 *
 * Organizations on the Gov cloud are sales-provisioned (PM-40490), so self-serve flows such as
 * organization creation are never available there. Blocked navigation shows an "Access denied"
 * toast and redirects.
 *
 * Guarded routes are expected to sit behind authentication, so an active account is assumed.
 *
 * Note: this guard deliberately **fails open** (via {@link activeUserIsGovMode$}). Any error while
 * determining the region (including a missing active account) is logged and navigation is allowed.
 * Failing closed would lock US/EU users out of flows they are entitled to, which is a worse
 * outcome than the Gov user briefly reaching a page whose backend rejects self-serve requests
 * anyway.
 *
 * @param redirectUrl - Url to redirect to when navigation is blocked. Defaults to `/vault`.
 */
export const govModeBlockedGuard = (redirectUrl = "/vault"): CanActivateFn => {
  return async (_route, state) => {
    const govModeService = inject(GovModeService);
    const accountService = inject(AccountService);
    const router = inject(Router);
    const i18nService = inject(I18nService);
    const logService = inject(LogService);
    const toastService = inject(ToastService);

    const isGovMode = await firstValueFrom(
      activeUserIsGovMode$(
        accountService,
        govModeService,
        logService,
        `govModeBlockedGuard for ${state.url}`,
      ),
    );

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
