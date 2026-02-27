import { OrganizationIntegrationType } from "./organization-integration-type";

export class OrganizationIntegrationRequest {
  type: OrganizationIntegrationType;
  configuration?: string;

  constructor(integrationType: OrganizationIntegrationType, configuration?: string) {
    this.type = integrationType;
    this.configuration = configuration;
  }
}
