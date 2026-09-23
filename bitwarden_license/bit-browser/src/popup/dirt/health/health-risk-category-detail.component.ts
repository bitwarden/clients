import { CdkVirtualScrollViewport, ScrollingModule } from "@angular/cdk/scrolling";
import { Component, ChangeDetectionStrategy, inject, computed, effect } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { of } from "rxjs";
import { map, switchMap } from "rxjs/operators";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoCredentialsIcon, ReportExposedPasswords, LockIcon } from "@bitwarden/assets/svg";
import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
import {
  isRiskCategory,
  RiskCategory,
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportStatus,
} from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  ButtonModule,
  IconButtonModule,
  MenuModule,
  IconModule,
  DialogService,
  CenterPositionStrategy,
  StatusLockupComponent,
  SvgComponent,
  ScrollLayoutDirective,
  CompactModeService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

import {
  HealthDeleteAtRiskItemDialogComponent,
  HealthDeleteAtRiskItemDialogData,
} from "./health-delete-at-risk-item-dialog.component";
import { HealthScanErrorComponent } from "./health-scan-error.component";
import { HealthScanningComponent } from "./health-scanning.component";
import { HealthScanService } from "./services/health-scan.service";

const HEALTH_OVERVIEW_ROUTE = "/tabs/health";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-risk-category-detail",
  templateUrl: "./health-risk-category-detail.component.html",
  imports: [
    ItemModule,
    TypographyModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    SectionComponent,
    SectionHeaderComponent,
    ButtonModule,
    IconButtonModule,
    AppVaultIconComponent,
    I18nPipe,
    MenuModule,
    IconModule,
    StatusLockupComponent,
    SvgComponent,
    HealthScanningComponent,
    HealthScanErrorComponent,
    ScrollingModule,
    CdkVirtualScrollViewport,
    ScrollLayoutDirective,
  ],
})
export class HealthRiskCategoryDetailComponent {
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly accountService = inject(AccountService);
  readonly cipherService = inject(CipherService);
  readonly changeLoginPasswordService = inject(ChangeLoginPasswordService);
  readonly passwordRepromptService = inject(PasswordRepromptService);
  readonly platformUtilsService = inject(PlatformUtilsService);
  readonly vaultHealthReportService = inject(VaultHealthReportService);
  readonly dialogService = inject(DialogService);
  private readonly healthScanService = inject(HealthScanService);
  private readonly compactModeService = inject(CompactModeService);

  readonly category = toSignal<RiskCategory>(
    this.route.params.pipe(map((params) => params["category"])),
  );

  /** A category the route does not name, or names wrongly. The only reason to leave. */
  protected readonly invalidCategory = computed(() => !isRiskCategory(this.category()));

  protected readonly rowSize = toSignal<number>(
    this.compactModeService.enabled$.pipe(map((enabled) => (enabled ? 53 : 59))),
  );

  private readonly userId = toSignal(
    this.accountService.activeAccount$.pipe(map((account) => account?.id)),
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

  /**
   * The report to render. Unlike the Health Overview this does not gate on `success`:
   * a vault-change refresh never publishes `loading`, and a scan only runs here when
   * there is no report to keep on screen.
   */
  readonly report = computed(() => this.scanState().report);

  protected readonly loading = computed(
    () => this.scanState().status === VaultHealthReportStatus.Loading,
  );

  protected readonly scanFailed = computed(
    () => this.scanState().status === VaultHealthReportStatus.Error || this.pipelineFailed(),
  );

  constructor() {
    effect(() => {
      // A missing report is no longer a reason to leave: this page can be opened
      // directly, or restored by the popup, and runs its own scan.
      if (this.invalidCategory()) {
        void this.router.navigate([HEALTH_OVERVIEW_ROUTE]);
      }
    });

    // Scans only when no report is on hand, then keeps it current. Skipped while
    // navigating away from a category that does not exist.
    toObservable(computed(() => (this.invalidCategory() ? undefined : this.userId())))
      .pipe(
        filterOutNullish(),
        switchMap((userId) => this.healthScanService.keepReportCurrent$(userId)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  readonly items = computed(() => {
    const category = this.category();
    const report = this.report();
    if (!category || !report) {
      return [];
    }

    return report.categoryItems[category] ?? [];
  });
  readonly cipherMap = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
      filterOutNullish(),
      map((ciphers) => new Map<string, CipherView>(ciphers.map((cipher) => [cipher.id, cipher]))),
    ),
    { initialValue: new Map<string, CipherView>() },
  );
  readonly rows = computed(() => {
    const items = this.items();
    const cipherMap = this.cipherMap();
    return items
      .map((item) => ({
        health: item,
        cipher: cipherMap.get(item.cipherId),
      }))
      .filter((row) => row.cipher != null);
  });

  protected readonly trackByCipherId = (
    _: number,
    row: { health: CipherHealthView; cipher: CipherView },
  ) => row.health.cipherId;

  protected readonly handleRetry = () => {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    this.healthScanService.retryScan(userId);
  };

  readonly onChangePassword = async (item: CipherView) => {
    const changePasswordUrl = await this.changeLoginPasswordService.getChangePasswordUrl(item);
    if (changePasswordUrl != null) {
      this.platformUtilsService.launchUri(changePasswordUrl);
    }
  };

  readonly onItemClick = async (item: CipherView) => {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(item);
    if (!repromptPassed) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: item.id, type: item.type },
    });
  };

  readonly onDeleteItem = async (health: CipherHealthView, cipher: CipherView) => {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }

    await this.dialogService.open(HealthDeleteAtRiskItemDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
      data: {
        item: health,
        currentCategory: this.category()!,
      } satisfies HealthDeleteAtRiskItemDialogData,
    });
  };

  readonly HEALTH_DETAIL_CONTENTS = {
    [RiskCategory.Exposed]: {
      titleKey: "exposedPasswordsTitle",
      descriptionKey: "exposedPasswordsDescription",
      emptyKey: "exposedPasswordsEmpty",
      emptyIcon: ReportExposedPasswords,
    },
    [RiskCategory.Weak]: {
      titleKey: "weakPasswordsTitle",
      descriptionKey: "weakPasswordsDescription",
      emptyKey: "weakPasswordEmpty",
      emptyIcon: LockIcon,
    },
    [RiskCategory.Reused]: {
      titleKey: "reusedPasswordsTitle",
      descriptionKey: "reusedPasswordsDescription",
      emptyKey: "reusedPasswordEmpty",
      emptyIcon: NoCredentialsIcon,
    },
  };
}
