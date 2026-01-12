// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";

import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

export type UserConfirmDialogData = {
  name: string;
  userId: string;
  publicKey: Uint8Array;
  confirmUser: (publicKey: Uint8Array) => Promise<void>;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "user-confirm.component.html",
  imports: [SharedModule],
})
export class UserConfirmComponent implements OnInit {
  name: string;
  userId: string;
  publicKey: Uint8Array;

  loading = true;
  fingerprint: string;
  formPromise: Promise<any>;

  formGroup = new FormGroup({
    dontAskAgain: new FormControl(false),
  });

  constructor(
    @Inject(DIALOG_DATA) protected data: UserConfirmDialogData,
    private dialogRef: DialogRef,
    private keyService: KeyService,
    private logService: LogService,
    private organizationManagementPreferencesService: OrganizationManagementPreferencesService,
  ) {
    this.name = data.name;
    this.userId = data.userId;
    this.publicKey = data.publicKey;
  }

  async ngOnInit() {
    try {
      if (this.publicKey != null) {
        const fingerprint = await this.keyService.getFingerprint(this.userId, this.publicKey);
        if (fingerprint != null) {
          this.fingerprint = fingerprint.join("-");
        }
      }
    } catch (e) {
      this.logService.error(e);
    }
    this.loading = false;
  }

  submit = async () => {
    if (this.loading) {
      return;
    }

    if (this.formGroup.value.dontAskAgain) {
      await this.organizationManagementPreferencesService.autoConfirmFingerPrints.set(true);
    }

    await this.data.confirmUser(this.publicKey);

    this.dialogRef.close();
  };

  static open(dialogService: DialogService, config: DialogConfig<UserConfirmDialogData>) {
    return dialogService.open(UserConfirmComponent, config);
  }
}
