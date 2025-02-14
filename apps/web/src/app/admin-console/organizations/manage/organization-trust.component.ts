// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, OnInit, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

export enum OrganizationTrustDialogResult {
  Trusted = "trusted",
}
type OrganizationTrustDialogData = {
  /** display name of the organization */
  name: string;
  /** identifies the organization */
  orgId: string;
  /** org public key */
  publicKey: Uint8Array;
};
@Component({
  selector: "organization-trust",
  templateUrl: "organization-trust.component.html",
})
export class OrganizationTrustComponent implements OnInit {
  loading = true;
  fingerprint: string;
  confirmForm = this.formBuilder.group({});

  constructor(
    @Inject(DIALOG_DATA) protected params: OrganizationTrustDialogData,
    private formBuilder: FormBuilder,
    private keyService: KeyService,
    protected organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    private logService: LogService,
    private dialogRef: DialogRef<OrganizationTrustDialogResult>,
  ) {}

  async ngOnInit() {
    try {
      const fingerprint = await this.keyService.getFingerprint(
        this.params.orgId,
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

    try {
      this.dialogRef.close(OrganizationTrustDialogResult.Trusted);
    } catch (e) {
      this.logService.error(e);
    }
  };
  /**
   * Strongly typed helper to open a OrganizationTrustComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open(dialogService: DialogService, config: DialogConfig<OrganizationTrustDialogData>) {
    return dialogService.open<OrganizationTrustDialogResult>(OrganizationTrustComponent, config);
  }
}
