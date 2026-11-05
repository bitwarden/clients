import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
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
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

import { requiredWithMessage } from "../onepassword-validators";

import { OnePasswordCodeOutcome } from "./onepassword-code-outcome";

export interface OnePasswordSsoEnrollmentPromptData {
  email: string;
  /**
   * Hands the verification code to 1Password. It resolves once 1Password refuses it and asks for
   * the new one the other device shows, or once the import is over. The Continue button stays busy
   * until then, and whoever opened the prompt closes it.
   */
  submitCode: (code: string) => Promise<OnePasswordCodeOutcome>;
}

/**
 * Asks for the verification code that approves this device for a 1Password account that signs in
 * with single sign-on. Another device that is signed in to 1Password shows the code once the user
 * approves the request there, and a new one after a wrong code, which the prompt marks. Closes
 * with `undefined`, whether the user cancels or the opener closes it.
 */
@Component({
  templateUrl: "onepassword-sso-enrollment-prompt.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    ReactiveFormsModule,
    DialogModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    TypographyModule,
  ],
})
export class OnePasswordSsoEnrollmentPromptComponent {
  private readonly dialogRef = inject(DialogRef<undefined>);
  private readonly i18nService = inject(I18nService);
  protected readonly data = inject<OnePasswordSsoEnrollmentPromptData>(DIALOG_DATA);

  /** The code 1Password refused last, marked on the field until another one is entered. */
  private readonly refusedCode = signal<string | undefined>(undefined);

  private readonly refusedCodeValidator: ValidatorFn = (control) =>
    this.refusedCode() != null && control.value === this.refusedCode()
      ? { codeRefused: { message: this.i18nService.t("onePasswordSsoCodeDidNotWork") } }
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

  // appInputStripSpaces sets the value on every keystroke, ahead of the submit.
  private readonly code = toSignal(this.formGroup.controls.code.valueChanges, { initialValue: "" });
  protected readonly blank = computed(() => this.code() === "");

  protected readonly submit = async () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }

    const { code } = this.formGroup.getRawValue();
    if ((await this.data.submitCode(code)) === OnePasswordCodeOutcome.Refused) {
      this.refusedCode.set(code);
      this.formGroup.controls.code.updateValueAndValidity();
    }
  };

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  static open(
    dialogService: DialogService,
    data: OnePasswordSsoEnrollmentPromptData,
  ): DialogRef<undefined> {
    // Only Cancel and the close button call the enrollment off, never a click outside or Escape.
    return dialogService.open<undefined, OnePasswordSsoEnrollmentPromptData>(
      OnePasswordSsoEnrollmentPromptComponent,
      { data, disableClose: true },
    );
  }
}
