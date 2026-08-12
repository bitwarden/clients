import { Component, ChangeDetectionStrategy, inject, computed } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { map, switchMap } from "rxjs/operators";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { ReportExposedPasswords, NoCredentialsIcon, UnlockedIcon } from "@bitwarden/assets/svg";
import { RiskCategory } from "@bitwarden/bit-common/dirt/vault-health/models";
import { VaultHealthReportService } from "@bitwarden/bit-common/dirt/vault-health/services";
import { CurrentAccountComponent } from "@bitwarden/browser/auth/popup/account-switching/current-account.component";
import { PopOutComponent } from "@bitwarden/browser/platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "@bitwarden/browser/platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "@bitwarden/browser/platform/popup/layout/popup-page.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ChangeLoginPasswordService } from "@bitwarden/common/vault/abstractions/change-login-password.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  NoItemsModule,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  ButtonModule,
  IconButtonModule,
  SvgModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

/** The Health tab root, which owns running the scan this page renders. */
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
    SvgModule,
    NoItemsModule,
  ],
})
export class HealthRiskCategoryDetailComponent {
  readonly router = inject(Router);
  readonly route = inject(ActivatedRoute);
  readonly accountService = inject(AccountService);
  readonly changeLoginPasswordService = inject(ChangeLoginPasswordService);
  readonly passwordRepromptService = inject(PasswordRepromptService);
  readonly platformUtilsService = inject(PlatformUtilsService);
  readonly vaultHealthReportService = inject(VaultHealthReportService);

  readonly category = toSignal(this.route.params.pipe(map((params) => params["category"])));

  /** The report the overview's scan published for the active account. */
  private readonly report$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.vaultHealthReportService.getVaultHealthReport$(userId)),
  );

  readonly report = toSignal(this.report$, { initialValue: null });

  /** True once a scan result is available; the page renders nothing until then. */
  readonly hasReport = computed(() => this.report() != null);

  constructor() {
    // This page renders a report but never builds one, and it is reachable
    // without the overview having run a scan: the popup restores its last route
    // on open, and the published report is dropped on an account switch. Route
    // back to the overview, which owns triggering the scan, rather than
    // rendering a false all-clear.
    this.report$.pipe(takeUntilDestroyed()).subscribe((report) => {
      if (report == null) {
        void this.router.navigate([HEALTH_OVERVIEW_ROUTE]);
      }
    });
  }

  readonly items = computed(() => {
    const category = this.category();
    const report = this.report();
    if (!category || !report) {
      return [];
    }

    switch (category) {
      case RiskCategory.Exposed:
        return report.categoryItems.exposed;
      case RiskCategory.Weak:
        return report.categoryItems.weak;
      case RiskCategory.Reused:
        return report.categoryItems.reused;
      default:
        return [];
    }
  });
  readonly contentKeys = computed<{
    titleKey?: string;
    descriptionKey?: string;
    emptyKey?: string;
  }>(() => {
    const keys: { titleKey?: string; descriptionKey?: string; emptyKey?: string } = {};
    switch (this.category()) {
      case RiskCategory.Exposed:
        keys.titleKey = "exposedPasswordsTitle";
        keys.descriptionKey = "exposedPasswordsDescription";
        keys.emptyKey = "exposedPasswordsEmpty";
        break;
      case RiskCategory.Weak:
        keys.titleKey = "weakPasswordsTitle";
        keys.descriptionKey = "weakPasswordsDescription";
        keys.emptyKey = "weakPasswordsEmpty";
        break;
      case RiskCategory.Reused:
        keys.titleKey = "reusedPasswordsTitle";
        keys.descriptionKey = "reusedPasswordsDescription";
        keys.emptyKey = "reusedPasswordsEmpty";
        break;
    }
    return keys;
  });
  readonly emptyIcon = computed(() => {
    switch (this.category()) {
      case RiskCategory.Exposed:
        return ReportExposedPasswords;
      case RiskCategory.Weak:
        return UnlockedIcon;
      case RiskCategory.Reused:
        return NoCredentialsIcon;
    }
  });

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
}
