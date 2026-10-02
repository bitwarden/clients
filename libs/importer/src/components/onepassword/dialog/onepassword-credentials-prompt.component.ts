import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

export interface OnePasswordCredentialsPromptData {
  email: string;
  /** Why the previous attempt was refused, shown when the prompt is opened again. */
  error?: string;
}

export interface OnePasswordCredentialsPromptResult {
  secretKey: string;
  password: string;
}

/**
 * Asks for the Secret Key and password of the 1Password account the import signs in to. Closes with
 * both, or `undefined` when the user cancels.
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
    CalloutModule,
    IconButtonModule,
    TypographyModule,
  ],
})
export class OnePasswordCredentialsPromptComponent {
  private readonly dialogRef = inject(DialogRef<OnePasswordCredentialsPromptResult | undefined>);
  protected readonly data = inject<OnePasswordCredentialsPromptData>(DIALOG_DATA);

  protected readonly formGroup = new FormGroup(
    {
      secretKey: new FormControl("", { nonNullable: true, validators: Validators.required }),
      password: new FormControl("", { nonNullable: true, validators: Validators.required }),
    },
    { updateOn: "submit" },
  );

  protected readonly submit = () => {
    this.formGroup.markAllAsTouched();
    if (!this.formGroup.valid) {
      return;
    }
    const { secretKey, password } = this.formGroup.getRawValue();
    void this.dialogRef.close({ secretKey, password });
  };

  static open(
    dialogService: DialogService,
    data: OnePasswordCredentialsPromptData,
  ): DialogRef<OnePasswordCredentialsPromptResult | undefined> {
    return dialogService.open<
      OnePasswordCredentialsPromptResult | undefined,
      OnePasswordCredentialsPromptData
    >(OnePasswordCredentialsPromptComponent, { data });
  }
}
