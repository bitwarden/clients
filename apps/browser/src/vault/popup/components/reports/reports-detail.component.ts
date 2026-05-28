import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, firstValueFrom, map, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { AlertExclusionId, CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { AlertExclusionService } from "@bitwarden/common/vault/alert-exclusions";
import { CipherRiskTypes } from "@bitwarden/common/vault/enums/cipher-risk-types";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { filterOutNullish } from "@bitwarden/common/vault/utils/observable-utilities";
import {
  ButtonModule,
  DialogService,
  IconButtonModule,
  ItemModule,
  MenuModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  ChangeLoginPasswordService,
  DefaultChangeLoginPasswordService,
  PasswordRepromptService,
} from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../../auth/popup/account-switching/current-account.component";
import { BrowserApi } from "../../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { PopupRouterCacheService } from "../../../../platform/popup/view-cache/popup-router-cache.service";
import { PersonalVaultAlertService } from "../../services/personal-vault-alert.service";

import {
  RiskConfirmationDialogComponent,
  RiskConfirmationDialogData,
  RiskConfirmationDialogResult,
} from "./risk-confirmation-dialog/risk-confirmation-dialog.component";

export const ReportType = Object.freeze({
  Exposed: "exposed",
  Weak: "weak",
  Reused: "reused",
} as const);
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

const REPORT_COPY: Record<ReportType, { titleKey: string; descKey: string }> = {
  [ReportType.Exposed]: {
    titleKey: "exposedPasswords",
    descKey: "exposedPasswordsDetailDesc",
  },
  [ReportType.Weak]: {
    titleKey: "weakPasswords",
    descKey: "weakPasswordsDetailDesc",
  },
  [ReportType.Reused]: {
    titleKey: "reusedPasswords",
    descKey: "reusedPasswordsDetailDesc",
  },
};

function isReportType(value: unknown): value is ReportType {
  return Object.values(ReportType).includes(value as ReportType);
}

@Component({
  selector: "app-reports-detail",
  templateUrl: "./reports-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CurrentAccountComponent,
    ButtonModule,
    IconButtonModule,
    ItemModule,
    MenuModule,
    TypographyModule,
  ],
  providers: [{ provide: ChangeLoginPasswordService, useClass: DefaultChangeLoginPasswordService }],
})
export class ReportsDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly alertService = inject(PersonalVaultAlertService);
  private readonly exclusionService = inject(AlertExclusionService);
  private readonly changePasswordService = inject(ChangeLoginPasswordService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly cipherService = inject(CipherService);
  private readonly toastService = inject(ToastService);
  private readonly popupRouterCacheService = inject(PopupRouterCacheService);

  protected readonly excludedOpen = signal(false);

  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId, filterOutNullish());

  protected readonly data$ = this.route.data.pipe(
    map((data): { type: ReportType; titleKey: string; descKey: string } | null => {
      const type = data["type"];
      if (!isReportType(type)) {
        void this.router.navigate(["/tabs/reports"]);
        return null;
      }
      return { type, ...REPORT_COPY[type] };
    }),
    filterOutNullish(),
  );

  protected readonly ciphers$ = combineLatest([this.alertService.summary$, this.data$]).pipe(
    map(([summary, { type }]) => summary[type] as CipherView[]),
  );

  private readonly rawCiphersForType$ = combineLatest([
    this.alertService.rawSummary$,
    this.data$,
  ]).pipe(
    map(([summary, { type }]) => new Map((summary[type] as CipherView[]).map((c) => [c.id, c]))),
  );

  private readonly exclusions$ = this.userId$.pipe(
    switchMap((userId) => this.exclusionService.exclusions$(userId)),
  );

  protected readonly excludedItems$ = combineLatest([
    this.exclusions$,
    this.rawCiphersForType$,
  ]).pipe(
    map(([exclusions, cipherMap]) =>
      exclusions
        .filter((e) => cipherMap.has(e.cipherId))
        .map((e) => ({ exclusion: e, cipher: cipherMap.get(e.cipherId)! })),
    ),
  );

  async viewCipher(cipher: CipherView): Promise<void> {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }
    await this.router.navigate(["/view-cipher"], {
      queryParams: { cipherId: cipher.id, type: cipher.type },
    });
  }

  async changePassword(cipher: CipherView): Promise<void> {
    const url = await this.changePasswordService.getChangePasswordUrl(cipher);
    if (!url) {
      return;
    }
    // Clear before launching: the new tab steals focus and the popup is torn down,
    // so anything awaited after launchUri may not flush. Clearing first ensures the
    // next popup open lands on /tabs/vault for autofill, not back on this health page.
    await this.popupRouterCacheService.setHistory([]);
    await BrowserApi.sendMessage("bgQueueChangePasswordReminder", { url });
  }

  async exclude(rawCipherId: string): Promise<void> {
    const cipherId = rawCipherId as CipherId;
    const accepted = await this.confirmRiskAction(cipherId, {
      titleKey: "excludeThisRisk",
      descriptionKey: "excludeThisRiskDesc",
      acceptButtonKey: "yesExcludeRisk",
      acceptButtonType: "primary",
    });
    if (!accepted) {
      return;
    }
    const userId = await firstValueFrom(this.userId$);
    const riskTypes = await this.currentRiskTypesMask(cipherId);
    await this.exclusionService.exclude(cipherId, userId, riskTypes);
  }

  private async currentRiskTypesMask(cipherId: CipherId): Promise<number> {
    const summary = await firstValueFrom(this.alertService.rawSummary$);
    const counts = summary.riskCounts.get(cipherId);
    if (counts == null) {
      return CipherRiskTypes.None;
    }
    let mask = CipherRiskTypes.None as number;
    if (counts.exposedBreaches > 0) {
      mask |= CipherRiskTypes.Exposed;
    }
    if (counts.weak) {
      mask |= CipherRiskTypes.Weak;
    }
    if (counts.reuseCount > 1) {
      mask |= CipherRiskTypes.Reused;
    }
    return mask;
  }

  private async confirmRiskAction(
    cipherId: CipherId,
    copy: Omit<RiskConfirmationDialogData, "risks">,
  ): Promise<boolean> {
    const summary = await firstValueFrom(this.alertService.rawSummary$);
    const counts = summary.riskCounts.get(cipherId) ?? {
      exposedBreaches: 0,
      reuseCount: 1,
      weak: false,
    };
    const result = await firstValueFrom(
      RiskConfirmationDialogComponent.open(this.dialogService, {
        ...copy,
        risks: {
          exposedBreaches: counts.exposedBreaches,
          reuseCount: counts.reuseCount,
          weak: counts.weak,
        },
      }).closed,
    );
    return result === RiskConfirmationDialogResult.Accepted;
  }

  async delete(cipher: CipherView): Promise<void> {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }
    const cipherId = cipher.id as CipherId;
    const accepted = await this.confirmRiskAction(cipherId, {
      titleKey: "deleteThisRisk",
      descriptionKey: "deleteThisItemDesc",
      acceptButtonKey: "yesDeleteItem",
      acceptButtonType: "danger",
    });
    if (!accepted) {
      return;
    }
    const userId = await firstValueFrom(this.userId$);
    await this.cipherService.softDeleteWithServer(cipherId, userId);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("deletedItem"),
    });
  }

  async removeExclusion(exclusionId: AlertExclusionId): Promise<void> {
    const userId = await firstValueFrom(this.userId$);
    await this.exclusionService.removeExclusion(exclusionId, userId);
  }

  toggleExcluded(): void {
    this.excludedOpen.update((v) => !v);
  }
}
