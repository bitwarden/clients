import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";

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

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "keeper-device-approval-prompt.component.html",
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
export class KeeperDeviceApprovalPromptComponent {
  private variant = this.data.variant;

  protected get descriptionI18nKey(): string {
    switch (this.variant) {
      case "push":
        return "keeperDeviceApprovalPushDesc";
      case "email":
      default:
        return "keeperDeviceApprovalEmailDesc";
    }
  }

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: KeeperDeviceApprovalPromptData,
  ) {}

  approve = () => {
    this.dialogRef.close("approved");
  };

  static open(dialogService: DialogService, data: KeeperDeviceApprovalPromptData) {
    return dialogService.open<string>(KeeperDeviceApprovalPromptComponent, { data });
  }
}
