import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import {
  OrganizationIntegrationApiService,
  OrganizationIntegrationConfigurationApiService,
  OrganizationIntegrationConfigurationRequest,
  OrganizationIntegrationConfigurationResponse,
  HecConfiguration,
  OrganizationIntegrationRequest,
  OrganizationIntegrationResponse,
  OrganizationIntegrationType,
  HecConfigurationTemplate,
  OrganizationIntegrationConfigurationResponseWithIntegrationId,
} from "@bitwarden/bit-common/dirt/integrations";
import { OrganizationId, OrganizationIntegrationId } from "@bitwarden/common/types/guid";

@Injectable({
  providedIn: "root",
})
export class OrganizationIntegrationService {
  private integrations = new BehaviorSubject<OrganizationIntegrationResponse[]>([]);
  integrations$ = this.integrations.asObservable();

  private integrationConfigurations = new BehaviorSubject<
    OrganizationIntegrationConfigurationResponseWithIntegrationId[]
  >([]);
  integrationConfigurations$ = this.integrationConfigurations.asObservable();

  constructor(
    private integrationApiService: OrganizationIntegrationApiService,
    private integrationConfigurationApiService: OrganizationIntegrationConfigurationApiService,
  ) {}

  /*
   * Fetches the integrations and their configurations for a specific organization.
   * @param orgId The ID of the organization.
   * Invoke this method to retrieve the integrations into observable.
   */
  async getIntegrationsAndConfigurations(orgId: OrganizationId) {
    const promises: Promise<void>[] = [];

    const integrations = await this.integrationApiService.getOrganizationIntegrations(orgId);
    const integrationConfigurations: OrganizationIntegrationConfigurationResponseWithIntegrationId[] =
      [];

    integrations.forEach((integration) => {
      const promise = this.integrationConfigurationApiService
        .getOrganizationIntegrationConfigurations(orgId, integration.id)
        .then((configs) => {
          const mappedConfigurations =
            new OrganizationIntegrationConfigurationResponseWithIntegrationId(
              integration.id,
              configs,
            );
          integrationConfigurations.push(mappedConfigurations);
        });
      promises.push(promise);
    });

    await Promise.all(promises);

    this.integrations.next(integrations);
    this.integrationConfigurations.next(integrationConfigurations);

    return {
      integrations: integrations,
      configurations: integrationConfigurations,
    };
  }

  async saveHec(
    organizationId: OrganizationId,
    service: string,
    hecConfiguration: HecConfiguration,
    hecConfigurationTemplate: HecConfigurationTemplate,
  ) {
    const integrationResponse = await this.saveHecIntegration(organizationId, hecConfiguration);

    if (!integrationResponse.id) {
      throw new Error("Failed to save HEC integration");
    }

    // Save the configuration for the HEC integration
    const configurationResponse = await this.saveHecIntegrationConfiguration(
      organizationId,
      integrationResponse.id,
      service,
      hecConfigurationTemplate,
    );

    if (!configurationResponse.id) {
      throw new Error("Failed to save HEC integration configuration");
    }

    return {
      integration: integrationResponse,
      configuration: configurationResponse,
    };
  }

  /**
   * Saves the HEC integration configuration for a specific organization.
   * @param organizationId The ID of the organization.
   * @param configuration The HEC integration configuration.
   * @param index The index of the integration configuration to update, if it exists.
   * @returns The saved or updated integration response.
   *
   * This method checks if an existing HEC integration exists for the organization.
   * If it does, it updates the existing integration; otherwise, it creates a new one.
   * The method returns the saved or updated integration response.
   */
  async saveHecIntegration(
    organizationId: OrganizationId,
    hecConfiguration: HecConfiguration,
  ): Promise<OrganizationIntegrationResponse> {
    const request = new OrganizationIntegrationRequest(
      OrganizationIntegrationType.Hec,
      hecConfiguration.toString(),
    );

    // find the existing integration
    const existingIntegration = this.integrations.value.find(
      (i) => i.type === OrganizationIntegrationType.Hec,
    );

    if (existingIntegration) {
      // existing integration record found, invoke update API endpoint
      const updatedIntegration = await this.integrationApiService.updateOrganizationIntegration(
        organizationId,
        existingIntegration.id,
        request,
      );

      // update our observable with the updated integration
      const updatedIntegrations = this.integrations.value.map((integration) => {
        if (integration.id === existingIntegration.id) {
          return updatedIntegration;
        }
        return integration;
      });

      this.integrations.next(updatedIntegrations);

      return updatedIntegration;
    } else {
      // no existing integration found, invoke create API endpoint
      const newIntegration = await this.integrationApiService.createOrganizationIntegration(
        organizationId,
        request,
      );

      // add this to our integrations observable
      this.integrations.next([...this.integrations.value, newIntegration]);
      return newIntegration;
    }
  }

