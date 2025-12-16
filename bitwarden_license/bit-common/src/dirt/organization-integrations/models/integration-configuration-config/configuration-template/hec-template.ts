import { OrgIntegrationTemplate } from "../../integration-builder";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

export class HecTemplate implements OrgIntegrationTemplate {
  event = "#EventMessage#";
  source = "Bitwarden";
  index: string;
  service: OrganizationIntegrationServiceName;

  constructor(index: string, service: OrganizationIntegrationServiceName) {
    this.index = index;
    this.service = service;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
