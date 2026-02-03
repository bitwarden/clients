import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogRef, DialogService } from "@bitwarden/components";

import {
  Cancel,
  DeviceApprovalChannel,
  DuoMethod,
  Resend,
  TwoFactorMethod,
  Ui,
} from "../../importers/keeper/access";

import { KeeperApprovalMethodSelectComponent } from "./dialog/keeper-approval-method-select.component";
import { KeeperDeviceApprovalPromptComponent } from "./dialog/keeper-device-approval-prompt.component";
import { KeeperMultifactorPromptComponent } from "./dialog/keeper-multifactor-prompt.component";

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportUIService implements Ui {
  private dialogRef: DialogRef<DeviceApprovalChannel | string>;

  constructor(private dialogService: DialogService) {}

  closeDialog() {
    this.dialogRef?.close();
  }

  closeApprovalDialog(): void {
    this.dialogRef?.close();
  }

  async selectApprovalMethod(
    methods: DeviceApprovalChannel[],
  ): Promise<DeviceApprovalChannel | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.dialogRef = KeeperApprovalMethodSelectComponent.open(this.dialogService, {
      methods,
    });

    const result = await firstValueFrom(this.dialogRef.closed);

    if (result === undefined || result === "cancel") {
      return Cancel;
    }

    return result as DeviceApprovalChannel;
  }

  async provideApprovalCode(
    method: DeviceApprovalChannel,
    _info?: string,
  ): Promise<string | typeof Cancel | typeof Resend> {
    const variant = method === DeviceApprovalChannel.Email ? "email" : "push";

    this.dialogRef = KeeperDeviceApprovalPromptComponent.open(this.dialogService, {
      variant,
    });

    const result = await firstValueFrom(this.dialogRef.closed);

    if (result === "cancel" || result === undefined) {
      return Cancel;
    }

    // Return the code entered by the user (or empty string for push)
    return result;
  }

  async selectTwoFactorMethod(
    methods: TwoFactorMethod[],
  ): Promise<TwoFactorMethod | typeof Cancel> {
    // For now, auto-select the first available method
    // TODO: Show a selection dialog if multiple methods are available
    if (methods.length === 0) {
      return Cancel;
    }
    return methods[0];
  }

  async provideTwoFactorCode(
    method: TwoFactorMethod,
    _info?: string,
  ): Promise<string | typeof Cancel | typeof Resend> {
    // Determine if this method needs a code input or just waiting for push
    const needsCodeInput =
      method === TwoFactorMethod.Totp ||
      method === TwoFactorMethod.Sms ||
      method === TwoFactorMethod.Backup ||
      method === TwoFactorMethod.Rsa;

    const variant = needsCodeInput ? "totp" : "push";

    this.dialogRef = KeeperMultifactorPromptComponent.open(this.dialogService, {
      variant,
    });

    const result = await firstValueFrom(this.dialogRef.closed);

    if (result === "cancel" || result === undefined) {
      return Cancel;
    }

    // For push-style methods, return empty string
    if (!needsCodeInput) {
      return "";
    }

    return result;
  }

  async selectDuoMethod(
    methods: DuoMethod[],
    _phoneNumber: string,
  ): Promise<DuoMethod | typeof Cancel> {
    // For now, auto-select the first available method
    // TODO: Show a selection dialog for Duo methods
    if (methods.length === 0) {
      return Cancel;
    }
    return methods[0];
  }
}
