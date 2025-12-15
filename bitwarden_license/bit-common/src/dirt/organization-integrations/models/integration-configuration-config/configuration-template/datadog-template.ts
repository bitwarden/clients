import { OrgIntegrationTemplate } from "../../integration-builder";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

export class DatadogTemplate implements OrgIntegrationTemplate {
  source_type_name = "Bitwarden";
  title: string = "#Title#";
  text: string =
    "ActingUser: #ActingUserId#\nUser: #UserId#\nEvent: #Type#\nOrganization: #OrganizationId#\nPolicyId: #PolicyId#\nIpAddress: #IpAddress#\nDomainName: #DomainName#\nCipherId: #CipherId#\n";
  service: OrganizationIntegrationServiceName;

  constructor(service: OrganizationIntegrationServiceName) {
    this.service = service;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
