import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  SETUP_EXTENSION_DISMISSED_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

export const SETUP_EXTENSION_DISMISSED = new UserKeyDefinition<boolean>(
  SETUP_EXTENSION_DISMISSED_DISK,
  "setupExtensionDismissed",
  {
    deserializer: (dismissed) => dismissed,
    clearOn: [],
  },
);

export const setupExtensionRedirectGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const configService = inject(ConfigService);
  const stateProvider = inject(StateProvider);

  const isMobile = Utils.isMobileBrowser;

  // The extension page isn't applicable for mobile users, do not redirect them.
  // Include before any other checks to avoid unnecessary processing.
  if (isMobile) {
    return true;
  }

  const serverSettings = await firstValueFrom(configService.serverSettings$);
  if (serverSettings?.suppressOnboardingInterstitials) {
    return true;
  }

  const currentAcct = await firstValueFrom(accountService.activeAccount$);

  if (!currentAcct) {
    return router.createUrlTree(["/login"]);
  }

  const dismissedExtensionPage = await firstValueFrom(
    stateProvider
      .getUser(currentAcct.id, SETUP_EXTENSION_DISMISSED)
      .state$.pipe(map((dismissed) => dismissed ?? false)),
  );

  // If the creation date is unavailable, do not block the user
  const isProfileOlderThan30Days = currentAcct.creationDate
    ? isMoreThan30DaysAgo(currentAcct.creationDate)
    : true;

  if (dismissedExtensionPage || isProfileOlderThan30Days) {
    return true;
  }

  return router.createUrlTree(["/setup-extension"]);
};

/** Returns the true when the date given is older than 30 days */
function isMoreThan30DaysAgo(date?: string | Date): boolean {
  if (!date) {
    return false;
  }

  const inputDate = new Date(date).getTime();
  const today = new Date().getTime();

  const differenceInMS = today - inputDate;
  const msInADay = 1000 * 60 * 60 * 24;
  const differenceInDays = Math.round(differenceInMS / msInADay);

  return differenceInDays > 30;
}
