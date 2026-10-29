import { ChangeDetectionStrategy, Component, Signal, effect, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

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

export interface OnePasswordSsoEnrollmentPromptData {
  email: string;
  /** Whether 1Password asks for the code, which it does once the other device approves this one. */
  codeRequested: Signal<boolean>;
  /**
   * Hands the verification code to 1Password. The Continue button stays busy until the import is
   * over, and whoever opened the prompt closes it.
   */
  submitCode: (code: string) => Promise<void>;
}

/**
 * Asks for the verification code that approves this device for a 1Password account that signs in
 * with single sign-on. Another device that is signed in to 1Password shows the code once the user
 * approves the request there. Closes with `undefined`, whether the user cancels or the opener
 * closes it.
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

  protected readonly formGroup = new FormGroup({
    code: new FormControl("", {
      nonNullable: true,
      validators: [
        requiredWithMessage(this.i18nService.t("verificationCodeRequired")),
        Validators.required,
      ],
      updateOn: "submit",
    }),
  });

  /** A code sent before the other device approves this one would wait with Cancel disabled. */
  private readonly lockCodeUntilRequested = effect(() => {
    if (this.data.codeRequested()) {
      this.formGroup.enable();
    } else {
      this.formGroup.disable();
    }
  });

  protected readonly submit = async () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }

    const { code } = this.formGroup.getRawValue();
    this.formGroup.disable();
    await this.data.submitCode(code);
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
