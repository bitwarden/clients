import {
  catchError,
  concat,
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  switchMap,
  take,
} from "rxjs";

import { AccessRefreshService, AccessRequestSdkService } from "@bitwarden/bit-pam";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

/** How often a taken single-active-lease slot is re-read, so an early end re-enables Start access. */
const SLOT_RECHECK_INTERVAL_MS = 60_000;

export type StartSlotDeps = {
  accessRequestSdkService: AccessRequestSdkService;
  accessRefreshService: AccessRefreshService;
  ticker: AccessBadgeTickerService;
  logService: LogService;
};

/**
 * When another member holds `cipherId`'s single-active-lease slot, the time it frees; `null` while
 * the caller may start. Every Start access entry point reads this so it can disable the action
 * rather than let the server refuse it. Re-read on every access change, once the slot should have
 * freed, and every {@link SLOT_RECHECK_INTERVAL_MS}, since nothing announces the holder ending
 * early. Fails open, since the server still refuses a start while the slot is taken.
 */
export function startBlockedUntil$(
  cipherId: string,
  deps: StartSlotDeps,
): Observable<string | null> {
  return merge(of(undefined), deps.accessRefreshService.accessChanged$(cipherId)).pipe(
    switchMap(() => slotTakenUntil$(cipherId, deps)),
  );
}

function slotTakenUntil$(cipherId: string, deps: StartSlotDeps): Observable<string | null> {
  return from(deps.accessRequestSdkService.preCheck(cipherId)).pipe(
    map((preCheck) => (preCheck.canStartLease === false ? (preCheck.slotFreesAt ?? null) : null)),
    catchError((e: unknown) => {
      deps.logService.error(e);
      return of(null);
    }),
    switchMap((freesAt) => {
      if (freesAt == null) {
        return of(null);
      }
      const recheckAtMs = Math.min(Date.parse(freesAt), Date.now() + SLOT_RECHECK_INTERVAL_MS);
      return concat(
        of(freesAt),
        deps.ticker.ticks$.pipe(
          filter((nowMs) => nowMs >= recheckAtMs),
          take(1),
          switchMap(() => slotTakenUntil$(cipherId, deps)),
        ),
      );
    }),
  );
}
