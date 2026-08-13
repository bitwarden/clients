import { Component, ChangeDetectionStrategy, inject, computed, effect } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { map, switchMap } from "rxjs/operators";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
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
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
  ButtonModule,
  IconButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

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

  readonly category = toSignal<RiskCategory>(
    this.route.params.pipe(map((params) => params["category"])),
  );
  readonly report = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.vaultHealthReportService.getVaultHealthReport$(userId)),
    ),
    { initialValue: null },
  );

  constructor() {
    effect(() => {
      // route back to overview when report isn't generated yet or category is invalid
      if (
        this.report() == null ||
        this.category() == undefined ||
        !Object.values(RiskCategory).includes(this.category()!)
      ) {
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
  }>(() => {
    const keys: { titleKey?: string; descriptionKey?: string } = {};
    switch (this.category()) {
      case RiskCategory.Exposed:
        keys.titleKey = "exposedPasswordsTitle";
        keys.descriptionKey = "exposedPasswordsDescription";
        break;
      case RiskCategory.Weak:
        keys.titleKey = "weakPasswordsTitle";
        keys.descriptionKey = "weakPasswordsDescription";
        break;
      case RiskCategory.Reused:
        keys.titleKey = "reusedPasswordsTitle";
        keys.descriptionKey = "reusedPasswordsDescription";
        break;
    }
    return keys;
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
