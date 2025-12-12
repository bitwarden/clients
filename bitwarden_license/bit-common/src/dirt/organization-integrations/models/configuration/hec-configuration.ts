import { OrgIntegrationConfiguration } from "../integration-builder";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

export class HecConfiguration implements OrgIntegrationConfiguration {
  uri: string;
  scheme = "Bearer";
  token: string;
  service: OrganizationIntegrationServiceName;

  constructor(uri: string, token: string, service: OrganizationIntegrationServiceName) {
    this.uri = uri;
    this.token = token;
    this.service = service;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
