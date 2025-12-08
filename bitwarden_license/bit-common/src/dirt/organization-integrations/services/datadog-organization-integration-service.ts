import {
  OrganizationId,
  OrganizationIntegrationId,
  OrganizationIntegrationConfigurationId,
} from "@bitwarden/common/types/guid";

import { DatadogConfiguration } from "../models/configuration/datadog-configuration";
import { DatadogTemplate } from "../models/integration-configuration-config/configuration-template/datadog-template";
import { OrganizationIntegrationServiceType } from "../models/organization-integration-service-type";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import {
  BaseOrganizationIntegrationService,
  IntegrationModificationResult,
} from "./base-organization-integration.service";
import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

/**
 * @deprecated Use IntegrationModificationResult instead
 */
export type DatadogModificationFailureReason = IntegrationModificationResult;

/**
 * Service for managing Datadog organization integrations.
 * Extends BaseOrganizationIntegrationService with Datadog-specific functionality.
 */
export class DatadogOrganizationIntegrationService extends BaseOrganizationIntegrationService<
  DatadogConfiguration,
  DatadogTemplate
> {
  protected readonly integrationType = OrganizationIntegrationType.Datadog;

  constructor(
    integrationApiService: OrganizationIntegrationApiService,
    integrationConfigurationApiService: OrganizationIntegrationConfigurationApiService,
  ) {
    super(integrationApiService, integrationConfigurationApiService);
  }

  protected createConfiguration(
    url: string,
    apiKey: string,
    service: string,
  ): DatadogConfiguration {
    return new DatadogConfiguration(url, apiKey, service);
  }

  protected createTemplate(service: string): DatadogTemplate {
    return new DatadogTemplate(service);
  }

  /**
   * Saves a new Datadog organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param service - Service type of the integration
   * @param url - URL of the service
   * @param apiKey - API key for authentication
   * @returns Promise with the result indicating success or failure reason
   */
  async saveDatadog(
    organizationId: OrganizationId,
    service: OrganizationIntegrationServiceType,
    url: string,
    apiKey: string,
  ): Promise<IntegrationModificationResult> {
    const config = this.createConfiguration(url, apiKey, service);
    const template = this.createTemplate(service);
    return this.save(organizationId, config, template);
  }

  /**
   * Updates an existing Datadog organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationId - ID of the organization integration
   * @param configurationId - ID of the organization integration configuration
   * @param service - Service type of the integration
   * @param url - URL of the service
   * @param apiKey - API key for authentication
   * @returns Promise with the result indicating success or failure reason
   */
  async updateDatadog(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
    service: OrganizationIntegrationServiceType,
    url: string,
    apiKey: string,
  ): Promise<IntegrationModificationResult> {
    const config = this.createConfiguration(url, apiKey, service);
    const template = this.createTemplate(service);
    return this.update(organizationId, integrationId, configurationId, config, template);
  }

  /**
   * Deletes a Datadog organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationId - ID of the organization integration
   * @param configurationId - ID of the organization integration configuration
   * @returns Promise with the result indicating success or failure reason
   */
  async deleteDatadog(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
  ): Promise<IntegrationModificationResult> {
    return this.delete(organizationId, integrationId, configurationId);
  }
}
