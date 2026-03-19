import { OrganizationIntegrationId } from "@bitwarden/common/types/guid";

import { OrgIntegrationConfiguration } from "./integration-builder";
import { OrganizationIntegrationConfiguration } from "./organization-integration-configuration";
import { OrganizationIntegrationServiceName } from "./organization-integration-service-type";
import { OrganizationIntegrationType } from "./organization-integration-type";

export class OrganizationIntegration {
  id: OrganizationIntegrationId;
  type: OrganizationIntegrationType;
  serviceName: OrganizationIntegrationServiceName;
  configuration: OrgIntegrationConfiguration | null;
  integrationConfiguration: OrganizationIntegrationConfiguration[] = [];

  constructor(
    id: OrganizationIntegrationId,
    type: OrganizationIntegrationType,
    serviceName: OrganizationIntegrationServiceName,
    configuration: OrgIntegrationConfiguration | null,
    integrationConfiguration: OrganizationIntegrationConfiguration[] = [],
  ) {
    this.id = id;
    this.type = type;
    this.serviceName = serviceName;
    this.configuration = configuration;
    this.integrationConfiguration = integrationConfiguration;
  }

  getConfiguration<T>(): T | null {
    if (this.configuration && typeof this.configuration === "object") {
      return this.configuration as T;
    }
    return null;
  }
}
