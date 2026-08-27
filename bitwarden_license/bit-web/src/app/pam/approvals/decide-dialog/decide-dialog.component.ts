import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";

import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
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
import { RequestSummaryComponent } from "../../request-summary/request-summary.component";
import { ApprovalRow } from "../approval-row";

export type DecideDialogParams = {
  /** The verdict the inbox button asked for; the approver can still switch it here. */
  verdict: AccessDecisionVerdict;
  row: ApprovalRow;
  /** The decrypted gated cipher, for the item card's favicon; absent when the approver cannot see it. */
  cipher?: CipherViewLike;
};

/**
 * Only an explicit confirm produces a result; every other way out closes with `undefined`.
 *
 * `verdict` is the one the approver landed on, which is NOT necessarily the one the dialog was
 * opened with — the approve variant can be switched to deny in place. Callers must record this
 * verdict rather than the one they passed.
 */
export type DecideDialogResult = {
  confirmed: true;
  verdict: AccessDecisionVerdict;
  comment: string | undefined;
};

/**
 * Confirms an approve or deny and collects the approver's note.
 *
 * A summary of what is being decided — item, requester, window, reason — is repeated here rather
 * than assumed remembered from the row behind the dialog, because approving the wrong request
 * grants real access to a real secret and the row that was clicked may already have scrolled out of
 * view. It is rendered by the shared {@link RequestSummaryComponent}, the same one
 * `/pam/requests/:id` uses, so the two surfaces cannot describe a request differently.
 *
 * The verdict is dialog state, not a fixed parameter: the approve variant offers "Deny request",
 * which switches this dialog to the deny variant instead of closing and reopening. Denying requires
 * a reason; approving keeps the comment optional and trims a whitespace-only note to `undefined`,
 * so it is not written to the audit log as if it said something. The dialog makes no API call: it
 * returns the decision and the caller records it, which keeps the retry-and-toast logic in one place.
 */
@Component({
  selector: "pam-decide-dialog",
  templateUrl: "./decide-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CardComponent,
    DialogModule,
    FormFieldModule,
    ReactiveFormsModule,
    TypographyModule,
    RequestSummaryComponent,
    I18nPipe,
  ],
})
export class DecideDialogComponent {
  private readonly dialogRef = inject<DialogRef<DecideDialogResult | undefined>>(DialogRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly commentField = viewChild<ElementRef<HTMLTextAreaElement>>("commentField");
  protected readonly params = inject<DecideDialogParams>(DIALOG_DATA);

  /**
   * A group for one control, because `[bitSubmit]` only matches a form that has one — and that is
   * what gives the confirm button its busy state and serialises re-entrant clicks.
   */
  protected readonly formGroup = this.formBuilder.nonNullable.group({ comment: [""] });

  protected readonly verdict = signal<AccessDecisionVerdict>(this.params.verdict);
  protected readonly approve = computed(() => this.verdict() === "approve");
  protected readonly row = this.params.row;
  protected readonly cipher = this.params.cipher ?? null;

  private readonly comment = toSignal(this.formGroup.controls.comment.valueChanges, {
    initialValue: "",
  });

  /**
   * `Validators.required` accepts a string of spaces, so the button is gated on the trimmed value
   * as well — a denial whose only recorded reason is whitespace explains nothing to the requester.
   */
  protected readonly confirmDisabled = computed(
    () => !this.approve() && this.comment().trim().length === 0,
  );

  constructor() {
    this.applyVerdictValidators();
  }

  /**
   * The button that triggers this lives inside the approve-only branch, so the click destroys the
   * focused element and focus would otherwise fall to `<body>`. Focus moves after the re-render so
   * the reason field is announced with the label and required state the switch just gave it.
   */
  protected switchToDeny(): void {
    this.verdict.set("deny");
    this.applyVerdictValidators();
    afterNextRender(() => this.commentField()?.nativeElement.focus(), { injector: this.injector });
  }

  protected readonly confirm = async (): Promise<void> => {
    if (this.confirmDisabled()) {
      return;
    }
    const comment = this.formGroup.getRawValue().comment.trim();
    void this.dialogRef.close({
      confirmed: true,
      verdict: this.verdict(),
      comment: comment.length > 0 ? comment : undefined,
    });
  };

  private applyVerdictValidators(): void {
    const control = this.formGroup.controls.comment;
    if (this.approve()) {
      control.removeValidators(Validators.required);
    } else {
      control.addValidators(Validators.required);
    }
    control.updateValueAndValidity();
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
