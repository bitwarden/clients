// eslint-disable-next-line no-restricted-imports
import { OrganizationIntegrationServiceType } from "@bitwarden/bit-common/dirt/integrations";
import { IntegrationType } from "@bitwarden/common/enums";

/** Integration or SDK */
export type Integration = {
  name: string;
  image: string;
  /**
   * Optional image shown in dark mode.
   */
  imageDarkMode?: string;
  linkURL: string;
  type: IntegrationType;
  /**
   * Shows the "New" badge until the defined date.
   * When omitted, the badge is never shown.
   *
   * @example "2024-12-31"
   */
  newBadgeExpiration?: string;
  description?: string;
  isConnected?: boolean;
  canSetupConnection?: boolean;
  configuration?: string;
  template?: string;

  HecConfiguration?: HecConfiguration | null;
  HecConfigurationTemplate?: HecConfigurationTemplate | null;
};

/*
 * Represents the configuration for a HEC (HTTP Event Collector) integration.
 * Configuration model that is required by OrganizationIntegration.
 */
export class HecConfiguration {
  uri: string;
  scheme = "Bearer";
  token: string;
  service: OrganizationIntegrationServiceType;

  constructor(uri: string, token: string, service: string) {
    this.uri = uri;
    this.token = token;
    this.service = service as OrganizationIntegrationServiceType;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}

/**
 * Represents the configuration template for a HEC (HTTP Event Collector) integration.
 * from OrganizationIntegrationConfiguration
 */
export class HecConfigurationTemplate {
  event = "#EventMessage#";
  source = "Bitwarden";
  index: string;
  service: OrganizationIntegrationServiceType;

  constructor(index: string, service: string) {
    this.index = index;
    this.service = service as OrganizationIntegrationServiceType;
  }

  toString(): string {
    return JSON.stringify(this);
  }
}
