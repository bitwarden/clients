import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";

import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconModule,
  TypographyModule,
} from "@bitwarden/components";
import { AccessDecisionVerdict, AccessRequestDetailsResponse } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { durationLabel, reasonText, relativeStart } from "./approval-row";

export type DecideDialogParams = {
  /** Which decision is being confirmed; drives the title and confirm-button styling. */
  verdict: AccessDecisionVerdict;
  /** The request being decided — rendered as a summary card (names resolved from vault state). */
  request: AccessRequestDetailsResponse;
  /** Stable "now" reference for the relative window phrasing. */
  now: Date;
};

/**
 * Closed with this on an explicit confirm. Every other way of dismissing the dialog — the
 * Cancel button, the header X, a backdrop click, or Escape — closes with `undefined`, so the
 * `confirmed` flag is what tells the caller a decision was actually made.
 */
export type DecideDialogResult = { confirmed: true; comment: string | undefined };

/**
 * Confirm an approve/deny decision and capture an optional comment for the requester.
 *
 * The dialog never calls the API itself: it only returns the verdict's comment so the
 * parent can run the existing optimistic decision path (and roll back / toast on failure).
 */
@Component({
  selector: "app-pam-decide-dialog",
  templateUrl: "./decide-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    IconModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class DecideDialogComponent {
  protected readonly params = inject<DecideDialogParams>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<DecideDialogResult | undefined>>(DialogRef);

  protected readonly isApprove = this.params.verdict === AccessDecisionVerdict.Approve;

  private readonly request = this.params.request;
  protected readonly cipherName = this.request.cipherName ?? this.request.cipherId;
  protected readonly collectionName = this.request.collectionName;
  protected readonly requesterName = this.request.requesterName;
  protected readonly requesterEmail = this.request.requesterEmail;
  protected readonly duration = durationLabel(this.request);
  protected readonly start = relativeStart(this.request, this.params.now);
  protected readonly reason = reasonText(this.request);

  protected readonly commentControl = new FormControl<string>("", { nonNullable: true });

  protected confirm(): void {
    const comment = this.commentControl.value.trim();
    void this.dialogRef.close({
      confirmed: true,
      comment: comment.length > 0 ? comment : undefined,
    });
  }

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<DecideDialogParams>,
  ): DialogRef<DecideDialogResult | undefined> {
    return dialogService.open<DecideDialogResult | undefined, DecideDialogParams>(
      DecideDialogComponent,
      config,
    );
  }
}
