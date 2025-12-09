import {
  OrganizationId,
  OrganizationIntegrationId,
  OrganizationIntegrationConfigurationId,
} from "@bitwarden/common/types/guid";

import { HecConfiguration } from "../models/configuration/hec-configuration";
import { HecTemplate } from "../models/integration-configuration-config/configuration-template/hec-template";
import { OrganizationIntegrationServiceName } from "../models/organization-integration-service-type";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import {
  BaseOrganizationIntegrationService,
  IntegrationModificationResult,
} from "./base-organization-integration.service";
import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

/**
 * Service for managing HEC (HTTP Event Collector) organization integrations.
 * Extends BaseOrganizationIntegrationService with HEC-specific functionality.
 */
export class HecOrganizationIntegrationService extends BaseOrganizationIntegrationService<
  HecConfiguration,
  HecTemplate
> {
  protected readonly integrationType = OrganizationIntegrationType.Hec;

  constructor(
    integrationApiService: OrganizationIntegrationApiService,
    integrationConfigurationApiService: OrganizationIntegrationConfigurationApiService,
  ) {
    super(integrationApiService, integrationConfigurationApiService);
  }

  private createConfiguration(url: string, bearerToken: string, service: string): HecConfiguration {
    return new HecConfiguration(url, bearerToken, service);
  }

  private createTemplate(index: string, service: string): HecTemplate {
    return new HecTemplate(index, service);
  }

  /**
   * Saves a new HEC organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param service - Service type of the integration
   * @param url - URL of the service
   * @param bearerToken - API bearer token
   * @param index - Index in service
   * @returns Promise with the result indicating success or failure reason
   */
  async saveHec(
    organizationId: OrganizationId,
    service: OrganizationIntegrationServiceName,
    url: string,
    bearerToken: string,
    index: string,
  ): Promise<IntegrationModificationResult> {
    const config = this.createConfiguration(url, bearerToken, service);
    const template = this.createTemplate(index, service);
    return this.save(organizationId, config, template);
  }

  /**
   * Updates an existing HEC organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationId - ID of the organization integration
   * @param configurationId - ID of the organization integration configuration
   * @param service - Service type of the integration
   * @param url - URL of the service
   * @param bearerToken - API bearer token
   * @param index - Index in service
   * @returns Promise with the result indicating success or failure reason
   */
  async updateHec(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
    service: OrganizationIntegrationServiceName,
    url: string,
    bearerToken: string,
    index: string,
  ): Promise<IntegrationModificationResult> {
    const config = this.createConfiguration(url, bearerToken, service);
    const template = this.createTemplate(index, service);
    return this.update(organizationId, integrationId, configurationId, config, template);
  }

  /**
   * Deletes a HEC organization integration and updates the integrations$ observable.
   *
   * @param organizationId - ID of the organization
   * @param integrationId - ID of the organization integration
   * @param configurationId - ID of the organization integration configuration
   * @returns Promise with the result indicating success or failure reason
   */
  async deleteHec(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
  ): Promise<IntegrationModificationResult> {
    return this.delete(organizationId, integrationId, configurationId);
  }
}
