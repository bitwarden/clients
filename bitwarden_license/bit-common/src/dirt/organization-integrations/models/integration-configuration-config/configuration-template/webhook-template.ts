import { OrgIntegrationTemplate } from "../../integration-builder";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

// Added to reflect how future webhook integrations could be structured within the OrganizationIntegration
export class WebhookTemplate implements OrgIntegrationTemplate {
  bw_serviceName: OrganizationIntegrationServiceName;
  propA: string;
  propB: string;

  constructor(bw_serviceName: OrganizationIntegrationServiceName, propA: string, propB: string) {
    this.bw_serviceName = bw_serviceName;
    this.propA = propA;
    this.propB = propB;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
