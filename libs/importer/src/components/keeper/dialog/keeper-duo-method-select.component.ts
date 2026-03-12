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

import { DuoMethod } from "../../../importers/keeper/access";

type KeeperDuoMethodSelectData = {
  methods: DuoMethod[];
  phoneNumber: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "keeper-duo-method-select.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperDuoMethodSelectComponent {
  protected methods = this.data.methods;
  protected phoneNumber = this.data.phoneNumber;

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: KeeperDuoMethodSelectData,
  ) {}

  select(method: DuoMethod) {
    this.dialogRef.close(method);
  }

  protected getMethodLabel(method: DuoMethod): string {
    switch (method) {
      case DuoMethod.Push:
        return "keeperDuoPush";
      case DuoMethod.Sms:
        return "keeperDuoSms";
      case DuoMethod.Voice:
        return "keeperDuoVoice";
      case DuoMethod.Passcode:
        return "keeperDuoPasscode";
      default:
        return "keeperDuoUnknown";
    }
  }

  static open(dialogService: DialogService, data: KeeperDuoMethodSelectData) {
    return dialogService.open<DuoMethod>(KeeperDuoMethodSelectComponent, { data });
  }
}
