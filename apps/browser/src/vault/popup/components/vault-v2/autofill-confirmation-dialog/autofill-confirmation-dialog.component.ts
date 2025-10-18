import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  ButtonModule,
  DialogService,
  DialogModule,
  TypographyModule,
  CalloutComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export interface AutofillConfirmationDialogParams {
  currentUrl: string | null;
}

export const AutofillConfirmationDialogResult = Object.freeze({
  AutofillAndUrlAdded: "added",
  AutofilledOnly: "autofilled",
  Canceled: "canceled",
} as const);

export type AutofillConfirmationDialogResultType = UnionOfValues<
  typeof AutofillConfirmationDialogResult
>;

@Component({
  templateUrl: "./autofill-confirmation-dialog.component.html",
  imports: [CalloutComponent, CommonModule, ButtonModule, I18nPipe, DialogModule, TypographyModule],
})
export class AutofillConfirmationDialogComponent {
  AutofillConfirmationDialogResult = AutofillConfirmationDialogResult;
  currentUrl: string | null = null;

  constructor(
    @Inject(DIALOG_DATA) protected params: AutofillConfirmationDialogParams,
    private dialogRef: DialogRef,
  ) {
    this.currentUrl = params.currentUrl;
  }

  protected close = () => {
    this.dialogRef.close(AutofillConfirmationDialogResult.Canceled);
  };

  protected autofillAndAddUrl = () => {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofillAndUrlAdded);
  };

  protected autofillOnly = () => {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofilledOnly);
  };

  static open(
    dialogService: DialogService,
    config: DialogConfig<AutofillConfirmationDialogParams>,
  ) {
    return dialogService.open<AutofillConfirmationDialogResultType>(
      AutofillConfirmationDialogComponent,
      { ...config },
    );
  }
}
