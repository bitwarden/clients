import { EventType } from "@bitwarden/common/enums";

export class OrganizationIntegrationConfigurationRequest {
  eventType?: EventType;
  configuration?: string;
  filters?: string;
  template?: string;

  constructor(eventType?: EventType, configuration?: string, filters?: string, template?: string) {
    this.eventType = eventType;
    this.configuration = configuration;
    this.filters = filters;
    this.template = template;
  }
}
