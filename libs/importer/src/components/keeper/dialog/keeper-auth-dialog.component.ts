import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  TypographyModule,
} from "@bitwarden/components";

import {
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  TwoFactorMethod,
} from "../../../importers/keeper/access";
import { KeeperDirectImportUIService } from "../keeper-direct-import-ui.service";

@Component({
  templateUrl: "keeper-auth-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    JslibModule,
    ButtonModule,
    CalloutModule,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    ReactiveFormsModule,
    TypographyModule,
  ],
})
export class KeeperAuthDialogComponent {
  private readonly keeperUi = inject(KeeperDirectImportUIService);

  protected readonly stage = this.keeperUi.stage;

  protected readonly codeControl = new FormControl("", { nonNullable: true });
  protected readonly passwordControl = new FormControl("", { nonNullable: true });

  protected selectApproval(method: DeviceApprovalChannel): void {
    this.keeperUi.submit(method);
  }

  protected selectTwoFactor(method: TwoFactorMethod): void {
    this.keeperUi.submit(method);
  }

  protected selectDuo(method: DuoMethod): void {
    this.keeperUi.submit(method);
  }

  protected selectDna(method: DnaMethod): void {
    this.keeperUi.submit(method);
  }

  protected submitCode(): void {
    const code = this.codeControl.value.trim();
    if (!code) {
      return;
    }
    this.codeControl.reset("");
    this.keeperUi.submit(code);
  }

  protected submitPush(): void {
    this.keeperUi.submit("");
  }

  protected submitPassword(): void {
    const password = this.passwordControl.value;
    if (!password) {
      return;
    }
    this.passwordControl.reset("");
    this.keeperUi.submit(password);
  }

  protected tryAnother(): void {
    this.keeperUi.tryAnother();
  }

  protected cancel(): void {
    this.keeperUi.cancel();
  }

  protected dismissError(): void {
    this.keeperUi.dismissError();
  }

  protected getApprovalMethodLabel(method: DeviceApprovalChannel): string {
    switch (method) {
      case DeviceApprovalChannel.Email:
        return "email";
      case DeviceApprovalChannel.KeeperPush:
        return "keeperPush";
      case DeviceApprovalChannel.TwoFactor:
        return "twoFactorAuthentication";
      default:
        return "email";
    }
  }

  protected getApprovalCodeDescription(variant: "email" | "push"): string {
    switch (variant) {
      case "push":
        return "otherDeviceApprovalPushDesc";
      case "email":
      default:
        return "approvalEmailDesc";
    }
  }

  protected getTwoFactorLabel(method: TwoFactorMethod): string {
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
        return "keeperPush";
      case TwoFactorMethod.KeeperDna:
        return "keeperDna";
      default:
        return "unknownMethod";
    }
  }

  protected getDuoLabel(method: DuoMethod): string {
    switch (method) {
      case DuoMethod.Push:
        return "duoPush";
      case DuoMethod.Sms:
        return "textMessageSms";
      case DuoMethod.Voice:
        return "phoneCall";
      case DuoMethod.Passcode:
        return "passcode";
      default:
        return "unknownMethod";
    }
  }

  protected getDnaLabel(method: DnaMethod): string {
    switch (method) {
      case DnaMethod.Push:
        return "pushNotification";
      case DnaMethod.Code:
        return "enterCodeManually";
      default:
        return "unknownMethod";
    }
  }

  static open(dialogService: DialogService): DialogRef {
    return dialogService.open(KeeperAuthDialogComponent, {
      disableClose: true,
    });
  }
}
