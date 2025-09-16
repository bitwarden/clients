import { OrganizationIntegrationServiceType } from "../organization-integration-service-type";

export class HecConfiguration {
  uri: string;
  scheme = "Bearer";
  token: string;
  service: OrganizationIntegrationServiceType;

  constructor(uri: string, token: string, service: string) {
    this.uri = uri;
    this.token = token;
    this.service = service as OrganizationIntegrationServiceType;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
