import { DatadogConfiguration } from "./configuration/datadog-configuration";
import { HecConfiguration } from "./configuration/hec-configuration";
import { DatadogTemplate } from "./integration-configuration-config/configuration-template/datadog-template";
import { HecTemplate } from "./integration-configuration-config/configuration-template/hec-template";
import { OrganizationIntegrationServiceName } from "./organization-integration-service-type";
import { OrganizationIntegrationType } from "./organization-integration-type";

/**
 * Defines the structure for organization integration configuration
 */
export interface OrgIntegrationConfiguration {
  bw_serviceName: OrganizationIntegrationServiceName;
  toString(): string;
}

/**
 * Defines the structure for organization integration template
 */
export interface OrgIntegrationTemplate {
  bw_serviceName: OrganizationIntegrationServiceName;
  toString(): string;
}

export const Schemas = {
  Bearer: "Bearer",
  Splunk: "Splunk",
} as const;

/**
 * Builder class for creating organization integration configurations and templates
 */
export class OrgIntegrationBuilder {
  static buildHecConfiguration(
    uri: string,
    token: string,
    bw_serviceName: OrganizationIntegrationServiceName,
    scheme: string = Schemas.Bearer,
  ): OrgIntegrationConfiguration {
    return new HecConfiguration(uri, token, bw_serviceName, scheme);
  }

  static buildHecTemplate(
    index: string,
    bw_serviceName: OrganizationIntegrationServiceName,
  ): OrgIntegrationTemplate {
    return new HecTemplate(index, bw_serviceName);
  }

  static buildDataDogConfiguration(uri: string, apiKey: string): OrgIntegrationConfiguration {
    return new DatadogConfiguration(uri, apiKey, OrganizationIntegrationServiceName.Datadog);
  }

  static buildDataDogTemplate(
    bw_serviceName: OrganizationIntegrationServiceName,
  ): OrgIntegrationTemplate {
    return new DatadogTemplate(bw_serviceName);
  }

  static buildConfiguration(
    type: OrganizationIntegrationType,
    configuration: string,
  ): OrgIntegrationConfiguration {
    switch (type) {
      case OrganizationIntegrationType.Hec: {
        const hecConfig = this.convertToJson<HecConfiguration>(configuration);
        return this.buildHecConfiguration(
          hecConfig.uri,
          hecConfig.token,
          hecConfig.bw_serviceName,
          hecConfig.scheme,
        );
      }
      case OrganizationIntegrationType.Datadog: {
        const datadogConfig = this.convertToJson<DatadogConfiguration>(configuration);
        return this.buildDataDogConfiguration(datadogConfig.uri, datadogConfig.apiKey);
      }
      default:
        throw new Error(`Unsupported integration type: ${type}`);
    }
  }

  static buildTemplate(
    type: OrganizationIntegrationType,
    template: string,
  ): OrgIntegrationTemplate {
    switch (type) {
      case OrganizationIntegrationType.Hec: {
        const hecTemplate = this.convertToJson<HecTemplate>(template);
        return this.buildHecTemplate(hecTemplate.index, hecTemplate.bw_serviceName);
      }
      case OrganizationIntegrationType.Datadog: {
        const datadogTemplate = this.convertToJson<DatadogTemplate>(template);
        return this.buildDataDogTemplate(datadogTemplate.bw_serviceName);
      }
      default:
        throw new Error(`Unsupported integration type: ${type}`);
    }
  }

  private static convertToJson<T>(jsonString?: string): T {
    try {
      const parsed = JSON.parse(jsonString || "{}");
      return this.normalizePropertyCase(parsed) as T;
    } catch {
      throw new Error("Invalid integration configuration: JSON parse error");
    }
  }

  /**
   * Recursively normalizes object property names to camelCase
   * Converts the first character of each property to lowercase
   */
  private static normalizePropertyCase(obj: any): any {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizePropertyCase(item));
    }

    const normalized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1);
        normalized[normalizedKey] = this.normalizePropertyCase(obj[key]);
      }
    }
    return normalized;
  }
}
