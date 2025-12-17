import { OrgIntegrationConfiguration } from "../integration-builder";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

export class DatadogConfiguration implements OrgIntegrationConfiguration {
  Uri: string;
  ApiKey: string;
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(Uri: string, ApiKey: string, bw_serviceName: OrganizationIntegrationServiceName) {
    this.Uri = Uri;
    this.ApiKey = ApiKey;
    this.bw_serviceName = bw_serviceName;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
