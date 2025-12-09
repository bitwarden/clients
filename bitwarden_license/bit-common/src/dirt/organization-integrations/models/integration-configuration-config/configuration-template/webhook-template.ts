import { OrgIntegrationTemplate } from "../../integration-jsonify";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

// Added to reflect how future webhook integrations could be structured within the OrganizationIntegration
export class WebhookTemplate implements OrgIntegrationTemplate {
  service: OrganizationIntegrationServiceName;
  propA: string;
  propB: string;

  constructor(service: string, propA: string, propB: string) {
    this.service = service as OrganizationIntegrationServiceName;
    this.propA = propA;
    this.propB = propB;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
