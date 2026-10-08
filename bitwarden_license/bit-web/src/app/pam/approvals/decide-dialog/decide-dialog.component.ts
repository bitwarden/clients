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
  /** The verdict the inbox button asked for; the approve variant can still switch to deny. */
  verdict: AccessDecisionVerdict;
  row: ApprovalRow;
  /** The decrypted gated cipher, for the favicon; absent when the approver can't see it. */
  cipher?: CipherViewLike;
};

/**
 * Only an explicit confirm produces a result; every other way out closes with `undefined`.
 * Callers must record this `verdict`, since the approve variant can switch to deny in place.
 */
export type DecideDialogResult = {
  confirmed: true;
  verdict: AccessDecisionVerdict;
  comment: string | undefined;
};

/**
 * Confirms an approve or deny and collects the approver's note, repeating the request summary
 * since approving the wrong request grants real access. Returns the decision for the caller to
 * record.
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
   * A group for one control, since `[bitSubmit]` only matches a `[formGroup]` and drives the
   * confirm button's busy state.
   */
  protected readonly formGroup = this.formBuilder.nonNullable.group({ comment: [""] });

  protected readonly verdict = signal<AccessDecisionVerdict>(this.params.verdict);
  protected readonly approve = computed(() => this.verdict() === "approve");
  protected readonly row = this.params.row;
  protected readonly cipher = this.params.cipher ?? null;

  private readonly comment = toSignal(this.formGroup.controls.comment.valueChanges, {
    initialValue: "",
  });

  /** `Validators.required` accepts spaces, so the button also gates on the trimmed value. */
  protected readonly confirmDisabled = computed(
    () => !this.approve() && this.comment().trim().length === 0,
  );

  constructor() {
    this.applyVerdictValidators();
  }

  /**
   * Clears a note typed while approving, so it can't become the denial reason. Focus moves after
   * the re-render, since removing the switch button would drop it to `<body>`.
   */
  protected switchToDeny(): void {
    this.verdict.set("deny");
    this.formGroup.controls.comment.reset("");
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
