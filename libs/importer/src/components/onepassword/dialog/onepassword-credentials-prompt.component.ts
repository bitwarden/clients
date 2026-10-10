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
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

import { requiredWithMessage } from "../onepassword-validators";

export interface OnePasswordSecretKeyAndPassword {
  secretKey: string;
  password: string;
}

/** Which of the two 1Password refused, and why. */
export interface OnePasswordCredentialsRejection {
  field: keyof OnePasswordSecretKeyAndPassword;
  message: string;
}

export interface OnePasswordCredentialsPromptData {
  email: string;
  /**
   * Signs in with what was entered, settling once the sign-in is over. It resolves with a rejection
   * when the user can correct the Secret Key or password, which the prompt marks on the field. The
   * Continue button stays busy until then, and whoever opened the prompt closes it.
   */
  signIn: (
    entered: OnePasswordSecretKeyAndPassword,
  ) => Promise<OnePasswordCredentialsRejection | undefined>;
}

/**
 * Asks for the Secret Key and password of the 1Password account the import signs in to, and signs
 * in with them. Closes with `undefined`, whether the user cancels or the opener closes it.
 */
@Component({
  templateUrl: "onepassword-credentials-prompt.component.html",
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
export class OnePasswordCredentialsPromptComponent {
  private readonly dialogRef = inject(DialogRef<undefined>);
  private readonly i18nService = inject(I18nService);
  protected readonly data = inject<OnePasswordCredentialsPromptData>(DIALOG_DATA);

  /**
   * The last refusal, marked on its field while the same Secret Key and password are entered. Either
   * can be the wrong one, so changing the other also clears it.
   */
  private readonly rejection = signal<
    (OnePasswordCredentialsRejection & OnePasswordSecretKeyAndPassword) | undefined
  >(undefined);

  protected readonly formGroup = new FormGroup(
    {
      secretKey: new FormControl("", {
        nonNullable: true,
        validators: [
          requiredWithMessage(this.i18nService.t("secretKeyIsRequired")),
          Validators.required,
          this.rejectionValidator("secretKey"),
        ],
      }),
      password: new FormControl("", {
        nonNullable: true,
        validators: [
          requiredWithMessage(this.i18nService.t("passwordIsRequired")),
          Validators.required,
          this.rejectionValidator("password"),
        ],
      }),
    },
    { updateOn: "submit" },
  );

  protected readonly submit = async () => {
    // Submitting only revalidates the field that changed, and a rejection depends on both.
    this.formGroup.controls.secretKey.updateValueAndValidity();
    this.formGroup.controls.password.updateValueAndValidity();
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }

    const entered = this.formGroup.getRawValue();
    const rejection = await this.data.signIn(entered);
    if (rejection != null) {
      this.rejection.set({ ...rejection, ...entered });
      this.formGroup.controls[rejection.field].updateValueAndValidity();
    }
  };

  protected cancel(): void {
    void this.dialogRef.close(undefined);
  }

  private rejectionValidator(field: keyof OnePasswordSecretKeyAndPassword): ValidatorFn {
    return () => {
      const rejection = this.rejection();
      if (rejection?.field !== field) {
        return null;
      }
      const { secretKey, password } = this.formGroup.getRawValue();
      return secretKey === rejection.secretKey && password === rejection.password
        ? { rejected: { message: rejection.message } }
        : null;
    };
  }

  static open(
    dialogService: DialogService,
    data: OnePasswordCredentialsPromptData,
  ): DialogRef<undefined> {
    // Only Cancel and the close button call the import off, never a click outside or Escape.
    return dialogService.open<undefined, OnePasswordCredentialsPromptData>(
      OnePasswordCredentialsPromptComponent,
      { data, disableClose: true },
    );
  }
}
