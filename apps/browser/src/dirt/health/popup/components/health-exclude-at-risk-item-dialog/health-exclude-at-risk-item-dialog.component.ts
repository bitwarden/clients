import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherHealthView } from "@bitwarden/common/dirt/models/view";
import { RiskCategory } from "@bitwarden/common/dirt/vault-health/models";
import { CipherReportExclusionService } from "@bitwarden/common/dirt/vault-health/services";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogRef,
  IconModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HealthAdditionalRisksComponent } from "../health-additional-risks/health-additional-risks.component";

export interface HealthExcludeAtRiskItemDialogData {
  currentCategory: RiskCategory;
  item: CipherHealthView;
}

/** Confirms and saves excluding a login from the health report. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "dirt-health-exclude-at-risk-item-dialog",
  templateUrl: "./health-exclude-at-risk-item-dialog.component.html",
  imports: [
    AsyncActionsModule,
    DialogModule,
    ButtonModule,
    IconModule,
    TypographyModule,
    I18nPipe,
    HealthAdditionalRisksComponent,
  ],
})
export class HealthExcludeAtRiskItemDialogComponent {
  private readonly accountService = inject(AccountService);
  private readonly cipherReportExclusionService = inject(CipherReportExclusionService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly dialogRef = inject(DialogRef);
  protected readonly data = inject<HealthExcludeAtRiskItemDialogData>(DIALOG_DATA);

  protected readonly onExclude = async () => {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherReportExclusionService.excludeWithServer(
      this.data.item.cipherId as CipherId,
      userId,
    );
    this.toastService.showToast({
      message: this.i18nService.t("itemExcludedFromList"),
      variant: "success",
    });
    await this.dialogRef.close();
  };
}
