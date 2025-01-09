// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationConnectionType } from "@bitwarden/common/admin-console/enums";
import { OrganizationConnectionRequest } from "@bitwarden/common/admin-console/models/request/organization-connection.request";
import { OrganizationConnectionResponse } from "@bitwarden/common/admin-console/models/response/organization-connection.response";
import { BillingSyncConfigApi } from "@bitwarden/common/billing/models/api/billing-sync-config.api";
import { BillingSyncConfigRequest } from "@bitwarden/common/billing/models/request/billing-sync-config.request";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService } from "@bitwarden/components";

export interface BillingSyncKeyModalData {
  entityId: string;
  existingConnectionId: string;
  billingSyncKey: string;
  setParentConnection: (connection: OrganizationConnectionResponse<BillingSyncConfigApi>) => void;
}

@Component({
  templateUrl: "billing-sync-key.component.html",
})
export class BillingSyncKeyComponent {
  protected entityId: string;
  protected existingConnectionId: string;
  protected billingSyncKey: string;
  protected setParentConnection: (
    connection: OrganizationConnectionResponse<BillingSyncConfigApi>,
  ) => void;

  protected formGroup: FormGroup;

  constructor(
    private dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: BillingSyncKeyModalData,
    private apiService: ApiService,
    private logService: LogService,
  ) {
    this.entityId = data.entityId;
    this.existingConnectionId = data.existingConnectionId;
    this.billingSyncKey = data.billingSyncKey;
    this.setParentConnection = data.setParentConnection;

    this.formGroup = new FormGroup({
      billingSyncKey: new FormControl<string>(this.billingSyncKey, Validators.required),
    });
  }

  submit = async () => {
    try {
      const request = new OrganizationConnectionRequest(
        this.entityId,
        OrganizationConnectionType.CloudBillingSync,
        true,
        new BillingSyncConfigRequest(this.formGroup.value.billingSyncKey),
      );

      const response =
        this.existingConnectionId == null
          ? await this.apiService.createOrganizationConnection(request, BillingSyncConfigApi)
          : await this.apiService.updateOrganizationConnection(
              request,
              BillingSyncConfigApi,
              this.existingConnectionId,
            );

      this.existingConnectionId = response?.id;
      this.billingSyncKey = response?.config?.billingSyncKey;
      this.setParentConnection(response);
      this.dialogRef.close();
    } catch (e) {
      this.logService.error(e);
    }
  };

  deleteConnection = async () => {
    await this.apiService.deleteOrganizationConnection(this.existingConnectionId);
    this.setParentConnection(null);
    this.dialogRef.close();
  };

  static open(dialogService: DialogService, data: BillingSyncKeyModalData) {
    return dialogService.open(BillingSyncKeyComponent, { data });
  }
}
