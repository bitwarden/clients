import { Injectable, inject } from "@angular/core";
import {
  catchError,
  defer,
  EMPTY,
  expand,
  filter,
  map,
  merge,
  Observable,
  of,
  switchMap,
  take,
} from "rxjs";

import { AccessRefreshService, AccessRequestSdkService } from "@bitwarden/bit-pam";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

/** How often a taken single-active-lease slot is re-read, so an early end re-enables Start access. */
const SLOT_RECHECK_INTERVAL_MS = 60_000;

/**
 * Another member holds the single-active-lease slot. `freesAt` is when their lease ends, or `null`
 * when the server does not say.
 */
export type StartBlock = { freesAt: string | null };

/**
 * Whether the caller may start access on a cipher right now, for every Start access entry point to
 * disable the action rather than let the server refuse it.
 */
@Injectable({ providedIn: "root" })
export class StartSlotService {
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly ticker = inject(AccessBadgeTickerService);

  /**
   * The block on `cipherId`'s single-active-lease slot, or `null` while it is free. Re-read on
   * every access change, once the slot should have freed, and every
   * {@link SLOT_RECHECK_INTERVAL_MS}, since nothing announces the holder ending early. Fails open,
   * since the server still refuses a start while the slot is taken.
   */
  blockedUntil$(cipherId: string): Observable<StartBlock | null> {
    return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
      switchMap(() => this.readUntilFree$(cipherId)),
    );
  }

  /** Reads, then re-reads while the slot stays taken. `expand` keeps the chain flat. */
  private readUntilFree$(cipherId: string): Observable<StartBlock | null> {
    const read$ = defer(() => this.accessRequestSdkService.preCheck(cipherId)).pipe(
      map((preCheck): StartBlock | null =>
        preCheck.canStartLease === false ? { freesAt: preCheck.slotFreesAt ?? null } : null,
      ),
      // `preCheck` logs its own failure.
      catchError(() => of(null)),
    );
    return read$.pipe(
      expand((block) => {
        if (block == null) {
          return EMPTY;
        }
        const recheckAtMs = nextRecheckMs(block, Date.now());
        return this.ticker.ticks$.pipe(
          filter((nowMs) => nowMs >= recheckAtMs),
          take(1),
          switchMap(() => read$),
        );
      }),
    );
  }
}

/**
 * When the slot frees, if that is still ahead and within the interval; otherwise the interval, so
 * a missing, unparseable or already-passed end never re-reads every tick or never again.
 */
function nextRecheckMs(block: StartBlock, nowMs: number): number {
  const intervalMs = nowMs + SLOT_RECHECK_INTERVAL_MS;
  const freesAtMs = block.freesAt == null ? NaN : Date.parse(block.freesAt);
  return Number.isNaN(freesAtMs) || freesAtMs <= nowMs
    ? intervalMs
    : Math.min(freesAtMs, intervalMs);
}
