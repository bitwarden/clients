import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ButtonModule,
  DialogModule,
  TypographyModule,
  CalloutComponent,
  LinkModule,
} from "@bitwarden/components";

export interface AutofillConfirmationDialogParams {
  savedUrls?: string[];
  currentUrl: string;
  viewOnly?: boolean;
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
  private readonly params = inject<AutofillConfirmationDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef<AutofillConfirmationDialogResultType>);

  readonly currentUrl = signal<string>(Utils.getHostname(this.params.currentUrl));
  readonly savedUrls = signal<string[]>(
    (this.params.savedUrls ?? []).map((u) => Utils.getHostname(u) ?? "").filter(Boolean),
  );
  readonly viewOnly = signal<boolean>(this.params.viewOnly ?? false);
  readonly savedUrlsExpanded = signal<boolean>(false);

  readonly savedUrlsListClass = computed(() =>
    this.savedUrlsExpanded()
      ? ""
      : `tw-relative tw-max-h-24 tw-overflow-hidden after:tw-pointer-events-none
         after:tw-content-[''] after:tw-absolute after:tw-inset-x-0 after:tw-bottom-0
         after:tw-h-8 after:tw-bg-gradient-to-t after:tw-from-background after:tw-to-transparent`,
  );

  toggleSavedUrlExpandedState() {
    this.savedUrlsExpanded.update((v) => !v);
  }

  close() {
    this.dialogRef.close(AutofillConfirmationDialogResult.Canceled);
  }

  autofillAndAddUrl() {
    this.dialogRef.close(AutofillConfirmationDialogResult.AutofillAndUrlAdded);
  }

  autofillOnly() {
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
