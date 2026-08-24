import { catchError, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { GovModeService } from "@bitwarden/common/platform/abstractions/gov-mode.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

/**
 * Emits whether the active account's environment is the Gov cloud, where organizations are
 * sales-provisioned and self-serve flows such as organization creation are unavailable (PM-40490).
 *
 * Fails open: any error while determining the region is logged and emitted as `false`, so
 * consumers keep their self-serve entry points rather than breaking. The route-level
 * govModeBlockedGuard remains the backstop for the blocked flows themselves.
 *
 * @param context - Optional caller context appended to the fail-open log entry.
 */
export const activeUserIsGovMode$ = (
  accountService: AccountService,
  govModeService: GovModeService,
  logService: LogService,
  context?: string,
): Observable<boolean> =>
  accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => govModeService.isGovMode$(userId)),
    catchError((error: unknown) => {
      logService.error(
        `activeUserIsGovMode$: failed to determine Gov mode, failing open${context ? ` (${context})` : ""}`,
        error,
      );
      return of(false);
    }),
  );
