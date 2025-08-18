// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogConfig, DialogRef, DIALOG_DATA, DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../../shared";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum EmergencyAccessConfirmDialogResult {
  Confirmed = "confirmed",
}
type EmergencyAccessConfirmDialogData = {
  /** display name of the account requesting emergency access */
  name: string;
  /** identifies the account requesting emergency access */
  userId: string;
  /** traces a unique emergency request  */
  emergencyAccessId: string;
  /** user public key */
  publicKey: Uint8Array;
};
@Component({
  templateUrl: "emergency-access-confirm.component.html",
  imports: [SharedModule],
})
export class EmergencyAccessConfirmComponent implements OnInit {
  loading = true;
  fingerprint: string;
  confirmForm = this.formBuilder.group({
    dontAskAgain: [false],
  });

  constructor(
    @Inject(DIALOG_DATA) protected params: EmergencyAccessConfirmDialogData,
    private formBuilder: FormBuilder,
    private keyService: KeyService,
    protected organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    private logService: LogService,
    private dialogRef: DialogRef<EmergencyAccessConfirmDialogResult>,
  ) {}

  async ngOnInit() {
    try {
      const fingerprint = await this.keyService.getFingerprint(
        this.params.userId,
        this.params.publicKey,
      );
      if (fingerprint != null) {
        this.fingerprint = fingerprint.join("-");
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

    if (this.confirmForm.get("dontAskAgain").value) {
      await this.organizationManagementPreferencesService.autoConfirmFingerPrints.set(true);
    }

    try {
      this.dialogRef.close(EmergencyAccessConfirmDialogResult.Confirmed);
    } catch (e) {
      this.logService.error(e);
    }
  };
  /**
   * Strongly typed helper to open a EmergencyAccessConfirmComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open(
    dialogService: DialogService,
    config: DialogConfig<EmergencyAccessConfirmDialogData>,
  ) {
    return dialogService.open<EmergencyAccessConfirmDialogResult>(
      EmergencyAccessConfirmComponent,
      config,
    );
  }
}
