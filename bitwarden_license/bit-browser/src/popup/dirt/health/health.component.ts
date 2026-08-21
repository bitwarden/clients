import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  effect,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { EMPTY, Observable, catchError, defer, filter, map, of, switchMap, take } from "rxjs";

import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportStatus,
} from "@bitwarden/bit-common/dirt/vault-health/models";
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

  /** The latest report for the active user and where its generation got to. */
  private readonly scanState = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId
          ? this.vaultHealthReportService.getVaultHealthReport$(userId)
          : of(VAULT_HEALTH_REPORT_IDLE),
      ),
    ),
    { initialValue: VAULT_HEALTH_REPORT_IDLE },
  );

  /**
   * The user whose ciphers fetch failed, if any. Scoped to a user so a failure
   * for one account does not pin the failure view on the next after a switch;
   * this failure never reaches the service, so it is tracked here rather than in
   * the per-user state stream.
   */
  private readonly pipelineFailedFor = signal<UserId | null>(null);

  /** True when the scan did not complete: the service published an error, or the ciphers fetch failed. */
  protected readonly scanFailed = computed(
    () =>
      this.scanState().status === VaultHealthReportStatus.Error ||
      this.pipelineFailedFor() === this.userId(),
  );

  /** The completed report, or null while generating or after a failure. */
  protected readonly report = computed(() => {
    const state = this.scanState();
    return state.status === VaultHealthReportStatus.Success ? state.report : null;
  });

  constructor() {
    // Triggers the scan. Reading happens through scanState above.
    toObservable(this.userId)
      .pipe(
        filterOutNullish(),
        switchMap((userId) =>
          this.healthAccessService.hasRunHealthScan$(userId).pipe(
            // First visit waits for the intro's "Scan my vault"; later visits are
            // already true. take(1) keeps it to one trigger per popup open.
            filter(Boolean),
            take(1),
            // Reuse guard (load-bearing): back-navigation re-creates this
            // component, so only build when the service holds nothing or a
            // failure for this user. Without it every back press rescans.
            switchMap(() =>
              this.vaultHealthReportService.getVaultHealthReport$(userId).pipe(
                take(1),
                filter(
                  (state) =>
                    state.status === VaultHealthReportStatus.Idle ||
                    state.status === VaultHealthReportStatus.Error,
                ),
                switchMap(() => this.startGeneration$(userId)),
              ),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();

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

  /** Runs one report build for `userId`. Never errors: the service publishes its own failures. */
  private startGeneration$(userId: UserId): Observable<unknown> {
    // A fresh build clears any prior ciphers failure for this user, so a later
    // success is not masked by the failure view from an earlier attempt.
    this.pipelineFailedFor.set(null);
    return this.cipherService.cipherViews$(userId).pipe(
      // cipherViews$ may emit null when decrypted ciphers are cleared.
      filterOutNullish(),
      // Generation does an external breach lookup; a vault edit must not re-run it.
      take(1),
      switchMap((ciphers) =>
        defer(() => this.vaultHealthReportService.buildVaultHealthReport(ciphers, userId)),
      ),
      catchError((error: unknown) => {
        // A cipherViews$ failure never reaches the service, so surface it here for
        // this user and log it.
        this.pipelineFailedFor.set(userId);
        this.logService.error("Vault health scan pipeline failed", error);
        return EMPTY;
      }),
    );
  }
}
