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

import { TwoFactorMethod } from "../../../importers/keeper/access";

type KeeperTwoFactorMethodSelectData = {
  methods: TwoFactorMethod[];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "keeper-two-factor-method-select.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperTwoFactorMethodSelectComponent {
  protected methods = this.data.methods;

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: KeeperTwoFactorMethodSelectData,
  ) {}

  select(method: TwoFactorMethod) {
    this.dialogRef.close(method);
  }

  protected getMethodLabel(method: TwoFactorMethod): string {
    switch (method) {
      case TwoFactorMethod.Totp:
        return "keeperTwoFactorTotp";
      case TwoFactorMethod.Sms:
        return "keeperTwoFactorSms";
      case TwoFactorMethod.Duo:
        return "keeperTwoFactorDuo";
      case TwoFactorMethod.Rsa:
        return "keeperTwoFactorRsa";
      case TwoFactorMethod.Backup:
        return "keeperTwoFactorBackup";
      case TwoFactorMethod.U2f:
        return "keeperTwoFactorU2f";
      case TwoFactorMethod.WebAuthn:
        return "keeperTwoFactorWebAuthn";
      case TwoFactorMethod.KeeperPush:
        return "keeperTwoFactorKeeperPush";
      case TwoFactorMethod.KeeperDna:
        return "keeperTwoFactorKeeperDna";
      default:
        return "keeperTwoFactorUnknown";
    }
  }

  static open(dialogService: DialogService, data: KeeperTwoFactorMethodSelectData) {
    return dialogService.open<TwoFactorMethod>(KeeperTwoFactorMethodSelectComponent, { data });
  }
}
