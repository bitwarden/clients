import { EventType } from "@bitwarden/common/enums";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import {
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

export class OrganizationIntegrationConfigurationResponse extends BaseResponse {
  id: OrganizationIntegrationConfigurationId;
  eventType?: EventType;
  configuration?: string;
  filters?: string;
  template?: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.eventType = this.getResponseProperty("EventType");
    this.configuration = this.getResponseProperty("Configuration");
    this.filters = this.getResponseProperty("Filters");
    this.template = this.getResponseProperty("Template");
  }
}

export class OrganizationIntegrationConfigurationResponseWithIntegrationId {
  integrationId: OrganizationIntegrationId;
  configurationResponses: OrganizationIntegrationConfigurationResponse[];

  constructor(
    integrationId: OrganizationIntegrationId,
    configurationResponses: OrganizationIntegrationConfigurationResponse[],
  ) {
    this.integrationId = integrationId;
    this.configurationResponses = configurationResponses;
  }
}
