import { OrgIntegrationTemplate } from "../../integration-builder";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

// Added to reflect how future webhook integrations could be structured within the OrganizationIntegration
export class WebhookTemplate implements OrgIntegrationTemplate {
  service: OrganizationIntegrationServiceName;
  propA: string;
  propB: string;

  constructor(service: OrganizationIntegrationServiceName, propA: string, propB: string) {
    this.service = service;
    this.propA = propA;
    this.propB = propB;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
