import { OrganizationIntegrationServiceType } from "../organization-integration-service-type";

export class DatadogConfiguration {
  uri: string;
  apiKey: string;
  service: OrganizationIntegrationServiceType;

  constructor(uri: string, apiKey: string, service: string) {
    this.uri = uri;
    this.apiKey = apiKey;
    this.service = service as OrganizationIntegrationServiceType;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
