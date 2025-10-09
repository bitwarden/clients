import { OrganizationIntegrationServiceType } from "../../organization-integration-service-type";

export class DatadogTemplate {
  source_type_name = "Bitwarden";
  title: string = "#Title#";
  text: string =
    "ActingUser: #ActingUserId#\nUser: #UserId#\nEvent: #Type#\nOrganization: #OrganizationId#\nPolicyId: #PolicyId#\nIpAddress: #IpAddress#\nDomainName: #DomainName#\nCipherId: #CipherId#\n";
  service: OrganizationIntegrationServiceType;

  constructor(service: string) {
    this.service = service as OrganizationIntegrationServiceType;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
