import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

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

@Component({
  templateUrl: "keeper-approval-method-select.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperApprovalMethodSelectComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<KeeperApprovalMethodSelectData>(DIALOG_DATA);

  protected readonly methods = this.data.methods;

  protected select(method: DeviceApprovalChannel) {
    this.dialogRef.close(method);
  }

  protected getMethodI18nKey(method: DeviceApprovalChannel): string {
    switch (method) {
      case DeviceApprovalChannel.Email:
        return "email";
      case DeviceApprovalChannel.KeeperPush:
        return "keeperPush";
      default:
        return "email";
    }
  }

  static open(dialogService: DialogService, data: KeeperApprovalMethodSelectData) {
    return dialogService.open<DeviceApprovalChannel>(KeeperApprovalMethodSelectComponent, { data });
  }
}
