import { OrgIntegrationConfiguration } from "../integration-builder";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

export class HecConfiguration implements OrgIntegrationConfiguration {
  uri: string;
  scheme: string;
  token: string;
  service?: string;
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(
    uri: string,
    token: string,
    bw_serviceName: OrganizationIntegrationServiceName,
    scheme: string = "Bearer",
  ) {
    this.uri = uri;
    this.token = token;
    this.bw_serviceName = bw_serviceName;
    this.scheme = scheme;
  }

  toString(): string {
    return JSON.stringify({
      Uri: this.uri,
      Scheme: this.scheme,
      Token: this.token,
      bw_serviceName: this.bw_serviceName,
    });
  }
}
