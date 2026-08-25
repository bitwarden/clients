import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { clientIsGovMode$ } from "../../platform/gov-mode";

/**
 * Returns a CanActivateFn that blocks navigation when the client is connected to the Gov cloud.
 *
 * Organizations on the Gov cloud are sales-provisioned (PM-40490), so self-serve flows such as
 * organization creation are never available there. Blocked navigation shows an "Access denied"
 * toast and redirects.
 *
 * Works on authenticated and unauthenticated routes alike: {@link clientIsGovMode$} checks the
 * active account's environment, or the global environment when signed out (the trial-initiation
 * routes).
 *
 * Note: this guard deliberately **fails open** (via {@link clientIsGovMode$}). Any error while
 * determining the region is logged and navigation is allowed. Failing closed would lock US/EU
 * users out of flows they are entitled to, which is a worse outcome than the Gov user briefly
 * reaching a page whose backend rejects self-serve requests anyway.
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
      clientIsGovMode$(
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
