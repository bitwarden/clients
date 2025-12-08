import { OrganizationIntegrationServiceType } from "../../organization-integration-service-type";

export class HecTemplate {
  event = "#EventMessage#";
  source = "Bitwarden";
  index: string;
  service: OrganizationIntegrationServiceType;

  constructor(index: string, service: string) {
    this.index = index;
    this.service = service as OrganizationIntegrationServiceType;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
