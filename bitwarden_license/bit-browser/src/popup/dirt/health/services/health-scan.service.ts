import { inject, Injectable } from "@angular/core";
import {
  BehaviorSubject,
  catchError,
  concat,
  concatMap,
  debounceTime,
  defer,
  EMPTY,
  map,
  merge,
  Observable,
  of,
  Subject,
  switchMap,
  take,
  tap,
} from "rxjs";

import { VaultHealthReportStatus } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";

/**
 * How long a burst of vault changes is allowed to settle before the report is
 * brought up to date. A sync rewrites many ciphers across several ticks, and each
 * rebuild can cost a breach lookup per login, so they are collapsed into one.
 */
const VAULT_CHANGE_DEBOUNCE_MS = 300;

/**
 * Decides *when* the browser Health views recompute their report;
 * {@link VaultHealthReportService} owns *what* the report is.
 *
 * Everything is cold and scoped to the subscriber: a Health view subscribes on
 * mount and the vault watch stops when the last one goes away, so no work happens
 * while the user is elsewhere in the popup. Nothing here throws — a scan failure
 * arrives as a published report status or on {@link pipelineFailed$}.
 */
@Injectable({ providedIn: "root" })
export class HealthScanService {
  private readonly cipherService = inject(CipherService);
  private readonly reportService = inject(VaultHealthReportService);
  private readonly logService = inject(LogService);

  /**
   * Per user, because this service outlives an account switch: a retry or a failure
   * must never reach the account the user just left.
   */
  private readonly retries = new Map<UserId, Subject<void>>();
  private readonly pipelineFailures = new Map<UserId, BehaviorSubject<boolean>>();

  /**
   * Runs a full scan, breach lookups included, then keeps the report current until
   * the caller unsubscribes. For a view that is expected to rescan on every load.
   */
  runScan$(userId: UserId): Observable<void> {
    return this.keepCurrent$(userId, of(true));
  }

  /**
   * Keeps the report current until the caller unsubscribes, running a full scan
   * first only when there is no report yet. For a view that can be opened directly,
   * such as a route the popup restored, and that must not repeat the breach lookups
   * when the user simply navigated in from the Health Overview.
   */
  ensureScan$(userId: UserId): Observable<void> {
    return this.keepCurrent$(userId, this.needsScan$(userId));
  }

  /** Requests another full scan. Only `userId`'s subscribed scan reacts. */
  retryScan(userId: UserId): void {
    this.retriesFor(userId).next();
  }

  /**
   * True when fetching the ciphers to scan failed. That failure happens before the
   * report service is reached, so it cannot surface as a published `error` status.
   * Cleared at the start of every scan.
   */
  pipelineFailed$(userId: UserId): Observable<boolean> {
    return this.pipelineFailedFor(userId).asObservable();
  }

  private keepCurrent$(userId: UserId, scanFirst$: Observable<boolean>): Observable<void> {
    return scanFirst$.pipe(
      switchMap((scanFirst) =>
        // switchMap, not exhaustMap: a retry has to restart both halves, and
        // exhaustMap over a concat whose tail never completes would drop it forever.
        merge(of(scanFirst), this.retriesFor(userId).pipe(map(() => true))).pipe(
          switchMap((runFullScan) =>
            // The watch must not start until the scan has published, or a change
            // landing mid-scan finds no baseline to compare against, is treated as
            // handled, and is then lost because cipherViews$ will not re-emit.
            concat(runFullScan ? this.fullScan$(userId) : EMPTY, this.refreshes$(userId)),
          ),
        ),
      ),
    );
  }

  /** Whether there is no report to keep current yet. */
  private needsScan$(userId: UserId): Observable<boolean> {
    return this.reportService.getVaultHealthReport$(userId).pipe(
      take(1),
      map((state) => state.report == null && state.status !== VaultHealthReportStatus.Loading),
    );
  }

  private fullScan$(userId: UserId): Observable<void> {
    return this.cipherService.cipherViews$(userId).pipe(
      // Clears any prior ciphers failure so a later success is not masked by it.
      tap({ subscribe: () => this.pipelineFailedFor(userId).next(false) }),
      // cipherViews$ can emit null to a fresh subscriber while decryption is still
      // running. Scanning that would report a permanently healthy vault.
      filterOutNullish(),
      // One scan per trigger; keeping the report current is refreshes$'s job.
      take(1),
      switchMap((ciphers) =>
        defer(() => this.reportService.buildVaultHealthReport(ciphers, userId)),
      ),
      catchError((error: unknown) => {
        this.pipelineFailedFor(userId).next(true);
        this.logService.error("Vault health scan pipeline failed", error);
        return EMPTY;
      }),
    );
  }

  private refreshes$(userId: UserId): Observable<void> {
    return this.cipherService.cipherViews$(userId).pipe(
      filterOutNullish(),
      debounceTime(VAULT_CHANGE_DEBOUNCE_MS),
      // concatMap, not switchMap: a superseded refresh still resolves and could
      // publish a stale report late. Not exhaustMap: that drops the newest change.
      concatMap((ciphers) =>
        defer(() => this.reportService.refreshVaultHealthReport(ciphers, userId)),
      ),
      catchError((error: unknown) => {
        // Deliberately does not set pipelineFailed: a background failure must not
        // put a failure view over results the user is already reading.
        this.logService.error("Vault health refresh pipeline failed", error);
        return EMPTY;
      }),
    );
  }

  private retriesFor(userId: UserId): Subject<void> {
    let retry = this.retries.get(userId);
    if (retry == null) {
      retry = new Subject<void>();
      this.retries.set(userId, retry);
    }
    return retry;
  }

  private pipelineFailedFor(userId: UserId): BehaviorSubject<boolean> {
    let failed = this.pipelineFailures.get(userId);
    if (failed == null) {
      failed = new BehaviorSubject<boolean>(false);
      this.pipelineFailures.set(userId, failed);
    }
    return failed;
  }
}
