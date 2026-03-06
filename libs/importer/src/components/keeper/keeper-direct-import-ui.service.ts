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
import { KeeperDuoMethodSelectComponent } from "./dialog/keeper-duo-method-select.component";
import { KeeperDuoPushPromptComponent } from "./dialog/keeper-duo-push-prompt.component";
import { KeeperMultifactorPromptComponent } from "./dialog/keeper-multifactor-prompt.component";
import { KeeperTwoFactorMethodSelectComponent } from "./dialog/keeper-two-factor-method-select.component";

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportUIService implements Ui {
  private dialogRef!: DialogRef;

  constructor(private dialogService: DialogService) {}

  //
  // Device approval flow
  //

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
    return result === undefined ? Cancel : (result as DeviceApprovalChannel);
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
    return result === undefined ? Cancel : (result as string);
  }

  closeApprovalDialog(): void {
    this.dialogRef?.close();
  }

  //
  // 2FA flow
  //

  async selectTwoFactorMethod(
    methods: TwoFactorMethod[],
  ): Promise<TwoFactorMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.dialogRef = KeeperTwoFactorMethodSelectComponent.open(this.dialogService, {
      methods,
    });

    const result = await firstValueFrom(this.dialogRef.closed);
    return result === undefined ? Cancel : (result as TwoFactorMethod);
  }

  async provideTwoFactorCode(
    method: TwoFactorMethod,
    _info?: string,
  ): Promise<string | typeof Cancel | typeof Resend> {
    // Determine if this method needs a code input or just waiting for push
    const needsCodeInput =
      method === TwoFactorMethod.Totp ||
      method === TwoFactorMethod.Sms ||
      method === TwoFactorMethod.Duo ||
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

    return result as string;
  }

  async selectDuoMethod(
    methods: DuoMethod[],
    phoneNumber: string,
  ): Promise<DuoMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.dialogRef = KeeperDuoMethodSelectComponent.open(this.dialogService, {
      methods,
      phoneNumber,
    });

    const result = await firstValueFrom(this.dialogRef.closed);
    return result === undefined ? Cancel : (result as DuoMethod);
  }

  async waitForDuoPush(method: DuoMethod): Promise<typeof Cancel | void> {
    this.dialogRef = KeeperDuoPushPromptComponent.open(this.dialogService, { method });

    const result = await firstValueFrom(this.dialogRef.closed);
    if (result === "cancel" || result === undefined) {
      return Cancel;
    }
  }

  closeDuoPushDialog(): void {
    this.dialogRef?.close();
  }
}
