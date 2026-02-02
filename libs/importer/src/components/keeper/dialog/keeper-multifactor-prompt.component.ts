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

export type KeeperMultifactorPromptVariant = "totp" | "push";

type KeeperMultifactorPromptData = {
  variant: KeeperMultifactorPromptVariant;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "keeper-multifactor-prompt.component.html",
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
export class KeeperMultifactorPromptComponent {
  private variant = this.data.variant;

  protected get descriptionI18nKey(): string {
    switch (this.variant) {
      case "push":
        return "keeperMFAPushDesc";
      case "totp":
      default:
        return "keeperMFADesc";
    }
  }

  protected get showPasscodeInput(): boolean {
    return this.variant === "totp";
  }

  protected formGroup = new FormGroup({
    passcode: new FormControl("", {
      validators: this.data.variant === "totp" ? Validators.required : [],
      updateOn: "submit",
    }),
  });

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: KeeperMultifactorPromptData,
  ) {}

  submit = () => {
    if (this.variant === "totp") {
      this.formGroup.markAsTouched();
      if (!this.formGroup.valid) {
        return;
      }
      this.dialogRef.close(this.formGroup.value.passcode);
    } else {
      // For push, just close with success indicator
      this.dialogRef.close("approved");
    }
  };

  static open(dialogService: DialogService, data: KeeperMultifactorPromptData) {
    return dialogService.open<string>(KeeperMultifactorPromptComponent, { data });
  }
}
