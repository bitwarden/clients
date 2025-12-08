import { OrganizationIntegrationId } from "@bitwarden/common/types/guid";

import { DatadogConfiguration } from "./configuration/datadog-configuration";
import { HecConfiguration } from "./configuration/hec-configuration";
import { WebhookConfiguration } from "./configuration/webhook-configuration";
import { OrganizationIntegrationConfiguration } from "./organization-integration-configuration";
import { OrganizationIntegrationServiceType } from "./organization-integration-service-type";
import { OrganizationIntegrationType } from "./organization-integration-type";

export class OrganizationIntegration {
  id: OrganizationIntegrationId;
  type: OrganizationIntegrationType;
  serviceType: OrganizationIntegrationServiceType;
  configuration: HecConfiguration | WebhookConfiguration | DatadogConfiguration | null;
  integrationConfiguration: OrganizationIntegrationConfiguration[] = [];

  constructor(
    id: OrganizationIntegrationId,
    type: OrganizationIntegrationType,
    serviceType: OrganizationIntegrationServiceType,
    configuration: HecConfiguration | WebhookConfiguration | DatadogConfiguration | null,
    integrationConfiguration: OrganizationIntegrationConfiguration[] = [],
  ) {
    this.id = id;
    this.type = type;
    this.serviceType = serviceType;
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
