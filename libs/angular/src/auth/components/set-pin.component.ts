// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PinServiceAbstraction } from "@bitwarden/common/key-management/pin/pin.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogRef } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

@Directive()
export class SetPinComponent implements OnInit {
  showMasterPasswordOnClientRestartOption = true;

  setPinForm = this.formBuilder.group({
    pin: ["", [Validators.required, Validators.minLength(4)]],
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
    const pinFormControl = this.setPinForm.controls.pin;
    const requireMasterPasswordOnClientRestart = this.setPinForm.get(
      "requireMasterPasswordOnClientRestart",
    ).value;

    if (Utils.isNullOrWhitespace(pinFormControl.value) || pinFormControl.invalid) {
      return;
    }

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    const userKey = await this.keyService.getUserKey();

    const userKeyEncryptedPin = await this.pinService.createUserKeyEncryptedPin(
      pinFormControl.value,
      userKey,
    );
    await this.pinService.setUserKeyEncryptedPin(userKeyEncryptedPin, userId);

    const pinKeyEncryptedUserKey = await this.pinService.createPinKeyEncryptedUserKey(
      pinFormControl.value,
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
