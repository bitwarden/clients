import { OrgIntegrationTemplate } from "../../integration-builder";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

export class HecTemplate implements OrgIntegrationTemplate {
  event = "#EventMessage#";
  source = "Bitwarden";
  index: string;
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(index: string, service: OrganizationIntegrationServiceName) {
    this.index = index;
    this.bw_serviceName = service;
  }

  toString(): string {
    return JSON.stringify({
      Event: this.event,
      Source: this.source,
      Index: this.index,
      bw_serviceName: this.bw_serviceName,
    });
  }
}
