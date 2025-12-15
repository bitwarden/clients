import { OrgIntegrationConfiguration } from "../integration-builder";
import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

// Added to reflect how future webhook integrations could be structured within the OrganizationIntegration
export class WebhookConfiguration implements OrgIntegrationConfiguration {
  propA: string;
  propB: string;
  service: OrganizationIntegrationServiceName;

  constructor(propA: string, propB: string, service: OrganizationIntegrationServiceName) {
    this.propA = propA;
    this.propB = propB;
    this.service = service;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
