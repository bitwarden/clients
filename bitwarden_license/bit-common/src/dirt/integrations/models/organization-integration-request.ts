import { OrganizationIntegrationType } from "./organization-integration-type";

export class OrganizationIntegrationRequest {
  type: OrganizationIntegrationType;
  configuration?: string;

  constructor(integrationType: OrganizationIntegrationType, configuration?: string) {
    this.type = integrationType;
    this.configuration = configuration;
  }
}

/*
 * Represents the configuration for a HEC (HTTP Event Collector) integration.
 * Configuration model that is required by OrganizationIntegration.
 */
export class HecConfiguration {
  uri: string;
  scheme = "Bearer";
  token: string;
  service: string;

  constructor(uri: string, token: string, service: string) {
    this.uri = uri;
    this.token = token;
    this.service = service;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}

export class HecConfigurationTemplate {
  event = "#EventMessage";
  source = "Bitwarden";
  index: string;
  service: string;

  constructor(index: string, service: string) {
    this.index = index;
    this.service = service;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
