import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  TypographyModule,
} from "@bitwarden/components";

export interface OnePasswordTwoFactorPromptData {
  email: string;
  /** Set when 1Password refused the previous code and restarted the sign-in to ask again. */
  previousCodeRejected: boolean;
}

/**
 * Prompts for a 1Password two-factor verification code. Closes with the code, or `undefined` when
 * the user cancels, which the SDK takes as cancelling the import.
 *
 * 1Password invalidates the session on a wrong code, so the sign-in restarts and this dialog is
 * opened again rather than asking for a second code in place.
 */
@Component({
  templateUrl: "onepassword-two-factor-prompt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    TypographyModule,
  ],
})
export class OnePasswordTwoFactorPromptComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef<string | undefined>);
  private readonly i18nService = inject(I18nService);
  protected readonly data = inject<OnePasswordTwoFactorPromptData>(DIALOG_DATA);

  /**
   * Until a new code is entered, reports the refused one. It runs before `required`, so its message
   * is the one shown. An error set with `setErrors` would not survive the form directive validating
   * the control as it attaches.
   */
  private readonly codeRejectedValidator: ValidatorFn = (control) =>
    this.data.previousCodeRejected && !control.value
      ? { codeRejected: { message: this.i18nService.t("invalidVerificationCode") } }
      : null;

  protected readonly formGroup = new FormGroup({
    code: new FormControl("", {
      validators: [this.codeRejectedValidator, Validators.required],
      updateOn: "submit",
    }),
  });

  ngOnInit(): void {
    if (this.data.previousCodeRejected) {
      // The error hides as soon as the user starts typing a new code.
      this.formGroup.controls.code.markAsTouched();
    }
  }

  protected readonly submit = () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }
    void this.dialogRef.close(this.formGroup.value.code ?? undefined);
  };

  /** Opens the prompt, which closes with the code, or `undefined` if the user cancelled. */
  static open(
    dialogService: DialogService,
    data: OnePasswordTwoFactorPromptData,
  ): DialogRef<string | undefined> {
    return dialogService.open<string | undefined, OnePasswordTwoFactorPromptData>(
      OnePasswordTwoFactorPromptComponent,
      { data },
    );
  }
}
