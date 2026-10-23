import { ChangeDetectionStrategy, Component, Signal, computed, inject } from "@angular/core";
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

import { OnePasswordSsoEnrollmentStatus } from "../../../sdk";
import { requiredWithMessage } from "../onepassword-validators";

export interface OnePasswordSsoEnrollmentPromptData {
  email: string;
  /** The stage the enrollment has reached. */
  status: Signal<OnePasswordSsoEnrollmentStatus>;
  /** Whether 1Password asks for the verification code, which the other device shows on approval. */
  codeRequested: Signal<boolean>;
  /**
   * Hands the verification code to 1Password. The Continue button stays busy until the import is
   * over, and whoever opened the prompt closes it.
   */
  submitCode: (code: string) => Promise<void>;
}

const statusMessageKeys: Record<OnePasswordSsoEnrollmentStatus, string> = {
  WaitingForApproval: "onePasswordSsoWaitingForApproval",
  ExchangingCredentials: "onePasswordSsoExchangingCredentials",
  Completing: "onePasswordSsoCompleting",
};

/**
 * Takes the user through approving this device for a 1Password account that signs in with single
 * sign-on: it shows the stage of the enrollment and asks for the verification code the approving
 * device displays. Closes with `undefined`, whether the user cancels or the opener closes it.
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

  /** The code is asked for once 1Password wants it, and only until it is handed over. */
  protected readonly askingForCode = computed(
    () => this.data.codeRequested() && this.data.status() === "WaitingForApproval",
  );
  protected readonly statusMessageKey = computed(() =>
    this.askingForCode()
      ? "onePasswordSsoEnterVerificationCode"
      : statusMessageKeys[this.data.status()],
  );

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

  protected readonly submit = async () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }

    await this.data.submitCode(this.formGroup.getRawValue().code);
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
