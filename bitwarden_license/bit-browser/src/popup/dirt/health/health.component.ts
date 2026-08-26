import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  effect,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { EMPTY, Observable, catchError, defer, filter, map, of, switchMap, take, tap } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
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
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { DialogService } from "@bitwarden/components";
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
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly dialogService = inject(DialogService);

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

  /**
   * Whether Health details are locked behind Premium. Starts locked so a free
   * user never briefly sees navigable categories before the check resolves.
   */
  protected readonly locked = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) =>
        userId
          ? this.billingAccountProfileStateService
              .hasPremiumFromAnySource$(userId)
              .pipe(map((hasPremium) => !hasPremium))
          : of(true),
      ),
    ),
    { initialValue: true },
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

  /** Set when fetching the ciphers to scan fails, which never reaches the service. */
  private readonly pipelineFailed = signal(false);

  /** True while a scan is running, read from the service's published status. */
  protected readonly loading = computed(
    () => this.scanState().status === VaultHealthReportStatus.Loading,
  );

  /** True when the scan did not complete: the service published an error, or the ciphers fetch failed. */
  protected readonly scanFailed = computed(
    () => this.scanState().status === VaultHealthReportStatus.Error || this.pipelineFailed(),
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
            // already true. take(1) keeps it to one trigger per component load.
            filter(Boolean),
            take(1),
            // PM-39223: the scan runs on every Health Tab load with no caching.
            // The popup rebuilds this component on each navigation to Health (and
            // on return from a category detail), so there is no reuse guard here:
            // every load starts a fresh build.
            switchMap(() => this.startGeneration$(userId)),
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

  /** Sends a free user into the premium upgrade flow from the Health Overview. */
  protected readonly handleUpgrade = () => {
    PremiumUpgradeDialogComponent.open(this.dialogService);
  };

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
    return this.cipherService.cipherViews$(userId).pipe(
      // A fresh build clears the prior ciphers failure so a later success is not
      // masked by an earlier attempt's failure view. buildVaultHealthReport owns
      // publishing the loading status.
      tap({ subscribe: () => this.clearPipelineFailure() }),
      // cipherViews$ may emit null when decrypted ciphers are cleared.
      filterOutNullish(),
      // Generation does an external breach lookup; a vault edit must not re-run it.
      take(1),
      switchMap((ciphers) =>
        defer(() => this.vaultHealthReportService.buildVaultHealthReport(ciphers, userId)),
      ),
      catchError((error: unknown) => {
        // A cipherViews$ failure never reaches the service, so surface it here.
        this.recordPipelineFailure();
        this.logService.error("Vault health scan pipeline failed", error);
        return EMPTY;
      }),
    );
  }

  private recordPipelineFailure(): void {
    this.pipelineFailed.set(true);
  }

  private clearPipelineFailure(): void {
    this.pipelineFailed.set(false);
  }
}
