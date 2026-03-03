import { EventType } from "@bitwarden/common/enums";
import {
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

import { OrgIntegrationTemplate } from "./integration-builder";

export class OrganizationIntegrationConfiguration {
  id: OrganizationIntegrationConfigurationId;
  integrationId: OrganizationIntegrationId;
  eventType?: EventType | null;
  filters?: string;
  template?: OrgIntegrationTemplate | null;

  constructor(
    id: OrganizationIntegrationConfigurationId,
    integrationId: OrganizationIntegrationId,
    eventType?: EventType | null,
    filters?: string,
    template?: OrgIntegrationTemplate | null,
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
