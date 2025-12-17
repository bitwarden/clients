import { OrgIntegrationConfiguration } from "../integration-builder";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

export class HecConfiguration implements OrgIntegrationConfiguration {
  Uri: string;
  Scheme = "Bearer";
  Token: string;
  Service?: string;
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(uri: string, token: string, bw_serviceName: OrganizationIntegrationServiceName) {
    this.Uri = uri;
    this.Token = token;
    this.bw_serviceName = bw_serviceName;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
