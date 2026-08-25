import { catchError, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * Emits whether this client is connected to the Gov cloud, where organizations are
 * sales-provisioned and self-serve flows such as organization creation are unavailable (PM-40490).
 * Checks the active account's environment, or the global environment when signed out (e.g. the
 * unauthenticated trial-initiation routes).
 *
 * Fails open: any error while determining the region is logged and emitted as `false`, so
 * consumers keep their self-serve entry points rather than breaking. The route-level
 * govModeBlockedGuard remains the backstop for the blocked flows themselves.
 *
 * @param context - Optional caller context appended to the fail-open log entry.
 */
export const clientIsGovMode$ = (
  accountService: AccountService,
  govModeService: GovModeService,
  logService: LogService,
  context?: string,
): Observable<boolean> =>
  accountService.activeAccount$.pipe(
    getOptionalUserId,
    switchMap((userId) =>
      userId != null ? govModeService.isGovMode$(userId) : govModeService.globalIsGovMode$,
    ),
    catchError((error: unknown) => {
      logService.error(
        `clientIsGovMode$: failed to determine Gov mode, failing open${context ? ` (${context})` : ""}`,
        error,
      );
      return of(false);
    }),
  );
