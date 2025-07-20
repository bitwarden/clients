import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
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

export type LastPassMultifactorPromptVariant = "otp" | "oob" | "yubikey";

type LastPassMultifactorPromptData = {
  variant: LastPassMultifactorPromptVariant;
};

@Component({
  templateUrl: "lastpass-multifactor-prompt.component.html",
  imports: [
    CommonModule,
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
export class LastPassMultifactorPromptComponent {
  private variant = this.data.variant;

  protected get descriptionI18nKey(): string {
    switch (this.variant) {
      case "oob":
        return "lastPassOOBDesc";
      case "yubikey":
        return "lastPassYubikeyDesc";
      case "otp":
      default:
        return "lastPassMFADesc";
    }
  }

  protected formGroup = new FormGroup({
    passcode: new FormControl("", {
      validators: Validators.required,
      updateOn: "submit",
    }),
  });

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: LastPassMultifactorPromptData,
  ) {}

  submit = () => {
    this.formGroup.markAsTouched();
    if (!this.formGroup.valid) {
      return;
    }
    this.dialogRef.close(this.formGroup.value.passcode);
  };

  static open(dialogService: DialogService, data: LastPassMultifactorPromptData) {
    return dialogService.open<string>(LastPassMultifactorPromptComponent, { data });
  }
}
