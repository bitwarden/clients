import { combineLatest, map, Observable, switchMap } from "rxjs";

import { HealthActive, HealthInactive } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BottomNavigationButton } from "@bitwarden/components";

import { HealthAccessService } from "./services/health-access.service";

/**
 * Builds the Health tab's entry in the popup's bottom navigation. Emits `undefined` for Users
 * without access to the Health report feature, which hides the tab.
 */
export function healthNavButton$(
  accountService: AccountService,
  healthAccessService: HealthAccessService,
): Observable<BottomNavigationButton | undefined> {
  return accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      combineLatest([
        healthAccessService.healthEnabled$(userId),
        healthAccessService.healthHasBeenOpened$(userId),
      ]),
    ),
    map(([healthEnabled, healthTabOpened]) =>
      healthEnabled
        ? ({
            label: "health",
            page: "/tabs/health",
            icon: HealthInactive,
            iconActive: HealthActive,
            showBerry: !healthTabOpened,
          } as BottomNavigationButton)
        : undefined,
    ),
  );
}
