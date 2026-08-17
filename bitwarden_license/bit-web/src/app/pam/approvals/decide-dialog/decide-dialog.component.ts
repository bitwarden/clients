import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";

import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessDecisionVerdict } from "../../abstractions/access-lease";
import { ApprovalRow } from "../approval-row";

export type DecideDialogParams = {
  verdict: AccessDecisionVerdict;
  row: ApprovalRow;
};

/** Only an explicit confirm produces a result; every other way out closes with `undefined`. */
export type DecideDialogResult = { confirmed: true; comment: string | undefined };

/**
 * Confirms an approve or deny and collects an optional comment.
 *
 * A summary of what is being decided — requester, window, reason — is repeated here rather than
 * assumed remembered from the row behind the dialog, because approving the wrong request grants real
 * access to a real secret and the row that was clicked may already have scrolled out of view.
 *
 * The comment is optional on BOTH verdicts and trims to `undefined`, so a whitespace-only note is not
 * written to the audit log as if it said something. The dialog makes no API call: it returns the
 * decision and the caller records it, which keeps the retry-and-toast logic in one place.
 */
@Component({
  selector: "pam-decide-dialog",
  templateUrl: "./decide-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    FormFieldModule,
    ReactiveFormsModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class DecideDialogComponent {
  private readonly dialogRef = inject<DialogRef<DecideDialogResult | undefined>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly params = inject<DecideDialogParams>(DIALOG_DATA);

  /**
   * A group for one control, because `[bitSubmit]` only matches a form that has one — and that is
   * what gives the confirm button its busy state and serialises re-entrant clicks.
   */
  protected readonly formGroup = this.formBuilder.nonNullable.group({ comment: [""] });

  protected readonly approve = this.params.verdict === "approve";
  protected readonly row = this.params.row;

  protected readonly confirm = async (): Promise<void> => {
    const comment = this.formGroup.getRawValue().comment.trim();
    void this.dialogRef.close({
      confirmed: true,
      comment: comment.length > 0 ? comment : undefined,
    });
  };

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
