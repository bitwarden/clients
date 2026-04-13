import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
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

@Component({
  templateUrl: "keeper-multifactor-prompt.component.html",
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
export class KeeperMultifactorPromptComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<KeeperMultifactorPromptData>(DIALOG_DATA);

  private readonly variant = this.data.variant;

  protected readonly formGroup = new FormGroup({
    passcode: new FormControl("", {
      validators: this.variant === "totp" ? Validators.required : [],
      updateOn: "submit",
    }),
  });

  protected get descriptionI18nKey(): string {
    switch (this.variant) {
      case "push":
        return "keeperMFAPushDesc";
      case "totp":
      default:
        return "mfaTotpDesc";
    }
  }

  protected get showPasscodeInput(): boolean {
    return this.variant === "totp";
  }

  protected readonly submit = () => {
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
