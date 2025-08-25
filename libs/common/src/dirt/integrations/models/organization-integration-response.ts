import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { OrganizationIntegrationId } from "@bitwarden/common/types/guid";

import { OrganizationIntegrationType } from "./organization-integration-type";

export class OrganizationIntegrationResponse extends BaseResponse {
  id: OrganizationIntegrationId;
  type: OrganizationIntegrationType;
  configuration: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.type = this.getResponseProperty("Type");
    this.configuration = this.getResponseProperty("Configuration");
  }
}
