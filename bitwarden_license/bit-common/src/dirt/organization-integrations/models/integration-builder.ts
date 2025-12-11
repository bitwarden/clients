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
  service: OrganizationIntegrationServiceName;
  toString(): string;
}

/**
 * Defines the structure for organization integration template
 */
export interface OrgIntegrationTemplate {
  service: OrganizationIntegrationServiceName;
  toString(): string;
}

/**
 * Builder class for creating organization integration configurations and templates
 */
export class OrgIntegrationBuilder {
  static buildHecConfiguration(
    uri: string,
    token: string,
    service: OrganizationIntegrationServiceName,
  ): OrgIntegrationConfiguration {
    return new HecConfiguration(uri, token, service);
  }

  static buildHecTemplate(
    index: string,
    service: OrganizationIntegrationServiceName,
  ): OrgIntegrationTemplate {
    return new HecTemplate(index, service);
  }

  static buildDataDogConfiguration(uri: string, apiKey: string): OrgIntegrationConfiguration {
    return new DatadogConfiguration(uri, apiKey, OrganizationIntegrationServiceName.Datadog);
  }

  static buildDataDogTemplate(service: OrganizationIntegrationServiceName): OrgIntegrationTemplate {
    return new DatadogTemplate(service);
  }

  static buildConfiguration(
    type: OrganizationIntegrationType,
    configuration: string,
  ): OrgIntegrationConfiguration {
    switch (type) {
      case OrganizationIntegrationType.Hec: {
        const hecConfig = this.convertToJson<HecConfiguration>(configuration);
        return this.buildHecConfiguration(hecConfig.uri, hecConfig.token, hecConfig.service);
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
        return this.buildHecTemplate(hecTemplate.index, hecTemplate.service);
      }
      case OrganizationIntegrationType.Datadog: {
        const datadogTemplate = this.convertToJson<DatadogTemplate>(template);
        return this.buildDataDogTemplate(datadogTemplate.service);
      }
      default:
        throw new Error(`Unsupported integration type: ${type}`);
    }
  }

  private static convertToJson<T>(jsonString?: string): T {
    try {
      return JSON.parse(jsonString || "{}") as T;
    } catch {
      throw new Error("Invalid integration configuration: JSON parse error");
    }
  }
}
