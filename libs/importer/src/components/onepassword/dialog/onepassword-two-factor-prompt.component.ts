import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
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

import { requiredWithMessage } from "../onepassword-validators";

export interface OnePasswordTwoFactorPromptData {
  email: string;
  /**
   * Hands the code to 1Password. It resolves with `true` when 1Password refuses it and asks for
   * another, and with `false` once the import is over. The Continue button stays busy until then,
   * and whoever opened the prompt closes it.
   */
  submitCode: (code: string) => Promise<boolean>;
}

/**
 * Prompts for 1Password two-factor verification codes. Closes with `undefined`, whether the user
 * cancels or the opener closes it.
 *
 * 1Password invalidates the session on a wrong code and the sign-in restarts, but the prompt stays
 * open across the attempts, marking the refused code.
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
export class OnePasswordTwoFactorPromptComponent {
  private readonly dialogRef = inject(DialogRef<undefined>);
  private readonly i18nService = inject(I18nService);
  protected readonly data = inject<OnePasswordTwoFactorPromptData>(DIALOG_DATA);

  /** The code 1Password refused last, marked on the field until another one is entered. */
  private readonly refusedCode = signal<string | undefined>(undefined);

  private readonly refusedCodeValidator: ValidatorFn = (control) =>
    this.refusedCode() != null && control.value === this.refusedCode()
      ? { codeRefused: { message: this.i18nService.t("enterValidVerificationCode") } }
      : null;

  protected readonly formGroup = new FormGroup({
    code: new FormControl("", {
      nonNullable: true,
      validators: [
        requiredWithMessage(this.i18nService.t("verificationCodeRequired")),
        Validators.required,
        this.refusedCodeValidator,
      ],
      updateOn: "submit",
    }),
  });

  protected readonly submit = async () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }

    const { code } = this.formGroup.getRawValue();
    // A sign-in cannot be called off halfway, so the prompt stays until 1Password answers.
    this.dialogRef.disableClose = true;
    try {
      if (await this.data.submitCode(code)) {
        this.refusedCode.set(code);
        this.formGroup.controls.code.updateValueAndValidity();
      }
    } finally {
      this.dialogRef.disableClose = false;
    }
  };

  static open(
    dialogService: DialogService,
    data: OnePasswordTwoFactorPromptData,
  ): DialogRef<undefined> {
    return dialogService.open<undefined, OnePasswordTwoFactorPromptData>(
      OnePasswordTwoFactorPromptComponent,
      { data },
    );
  }
}
