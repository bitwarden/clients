import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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
  LinkModule,
} from "@bitwarden/components";

export interface AutofillConfirmationDialogParams {
  savedUrls?: string[];
  currentUrl: string;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CalloutComponent,
    CommonModule,
    DialogModule,
    LinkModule,
    TypographyModule,
    JslibModule,
  ],
})
export class AutofillConfirmationDialogComponent {
  AutofillConfirmationDialogResult = AutofillConfirmationDialogResult;

  currentUrl: string = "";
  savedUrls: string[] = [];
  savedUrlsExpanded = false;

  constructor(
    @Inject(DIALOG_DATA) protected params: AutofillConfirmationDialogParams,
    private dialogRef: DialogRef,
  ) {
    this.currentUrl = Utils.getHostname(params.currentUrl);
    this.savedUrls =
      params.savedUrls?.map((url) => Utils.getHostname(url) ?? "").filter(Boolean) ?? [];
  }

  protected get savedUrlsListClass(): string {
    return this.savedUrlsExpanded
      ? ""
      : `tw-relative
         tw-max-h-24
         tw-overflow-hidden
         after:tw-pointer-events-none after:tw-content-['']
         after:tw-absolute after:tw-inset-x-0 after:tw-bottom-0
         after:tw-h-8 after:tw-bg-gradient-to-t
         after:tw-from-background after:tw-to-transparent
    `;
  }

  protected viewAllSavedUrls() {
    this.savedUrlsExpanded = true;
  }

  protected close() {
    this.dialogRef.close(AutofillConfirmationDialogResult.Canceled);
  }

  protected autofillAndAddUrl() {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofillAndUrlAdded);
  }

  protected autofillOnly() {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofilledOnly);
  }

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
