import { Observable, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";

/**
 * Emits whether this client is connected to a Gov environment. Checks the active account's
 * environment, or the global environment when signed out.
 */
export const clientIsGovMode$ = (
  accountService: AccountService,
  govModeService: GovModeService,
): Observable<boolean> =>
  accountService.activeAccount$.pipe(
    getOptionalUserId,
    switchMap((userId) =>
      userId != null ? govModeService.isGovMode$(userId) : govModeService.globalIsGovMode$,
    ),
  );
