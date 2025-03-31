// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef } from "@angular/cdk/dialog";
import { Directive, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { KeyService } from "@bitwarden/key-management";

@Directive()
export class SetPinComponent implements OnInit {
  showMasterPasswordOnClientRestartOption = true;

  setPinForm = this.formBuilder.group({
    pin: ["", [Validators.required]],
    requireMasterPasswordOnClientRestart: true,
  });

  constructor(
    private accountService: AccountService,
    private keyService: KeyService,
    private dialogRef: DialogRef,
    private formBuilder: FormBuilder,
    private pinService: PinServiceAbstraction,
    private userVerificationService: UserVerificationService,
  ) {}

  async ngOnInit() {
    const hasMasterPassword = await this.userVerificationService.hasMasterPassword();

    this.setPinForm.controls.requireMasterPasswordOnClientRestart.setValue(hasMasterPassword);
    this.showMasterPasswordOnClientRestartOption = hasMasterPassword;
  }

  submit = async () => {
    const pin = this.setPinForm.get("pin").value;
    const requireMasterPasswordOnClientRestart = this.setPinForm.get(
      "requireMasterPasswordOnClientRestart",
    ).value;

    if (Utils.isNullOrWhitespace(pin)) {
      this.dialogRef.close(false);
      return;
    }

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    const userKey = await this.keyService.getUserKey();

    const userKeyEncryptedPin = await this.pinService.createUserKeyEncryptedPin(pin, userKey);
    await this.pinService.setUserKeyEncryptedPin(userKeyEncryptedPin, userId);

    const pinKeyEncryptedUserKey = await this.pinService.createPinKeyEncryptedUserKey(
      pin,
      userKey,
      userId,
    );
    await this.pinService.storePinKeyEncryptedUserKey(
      pinKeyEncryptedUserKey,
      requireMasterPasswordOnClientRestart,
      userId,
    );

    this.dialogRef.close(true);
  };
}