  /** * Saves the HEC integration configuration for a specific organization and integration.
   * @param organizationId The ID of the organization.
   * @param integrationId The ID of the integration.
   * @param configurationTemplate The HEC integration configuration.
   * @returns The saved or updated integration configuration response.
   *
   * This method checks if an existing configuration exists for the given integration.
   * If it does, it updates the existing configuration; otherwise, it creates a new one.
   * The method returns the saved or updated configuration response.
   */
  async saveHecIntegrationConfiguration(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    service: string,
    configurationTemplate: HecConfigurationTemplate,
  ): Promise<OrganizationIntegrationConfigurationResponse> {
    const request = new OrganizationIntegrationConfigurationRequest(
      null,
      null,
      null,
      configurationTemplate.toString(),
    );

    // check if we have an existing configuration for this integration - in case of new records
    const integrationConfigurations = this.integrationConfigurations.value;

    // find the existing configuration
    const existingConfigurations = integrationConfigurations
      .filter((config) => config.integrationId === integrationId)
      .flatMap((config) => config.configurationResponses || []);

    const existingConfiguration =
      existingConfigurations.length > 0
        ? existingConfigurations.find(
            (config) =>
              config.template &&
              this.convertToJson<HecConfigurationTemplate>(config.template)?.service === service,
          )
        : null;

    if (existingConfiguration) {
      // existing configuration found, invoke update API endpoint
      const updatedConfiguration =
        await this.integrationConfigurationApiService.updateOrganizationIntegrationConfiguration(
          organizationId,
          integrationId,
          existingConfiguration.id,
          request,
        );

      // update our configurations for the integration
      integrationConfigurations.forEach((integrationConfig) => {
        if (integrationConfig.integrationId === integrationId) {
          integrationConfig.configurationResponses = integrationConfig.configurationResponses.map(
            (config) => {
              return config.id === existingConfiguration.id ? updatedConfiguration : config;
            },
          );
        }
      });

      this.integrationConfigurations.next(integrationConfigurations);

      return updatedConfiguration;
    } else {
      // no existing configuration found, invoke create API endpoint
      const newConfiguration =
        await this.integrationConfigurationApiService.createOrganizationIntegrationConfiguration(
          organizationId,
          integrationId,
          request,
        );

      // add the new configuration to the integration configurations
      const integrationConfig = integrationConfigurations.find(
        (config) => config.integrationId === integrationId,
      );
      if (integrationConfig) {
        integrationConfig.configurationResponses.push(newConfiguration);
      }

      this.integrationConfigurations.next(integrationConfigurations);
      return newConfiguration;
    }
  }

  getIntegrationConfiguration(
    integrationId: OrganizationIntegrationId,
    service: string,
    integrationConfigurations: OrganizationIntegrationConfigurationResponseWithIntegrationId[],
  ): HecConfigurationTemplate | null {
    if (integrationConfigurations.length === 0) {
      return null;
    }

    const integrationConfigs = integrationConfigurations.find(
      (config) => config.integrationId === integrationId,
    );

    if (!integrationConfigs) {
      return null;
    }

    for (const config of integrationConfigs.configurationResponses) {
      const template = this.convertToJson<HecConfigurationTemplate>(config.template || "");
      if (template && template.service === service) {
        return template;
      }
    }

    return null;
  }

  convertToJson<T>(jsonString: string): T | null {
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return null;
    }
  }
}
