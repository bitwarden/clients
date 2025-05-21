// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogRef, DialogService } from "@bitwarden/components";

import { OtpResult, OobResult } from "../../importers/lastpass/access/models";
import { Ui } from "../../importers/lastpass/access/ui";

import { LastPassMultifactorPromptComponent } from "./dialog";
import { LastPassMultifactorPromptVariant } from "./dialog/lastpass-multifactor-prompt.component";

type OtpDialogVariant = Extract<LastPassMultifactorPromptVariant, "otp" | "yubikey">;
type OobDialogVariant = Extract<LastPassMultifactorPromptVariant, "oob">;

@Injectable({
  providedIn: "root",
})
export class LastPassDirectImportUIService implements Ui {
  private mfaDialogRef: DialogRef<string>;

  constructor(private dialogService: DialogService) {}

  private async getOTPResult(variant: OtpDialogVariant) {
    const passcode = await this.openMFADialog(variant);
    return new OtpResult(passcode, false);
  }

  private async getOOBResult(variant: OobDialogVariant) {
    const passcode = await this.openMFADialog(variant);
    return new OobResult(false, passcode, false);
  }

  private openMFADialog(variant: LastPassMultifactorPromptVariant) {
    this.mfaDialogRef = LastPassMultifactorPromptComponent.open(this.dialogService, {
      variant,
    });
    return firstValueFrom(this.mfaDialogRef.closed);
  }

  closeMFADialog() {
    this.mfaDialogRef?.close();
  }

  async provideGoogleAuthPasscode() {
    return this.getOTPResult("otp");
  }

  async provideMicrosoftAuthPasscode() {
    return this.getOTPResult("otp");
  }

  async provideYubikeyPasscode() {
    return this.getOTPResult("yubikey");
  }

  async approveLastPassAuth() {
    return this.getOOBResult("oob");
  }
  async approveDuo() {
    return this.getOOBResult("oob");
  }
  async approveSalesforceAuth() {
    return this.getOOBResult("oob");
  }
}
