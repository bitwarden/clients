import { DIALOG_DATA } from "@angular/cdk/dialog";
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  ButtonModule,
  CardComponent,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  IconTileComponent,
  IconTileVariant,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type RiskConfirmationDialogData = {
  titleKey: string;
  descriptionKey: string;
  acceptButtonKey: string;
  acceptButtonType: "primary" | "danger";
  risks: {
    exposedBreaches: number;
    reuseCount: number;
    weak: boolean;
  };
};

export const RiskConfirmationDialogResult = {
  Accepted: "accepted",
  Canceled: "canceled",
} as const;

export type RiskConfirmationDialogResult = UnionOfValues<typeof RiskConfirmationDialogResult>;

type RiskRow = {
  icon: "bwi-error" | "bwi-warning" | "bwi-refresh";
  variant: IconTileVariant;
  labelKey: string;
  valueLabel: string;
};

@Component({
  selector: "app-risk-confirmation-dialog",
  templateUrl: "./risk-confirmation-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DialogModule,
    ButtonModule,
    CardComponent,
    IconTileComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class RiskConfirmationDialogComponent {
  protected readonly titleKey: string;
  protected readonly descriptionKey: string;
  protected readonly acceptButtonKey: string;
  protected readonly acceptButtonType: "primary" | "danger";
  protected readonly riskRows: RiskRow[];

  constructor(
    private readonly dialogRef: DialogRef<RiskConfirmationDialogResult>,
    private readonly i18nService: I18nService,
    @Inject(DIALOG_DATA) data: RiskConfirmationDialogData,
  ) {
    this.titleKey = data.titleKey;
    this.descriptionKey = data.descriptionKey;
    this.acceptButtonKey = data.acceptButtonKey;
    this.acceptButtonType = data.acceptButtonType;
    this.riskRows = this.buildRiskRows(data.risks);
  }

  protected accept(): void {
    void this.dialogRef.close(RiskConfirmationDialogResult.Accepted);
  }

  protected cancel(): void {
    void this.dialogRef.close(RiskConfirmationDialogResult.Canceled);
  }

  private buildRiskRows(risks: RiskConfirmationDialogData["risks"]): RiskRow[] {
    const rows: RiskRow[] = [];
    const formatter = new Intl.NumberFormat(this.i18nService.translationLocale);

    if (risks.exposedBreaches > 0) {
      rows.push({
        icon: "bwi-error",
        variant: "danger",
        labelKey: "riskExposedLabel",
        valueLabel: this.i18nService.t("riskNTimes", formatter.format(risks.exposedBreaches)),
      });
    }
    if (risks.weak) {
      rows.push({
        icon: "bwi-warning",
        variant: "warning",
        labelKey: "weak",
        valueLabel: this.i18nService.t("yes"),
      });
    }
    // Callers fall back to `reuseCount: 1` when a cipher is missing from the
    // risk summary (see ReportsDetailComponent.confirmRiskAction), so 1 means
    // "not reused / unknown" and must not surface the reused row.
    if (risks.reuseCount > 1) {
      rows.push({
        icon: "bwi-refresh",
        variant: "primary",
        labelKey: "riskReusedLabel",
        valueLabel: this.i18nService.t("riskNTimes", formatter.format(risks.reuseCount)),
      });
    }
    return rows;
  }

  static open(dialogService: DialogService, data: RiskConfirmationDialogData) {
    return dialogService.open<RiskConfirmationDialogResult, RiskConfirmationDialogData>(
      RiskConfirmationDialogComponent,
      {
        data,
        positionStrategy: new CenterPositionStrategy(),
      },
    );
  }
}
