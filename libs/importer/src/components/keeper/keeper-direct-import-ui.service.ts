import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogRef, DialogService } from "@bitwarden/components";

import { DeviceApprovalResult, OtpResult, Ui } from "../../importers/keeper/access";

import { KeeperDeviceApprovalPromptComponent } from "./dialog/keeper-device-approval-prompt.component";
import {
  KeeperMultifactorPromptComponent,
  KeeperMultifactorPromptVariant,
} from "./dialog/keeper-multifactor-prompt.component";

type DeviceApprovalVariant = "email" | "push";

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportUIService implements Ui {
  private dialogRef: DialogRef<string>;

  constructor(private dialogService: DialogService) {}

  private async getDeviceApprovalResult(variant: DeviceApprovalVariant) {
    const result = await this.openDeviceApprovalDialog(variant);
    if (result === "cancel" || result === undefined) {
      return DeviceApprovalResult.cancel;
    }
    return new DeviceApprovalResult(true);
  }

  private openDeviceApprovalDialog(variant: DeviceApprovalVariant) {
    this.dialogRef = KeeperDeviceApprovalPromptComponent.open(this.dialogService, {
      variant,
    });
    return firstValueFrom(this.dialogRef.closed);
  }

  private async getOTPResult(variant: KeeperMultifactorPromptVariant) {
    const passcode = await this.openMFADialog(variant);
    if (passcode === "cancel" || passcode === undefined) {
      return OtpResult.cancel;
    }
    return new OtpResult(passcode, false);
  }

  private openMFADialog(variant: KeeperMultifactorPromptVariant) {
    this.dialogRef = KeeperMultifactorPromptComponent.open(this.dialogService, {
      variant,
    });
    return firstValueFrom(this.dialogRef.closed);
  }

  closeDialog() {
    this.dialogRef?.close();
  }

  async approveDeviceByEmail() {
    return this.getDeviceApprovalResult("email");
  }

  async approveDeviceByPush() {
    return this.getDeviceApprovalResult("push");
  }

  async provideTOTPCode() {
    return this.getOTPResult("totp");
  }

  async approveTwoFactorPush() {
    return this.getOTPResult("push");
  }
}
