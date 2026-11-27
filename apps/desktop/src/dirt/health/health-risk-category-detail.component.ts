import { ChangeDetectionStrategy, Component, computed, effect, inject } from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { map, of, switchMap } from "rxjs";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoCredentialsIcon, ReportExposedPasswords, LockIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherHealthView } from "@bitwarden/common/dirt/models/view";
import {
  isRiskCategory,
  RiskCategory,
  VAULT_HEALTH_REPORT_IDLE,
  VaultHealthReportStatus,
} from "@bitwarden/common/dirt/vault-health/models";
import {
  HealthScanService,
  VaultHealthReportService,
} from "@bitwarden/common/dirt/vault-health/services";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  ButtonModule,
  CenterPositionStrategy,
  DialogService,
  IconButtonModule,
  IconModule,
  ItemModule,
  LinkModule,
  MenuModule,
  SectionComponent,
  SectionHeaderComponent,
  StatusLockupComponent,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import {
  CipherFormConfigService,
  DefaultCipherFormConfigService,
  PasswordRepromptService,
  VaultItemDialogComponent,
} from "@bitwarden/vault";

import { DesktopHeaderComponent } from "../../app/layout/header";

import {
  HealthDeleteAtRiskItemDialogComponent,
  HealthDeleteAtRiskItemDialogData,
} from "./components/health-delete-at-risk-item-dialog/health-delete-at-risk-item-dialog.component";
import { HealthScanErrorComponent } from "./components/health-scan-error/health-scan-error.component";
import { HealthScanningComponent } from "./components/health-scanning/health-scanning.component";

const HEALTH_OVERVIEW_ROUTE = "/health";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-health-risk-category-detail",
  templateUrl: "./health-risk-category-detail.component.html",
  providers: [{ provide: CipherFormConfigService, useClass: DefaultCipherFormConfigService }],
  imports: [
    RouterModule,
    ItemModule,
    TypographyModule,
    DesktopHeaderComponent,
    SectionComponent,
    SectionHeaderComponent,
    ButtonModule,
    IconButtonModule,
    LinkModule,
    AppVaultIconComponent,
    I18nPipe,
    MenuModule,
    IconModule,
    StatusLockupComponent,
    SvgComponent,
    HealthScanningComponent,
    HealthScanErrorComponent,
  ],
})
export class HealthRiskCategoryDetailDesktopComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly accountService = inject(AccountService);
  private readonly cipherService = inject(CipherService);
  private readonly changeLoginPasswordService = inject(ChangeLoginPasswordService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly cipherFormConfigService = inject(CipherFormConfigService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly vaultHealthReportService = inject(VaultHealthReportService);
  private readonly dialogService = inject(DialogService);
  private readonly healthScanService = inject(HealthScanService);
  private readonly i18nService = inject(I18nService);

  protected readonly category = toSignal<RiskCategory>(
    this.route.params.pipe(map((params) => params["category"])),
  );

  protected readonly invalidCategory = computed(() => !isRiskCategory(this.category()));

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
   * The report to render. Unlike the overview this does not gate on `success`: a
   * vault-change refresh never publishes `loading`, and a scan only runs here when
   * there is no report to keep on screen.
   */
  protected readonly report = computed(() => this.scanState().report);

  protected readonly loading = computed(
    () => this.scanState().status === VaultHealthReportStatus.Loading,
  );

  protected readonly scanFailed = computed(
    () => this.scanState().status === VaultHealthReportStatus.Error || this.pipelineFailed(),
  );

  protected readonly HEALTH_DETAIL_CONTENTS = {
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

  protected readonly contentKeys = computed(() => {
    const category = this.category();
    return this.invalidCategory() || category == null
      ? undefined
      : this.HEALTH_DETAIL_CONTENTS[category];
  });

  protected readonly pageTitle = computed(() => {
    const titleKey = this.contentKeys()?.titleKey;
    return titleKey ? this.i18nService.t(titleKey) : "";
  });

  protected readonly items = computed(() => {
    const category = this.category();
    const report = this.report();
    if (!category || !report) {
      return [];
    }

    return report.categoryItems[category] ?? [];
  });

  private readonly cipherMap = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherService.cipherViews$(userId)),
      filterOutNullish(),
      map((ciphers) => new Map<string, CipherView>(ciphers.map((cipher) => [cipher.id, cipher]))),
    ),
    { initialValue: new Map<string, CipherView>() },
  );

  protected readonly rows = computed(() => {
    const cipherMap = this.cipherMap();
    return this.items()
      .map((item) => ({ health: item, cipher: cipherMap.get(item.cipherId) }))
      .filter((row): row is { health: CipherHealthView; cipher: CipherView } => row.cipher != null);
  });

  constructor() {
    effect(() => {
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

  protected readonly handleRetry = () => {
    const userId = this.userId();
    if (!userId) {
      return;
    }

    this.healthScanService.retryScan(userId);
  };

  protected readonly onChangePassword = async (item: CipherView) => {
    const changePasswordUrl = await this.changeLoginPasswordService.getChangePasswordUrl(item);
    if (changePasswordUrl != null) {
      this.platformUtilsService.launchUri(changePasswordUrl);
    }
  };

  protected readonly onItemClick = async (item: CipherView) => {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(item);
    if (!repromptPassed) {
      return;
    }
    const formConfig = await this.cipherFormConfigService.buildConfig(
      item.edit ? "edit" : "partial-edit",
      item.id as CipherId,
      item.type,
    );
    await VaultItemDialogComponent.openDrawer(this.dialogService, {
      mode: "view",
      formConfig,
    });
  };

  protected readonly onDeleteItem = async (health: CipherHealthView, cipher: CipherView) => {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }

    this.dialogService.open(HealthDeleteAtRiskItemDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
      data: {
        item: health,
        currentCategory: this.category()!,
      } satisfies HealthDeleteAtRiskItemDialogData,
    });
  };
}
