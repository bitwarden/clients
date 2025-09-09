import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { VaultProfileService } from "@bitwarden/angular/vault/services/vault-profile.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  SETUP_EXTENSION_DISMISSED_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

import { WebBrowserInteractionService } from "../services/web-browser-interaction.service";

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
  const vaultProfileService = inject(VaultProfileService);
  const stateProvider = inject(StateProvider);
  const webBrowserInteractionService = inject(WebBrowserInteractionService);

  const isMobile = Utils.isMobileBrowser;

  // The extension page isn't applicable for mobile users, do not redirect them.
  // Include before any other checks to avoid unnecessary processing.
  if (isMobile) {
    return true;
  }

  const currentAcct = await firstValueFrom(accountService.activeAccount$);

  if (!currentAcct) {
    return router.createUrlTree(["/login"]);
  }

  const hasExtensionInstalledPromise = firstValueFrom(
    webBrowserInteractionService.extensionInstalled$,
  );

  const dismissedExtensionPage = await firstValueFrom(
    stateProvider
      .getUser(currentAcct.id, SETUP_EXTENSION_DISMISSED)
      .state$.pipe(map((dismissed) => dismissed ?? false)),
  );

  const isProfileOlderThan30Days = await profileIsOlderThan30Days(
    vaultProfileService,
    currentAcct.id,
  ).catch(
    () =>
      // If the call for the profile fails for any reason, do not block the user
      true,
  );

  if (dismissedExtensionPage || isProfileOlderThan30Days) {
    return true;
  }

  // Checking for the extension is a more expensive operation, do it last to avoid unnecessary delays.
  const hasExtensionInstalled = await hasExtensionInstalledPromise;

  if (hasExtensionInstalled) {
    return true;
  }

  return router.createUrlTree(["/setup-extension"]);
};

/** Returns true when the user's profile is older than 30 days */
async function profileIsOlderThan30Days(
  vaultProfileService: VaultProfileService,
  userId: string,
): Promise<boolean> {
  const creationDate = await vaultProfileService.getProfileCreationDate(userId);
  return isMoreThan30DaysAgo(creationDate);
}

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
