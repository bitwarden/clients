import { EventType } from "@bitwarden/common/enums";

export class OrganizationIntegrationConfigurationRequest {
  eventType?: EventType | null = null;
  configuration?: string | null = null;
  filters?: string | null = null;
  template?: string | null = null;

  constructor(
    eventType?: EventType | null,
    configuration?: string | null,
    filters?: string | null,
    template?: string | null,
  ) {
    this.eventType = eventType;
    this.configuration = configuration;
    this.filters = filters;
    this.template = template;
  }
}
