import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DIALOG_DATA,
  DialogRef,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

import { DeviceApprovalChannel } from "../../../importers/keeper/access";

type KeeperApprovalMethodSelectData = {
  methods: DeviceApprovalChannel[];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "keeper-approval-method-select.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperApprovalMethodSelectComponent {
  protected methods = this.data.methods;
  protected DeviceApprovalChannel = DeviceApprovalChannel;

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: KeeperApprovalMethodSelectData,
  ) {}

  select(method: DeviceApprovalChannel) {
    this.dialogRef.close(method);
  }

  protected getMethodI18nKey(method: DeviceApprovalChannel): string {
    switch (method) {
      case DeviceApprovalChannel.Email:
        return "keeperApprovalMethodEmail";
      case DeviceApprovalChannel.KeeperPush:
        return "keeperApprovalMethodPush";
      default:
        return "keeperApprovalMethodEmail";
    }
  }

  static open(dialogService: DialogService, data: KeeperApprovalMethodSelectData) {
    return dialogService.open<DeviceApprovalChannel>(KeeperApprovalMethodSelectComponent, { data });
  }
}
