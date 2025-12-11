import { OrgIntegrationTemplate } from "../../integration-jsonify";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

export class HecTemplate implements OrgIntegrationTemplate {
  event = "#EventMessage#";
  source = "Bitwarden";
  index: string;
  service: OrganizationIntegrationServiceName;

  constructor(index: string, service: string) {
    this.index = index;
    this.service = service as OrganizationIntegrationServiceName;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
