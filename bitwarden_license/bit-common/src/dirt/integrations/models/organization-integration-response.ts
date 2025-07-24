import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { OrganizationIntegrationId } from "@bitwarden/common/types/guid";

import { OrganizationIntegrationType } from "./organization-integration-type";

export class OrganizationIntegrationResponse extends BaseResponse {
  id: OrganizationIntegrationId;
  organizationIntegrationType: OrganizationIntegrationType;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationIntegrationType = this.getResponseProperty("Type");
  }
}
