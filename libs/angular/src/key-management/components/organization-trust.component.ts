import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, OnInit, Inject } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationManagementPreferencesService } from "@bitwarden/common/admin-console/abstractions/organization-management-preferences/organization-management-preferences.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

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
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
    CalloutModule,
  ],
})
export class OrganizationTrustComponent implements OnInit {
  loading = true;
  fingerprint: string = "";
  confirmForm = this.formBuilder.group({});

  constructor(
    @Inject(DIALOG_DATA) protected params: OrganizationTrustDialogData,
    private formBuilder: FormBuilder,
    private keyService: KeyService,
    protected organizationManagementPreferencesService: OrganizationManagementPreferencesService,
    private logService: LogService,
    private dialogRef: DialogRef<boolean>,
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

    this.dialogRef.close(true);
  };

  /**
   * Strongly typed helper to open a OrganizationTrustComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param data The data to pass to the dialog
   */
  static open(dialogService: DialogService, data: OrganizationTrustDialogData) {
    return dialogService.open<boolean, OrganizationTrustDialogData>(OrganizationTrustComponent, {
      data,
    });
  }
}
