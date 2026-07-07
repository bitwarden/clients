import { OrgIntegrationConfiguration } from "../integration-builder";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

export class DatadogConfiguration implements OrgIntegrationConfiguration {
  uri: string;
  apiKey: string;
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(uri: string, apiKey: string, bw_serviceName: OrganizationIntegrationServiceName) {
    this.uri = uri;
    this.apiKey = apiKey;
    this.bw_serviceName = bw_serviceName;
  }

  toString() {
    return JSON.stringify({
      Uri: this.uri,
      ApiKey: this.apiKey,
      bw_serviceName: this.bw_serviceName,
    });
  }
}
