import { Component, ChangeDetectionStrategy, computed, inject, effect } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { Observable, catchError, filter, from, map, of, startWith, switchMap, take } from "rxjs";

import { VaultHealthReportView } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { I18nPipe } from "@bitwarden/ui-common";

import { HealthIntroComponent } from "./health-intro.component";
import { HealthOverviewComponent } from "./health-overview.component";
import { HealthScanErrorComponent } from "./health-scan-error.component";
import { HealthScanningComponent } from "./health-scanning.component";
import { HealthAccessService } from "./services/health-access.service";

/** Where the Health tab's vault scan is in its lifecycle. */
type HealthScanState =
  | { status: "scanning" }
  | { status: "success"; report: VaultHealthReportView }
  | { status: "error" };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health",
  templateUrl: "./health.component.html",
  imports: [
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    I18nPipe,
    HealthIntroComponent,
    HealthOverviewComponent,
    HealthScanningComponent,
    HealthScanErrorComponent,
  ],
})
export class HealthComponent {
  readonly accountService = inject(AccountService);
  readonly healthAccessService = inject(HealthAccessService);
  private readonly cipherService = inject(CipherService);
  private readonly vaultHealthReportService = inject(VaultHealthReportService);
  private readonly logService = inject(LogService);

  readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
  );
  readonly hasHealthBeenOpened = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId ? this.healthAccessService.healthHasBeenOpened$(userId) : of(false),
      ),
    ),
    { initialValue: false },
  );
  readonly hasRunHealthScan = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId ? this.healthAccessService.hasRunHealthScan$(userId) : of(false),
      ),
    ),
    { initialValue: false },
  );

  /** The vault scan's lifecycle, or null before it has been started. */
  private readonly scanState = toSignal<HealthScanState | null>(
    toObservable(this.userId).pipe(
      filterOutNullish(),
      switchMap((userId) =>
        this.healthAccessService.hasRunHealthScan$(userId).pipe(
          // On the first visit this waits for the intro's "Scan my vault"; on
          // every later visit it is already true, so the scan starts as soon as
          // the tab opens. take(1) keeps it to one scan per open.
          filter(Boolean),
          take(1),
          switchMap(() => this.runScan$(userId)),
          // Clears the previous account's result the moment the active account
          // changes, so switching users can never briefly show A's at-risk
          // counts to B while B's own scan is still starting.
          startWith<HealthScanState | null>(null),
        ),
      ),
    ),
    { initialValue: null },
  );

  /** True when the scan did not complete. */
  protected readonly scanFailed = computed(() => this.scanState()?.status === "error");

  /** The completed report, or null while scanning or after a failure. */
  protected readonly report = computed(() => {
    const state = this.scanState();
    return state?.status === "success" ? state.report : null;
  });

  constructor() {
    effect(async () => {
      const userId = this.userId();
      if (!userId) {
        return;
      }

      // mark state indicating the User has opened the Health tab
      if (!this.hasHealthBeenOpened()) {
        await this.healthAccessService.setHealthHasBeenOpened(userId);
      }
    });
  }

  readonly handleHealthScan = async () => {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    // mark state indicating the User has run a Health scan (i.e. completed the introduction CTA)
    await this.healthAccessService.setHasRunHealthScan(userId);
  };

  /**
   * Runs one vault scan, reporting progress first and then either the report or
   * a failure. Never errors — a failed scan is a state, not an exception, so the
   * tab can render the failure view instead of tearing down the pipeline.
   */
  private runScan$(userId: UserId): Observable<HealthScanState> {
    return this.cipherService.cipherViews$(userId).pipe(
      // cipherViews$ may emit null when decrypted ciphers are cleared.
      filterOutNullish(),
      // The scan does an external breach lookup; a vault edit must not re-run it.
      take(1),
      switchMap((ciphers) =>
        from(this.vaultHealthReportService.buildVaultHealthReport(ciphers, userId)).pipe(
          // The service publishes synchronously before the promise resolves, so
          // this read always sees the scan we just ran, never a stale one.
          switchMap(() =>
            this.vaultHealthReportService
              .getVaultHealthReport$(userId)
              .pipe(filterOutNullish(), take(1)),
          ),
        ),
      ),
      map((report): HealthScanState => ({ status: "success", report })),
      catchError((error: unknown): Observable<HealthScanState> => {
        this.logService.error("Vault health scan failed", error);
        return of({ status: "error" });
      }),
      startWith<HealthScanState>({ status: "scanning" }),
    );
  }
}
