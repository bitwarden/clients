import { EventType } from "@bitwarden/common/enums";
import {
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

import { DatadogTemplate } from "./integration-configuration-config/configuration-template/datadog-template";
import { HecTemplate } from "./integration-configuration-config/configuration-template/hec-template";
import { WebhookTemplate } from "./integration-configuration-config/configuration-template/webhook-template";

export class OrganizationIntegrationConfiguration {
  id: OrganizationIntegrationConfigurationId;
  integrationId: OrganizationIntegrationId;
  eventType?: EventType | null;
  filters?: string;
  template?: HecTemplate | WebhookTemplate | DatadogTemplate | null;

  constructor(
    id: OrganizationIntegrationConfigurationId,
    integrationId: OrganizationIntegrationId,
    eventType?: EventType | null,
    filters?: string,
    template?: HecTemplate | WebhookTemplate | DatadogTemplate | null,
  ) {
    this.id = id;
    this.integrationId = integrationId;
    this.eventType = eventType;
    this.filters = filters;
    this.template = template;
  }

  getTemplate<T>(): T | null {
    if (this.template && typeof this.template === "object") {
      return this.template as T;
    }
    return null;
  }
}
