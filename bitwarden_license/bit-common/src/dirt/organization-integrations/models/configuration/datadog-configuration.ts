import { OrgIntegrationConfiguration } from "../integration-jsonify";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

export class DatadogConfiguration implements OrgIntegrationConfiguration {
  uri: string;
  apiKey: string;
  service: OrganizationIntegrationServiceName;

  constructor(uri: string, apiKey: string, service: OrganizationIntegrationServiceName) {
    this.uri = uri;
    this.apiKey = apiKey;
    this.service = service;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
