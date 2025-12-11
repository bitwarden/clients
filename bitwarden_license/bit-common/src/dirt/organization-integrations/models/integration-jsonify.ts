import { OrganizationIntegrationServiceName } from "./organization-integration-service-type";

export interface OrgIntegrationConfiguration {
  service: OrganizationIntegrationServiceName;
  toString(): string;
}

export interface OrgIntegrationTemplate {
  service: OrganizationIntegrationServiceName;
  toString(): string;
}
