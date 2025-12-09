import { OrgIntegrationConfiguration } from "../integration-jsonify";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

export class HecConfiguration implements OrgIntegrationConfiguration {
  uri: string;
  scheme = "Bearer";
  token: string;
  service: OrganizationIntegrationServiceName;

  constructor(uri: string, token: string, service: string) {
    this.uri = uri;
    this.token = token;
    this.service = service as OrganizationIntegrationServiceName;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
