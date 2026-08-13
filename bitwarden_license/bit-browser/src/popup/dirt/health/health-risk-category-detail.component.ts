import { Component, ChangeDetectionStrategy, inject, computed, effect } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { map, switchMap } from "rxjs/operators";

import { IconComponent as AppVaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { CipherHealthView } from "@bitwarden/bit-common/dirt/access-intelligence/models/view/cipher-health.view";
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
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PasswordRepromptService } from "@bitwarden/vault";

import {
  HealthDeleteAtRiskItemDialogComponent,
  HealthDeleteAtRiskItemDialogData,
} from "./health-delete-at-risk-item-dialog.component";

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
    },
    [RiskCategory.Weak]: {
      titleKey: "weakPasswordsTitle",
      descriptionKey: "weakPasswordsDescription",
    },
    [RiskCategory.Reused]: {
      titleKey: "reusedPasswordsTitle",
      descriptionKey: "reusedPasswordsDescription",
    },
  };
}
