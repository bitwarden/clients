import { EventType } from "@bitwarden/common/enums";
import {
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

import { HecTemplate } from "./integration-configuration-config/configuration-template/hec-template";
import { WebhookTemplate } from "./integration-configuration-config/configuration-template/webhook-template";
import { WebhookIntegrationConfigurationConfig } from "./integration-configuration-config/webhook-integration-configuration-config";

export class OrganizationIntegrationConfiguration {
  id: OrganizationIntegrationConfigurationId;
  integrationId: OrganizationIntegrationId;
  eventType?: EventType;
  configuration?: WebhookIntegrationConfigurationConfig | null;
  filters?: string;
  template?: HecTemplate | WebhookTemplate | null;

  constructor(
    id: OrganizationIntegrationConfigurationId,
    integrationId: OrganizationIntegrationId,
    eventType?: EventType | null,
    configuration?: WebhookIntegrationConfigurationConfig | null,
    filters?: string,
    template?: HecTemplate | WebhookTemplate | null,
  ) {
    this.id = id;
    this.integrationId = integrationId;
    this.eventType = eventType;
    this.configuration = configuration;
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
