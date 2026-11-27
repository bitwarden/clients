import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { filter, map, of, switchMap, take } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import {
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportStatus,
} from "@bitwarden/common/dirt/vault-health/models";
import {
  HealthScanService,
  VaultHealthReportService,
} from "@bitwarden/common/dirt/vault-health/services";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import { DialogService } from "@bitwarden/components";

import { DesktopHeaderComponent } from "../../app/layout/header";

import { HealthIntroComponent } from "./components/health-intro/health-intro.component";
import { HealthOverviewComponent } from "./components/health-overview/health-overview.component";
import { HealthScanErrorComponent } from "./components/health-scan-error/health-scan-error.component";
import { HealthScanningComponent } from "./components/health-scanning/health-scanning.component";
import { DesktopHealthAccessService } from "./desktop-health-access.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-health",
  templateUrl: "./health.component.html",
  imports: [
    DesktopHeaderComponent,
    HealthIntroComponent,
    HealthOverviewComponent,
    HealthScanningComponent,
    HealthScanErrorComponent,
  ],
})
export class HealthDesktopComponent {
  private readonly accountService = inject(AccountService);
  private readonly healthAccessService = inject(DesktopHealthAccessService);
  private readonly vaultHealthReportService = inject(VaultHealthReportService);
  private readonly healthScanService = inject(HealthScanService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly dialogService = inject(DialogService);

  private readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
  );

  protected readonly hasRunHealthScan = toSignal(
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

  /** Set when fetching the ciphers to scan fails, which never reaches the report service. */
  private readonly pipelineFailed = toSignal(
    toObservable(this.userId).pipe(
      switchMap((userId) => (userId ? this.healthScanService.pipelineFailed$(userId) : of(false))),
    ),
    { initialValue: false },
  );

  protected readonly loading = computed(
    () => this.scanState().status === VaultHealthReportStatus.Loading,
  );

  protected readonly scanFailed = computed(
    () => this.scanState().status === VaultHealthReportStatus.Error || this.pipelineFailed(),
  );

  protected readonly report = computed(() => {
    const state = this.scanState();
    return state.status === VaultHealthReportStatus.Success ? state.report : null;
  });

  private readonly injector = inject(Injector);
  private readonly viewRegion = viewChild<ElementRef<HTMLElement>>("viewRegion");

  constructor() {
    // When the result replaces the scanning view, the focused element is gone and
    // focus falls to the body. Park it on the view region instead.
    effect(() => {
      if (this.report() == null) {
        return;
      }
      afterNextRender(
        () => {
          const active = document.activeElement;
          if (active == null || active === document.body) {
            this.viewRegion()?.nativeElement.focus();
          }
        },
        { injector: this.injector },
      );
    });

    // Subscribed for the side effect; the report is read through scanState above.
    toObservable(this.userId)
      .pipe(
        filterOutNullish(),
        switchMap((userId) =>
          this.healthAccessService.hasRunHealthScan$(userId).pipe(
            // First visit waits for the intro's "Scan my vault"; later visits are
            // already true. take(1) keeps it to one automatic trigger per load.
            filter(Boolean),
            take(1),
            switchMap(() => this.healthScanService.keepReportCurrent$(userId)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected readonly handleUpgrade = () => {
    PremiumUpgradeDialogComponent.open(this.dialogService);
  };

  protected readonly handleHealthScan = async () => {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    await this.healthAccessService.setHasRunHealthScan(userId);
  };

  protected readonly handleRetry = () => {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    this.healthScanService.retryScan(userId);
  };
}
