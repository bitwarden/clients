import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";

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

export type KeeperDeviceApprovalVariant = "email" | "push";

type KeeperDeviceApprovalPromptData = {
  variant: KeeperDeviceApprovalVariant;
};

@Component({
  templateUrl: "keeper-device-approval-prompt.component.html",
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
export class KeeperDeviceApprovalPromptComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<KeeperDeviceApprovalPromptData>(DIALOG_DATA);

  protected readonly variant = this.data.variant;

  protected readonly formGroup = new FormGroup({
    code: new FormControl(""),
  });

  protected get descriptionI18nKey(): string {
    switch (this.variant) {
      case "push":
        return "keeperDeviceApprovalPushDesc";
      case "email":
      default:
        return "keeperDeviceApprovalEmailDesc";
    }
  }

  protected readonly submit = () => {
    const code = this.formGroup.controls.code.value?.trim();
    if (code) {
      this.dialogRef.close(code);
    }
  };

  static open(dialogService: DialogService, data: KeeperDeviceApprovalPromptData) {
    return dialogService.open<string>(KeeperDeviceApprovalPromptComponent, { data });
  }
}
