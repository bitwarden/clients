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

import { TwoFactorMethod } from "../../../importers/keeper/access";

type KeeperTwoFactorMethodSelectData = {
  methods: TwoFactorMethod[];
};

@Component({
  templateUrl: "keeper-two-factor-method-select.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class KeeperTwoFactorMethodSelectComponent {
  private readonly dialogRef = inject(DialogRef);
  private readonly data = inject<KeeperTwoFactorMethodSelectData>(DIALOG_DATA);

  protected readonly methods = this.data.methods;

  protected select(method: TwoFactorMethod) {
    this.dialogRef.close(method);
  }

  protected getMethodLabel(method: TwoFactorMethod): string {
    switch (method) {
      case TwoFactorMethod.Totp:
        return "authenticatorAppTotp";
      case TwoFactorMethod.Sms:
        return "textMessageSms";
      case TwoFactorMethod.Duo:
        return "duoSecurity";
      case TwoFactorMethod.Rsa:
        return "rsaSecurId";
      case TwoFactorMethod.Backup:
        return "backupCodes";
      case TwoFactorMethod.U2f:
        return "securityKeyU2f";
      case TwoFactorMethod.WebAuthn:
        return "securityKeyWebAuthn";
      case TwoFactorMethod.KeeperPush:
        return "keeperTwoFactorKeeperPush";
      case TwoFactorMethod.KeeperDna:
        return "keeperTwoFactorKeeperDna";
      default:
        return "unknownMethod";
    }
  }

  static open(dialogService: DialogService, data: KeeperTwoFactorMethodSelectData) {
    return dialogService.open<TwoFactorMethod>(KeeperTwoFactorMethodSelectComponent, { data });
  }
}
