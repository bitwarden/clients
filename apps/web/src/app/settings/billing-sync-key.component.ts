import { Component } from "@angular/core";

import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";
import { ModalConfig } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { OrganizationConnectionType } from "@bitwarden/common/enums/organizationConnectionType";
import { BillingSyncConfigApi } from "@bitwarden/common/models/api/billing-sync-config.api";
import { BillingSyncConfigRequest } from "@bitwarden/common/models/request/billing-sync-config.request";
import { OrganizationConnectionRequest } from "@bitwarden/common/models/request/organization-connection.request";
import { OrganizationConnectionResponse } from "@bitwarden/common/models/response/organization-connection.response";
import { Guid } from "@bitwarden/common/types/guid";

export interface BillingSyncKeyModalData {
  entityId: Guid;
  existingConnectionId: string;
  billingSyncKey: string;
  setParentConnection: (connection: OrganizationConnectionResponse<BillingSyncConfigApi>) => void;
}

@Component({
  selector: "app-billing-sync-key",
  templateUrl: "billing-sync-key.component.html",
})
export class BillingSyncKeyComponent {
  entityId: Guid;
  existingConnectionId: string;
  billingSyncKey: string;
  setParentConnection: (connection: OrganizationConnectionResponse<BillingSyncConfigApi>) => void;

  formPromise: Promise<OrganizationConnectionResponse<BillingSyncConfigApi>> | Promise<void>;

  constructor(
    private apiService: ApiService,
    private logService: LogService,
    protected modalRef: ModalRef,
    config: ModalConfig<BillingSyncKeyModalData>
  ) {
    this.entityId = config.data.entityId;
    this.existingConnectionId = config.data.existingConnectionId;
    this.billingSyncKey = config.data.billingSyncKey;
    this.setParentConnection = config.data.setParentConnection;
  }

  async submit() {
    try {
      const request = new OrganizationConnectionRequest(
        this.entityId,
        OrganizationConnectionType.CloudBillingSync,
        true,
        new BillingSyncConfigRequest(this.billingSyncKey)
      );
      if (this.existingConnectionId == null) {
        this.formPromise = this.apiService.createOrganizationConnection(
          request,
          BillingSyncConfigApi
        );
      } else {
        this.formPromise = this.apiService.updateOrganizationConnection(
          request,
          BillingSyncConfigApi,
          this.existingConnectionId
        );
      }
      const response = (await this
        .formPromise) as OrganizationConnectionResponse<BillingSyncConfigApi>;
      this.existingConnectionId = response?.id;
      this.billingSyncKey = response?.config?.billingSyncKey;
      this.setParentConnection(response);
      this.modalRef.close();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async deleteConnection() {
    this.formPromise = this.apiService.deleteOrganizationConnection(this.existingConnectionId);
    await this.formPromise;
    this.setParentConnection(null);
    this.modalRef.close();
  }
}
