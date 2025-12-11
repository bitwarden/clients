import { OrgIntegrationTemplate } from "../../integration-jsonify";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

export class DatadogTemplate implements OrgIntegrationTemplate {
  source_type_name = "Bitwarden";
  title: string = "#Title#";
  text: string =
    "ActingUser: #ActingUserId#\nUser: #UserId#\nEvent: #Type#\nOrganization: #OrganizationId#\nPolicyId: #PolicyId#\nIpAddress: #IpAddress#\nDomainName: #DomainName#\nCipherId: #CipherId#\n";
  service: OrganizationIntegrationServiceName;

  constructor(service: string) {
    this.service = service as OrganizationIntegrationServiceName;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
