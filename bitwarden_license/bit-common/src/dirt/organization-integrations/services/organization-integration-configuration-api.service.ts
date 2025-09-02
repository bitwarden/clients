import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  OrganizationId,
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

import { OrganizationIntegrationConfigurationRequest } from "../models/organization-integration-configuration-request";
import { OrganizationIntegrationConfigurationResponse } from "../models/organization-integration-configuration-response";

export class OrganizationIntegrationConfigurationApiService {
  constructor(private apiService: ApiService) {}

  async getOrganizationIntegrationConfigurations(
    orgId: OrganizationId,
    integrationId: OrganizationIntegrationId,
  ): Promise<OrganizationIntegrationConfigurationResponse[]> {
    const responses = await this.apiService.send(
      "GET",
      `organizations/${orgId}/integrations/${integrationId}/configurations`,
      null,
      true,
      true,
    );
    return responses;
  }

  async createOrganizationIntegrationConfiguration(
    orgId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    request: OrganizationIntegrationConfigurationRequest,
  ): Promise<OrganizationIntegrationConfigurationResponse> {
    const response = await this.apiService.send(
      "POST",
      `organizations/${orgId}/integrations/${integrationId}/configurations`,
      request,
      true,
      true,
    );
    return response;
  }

  async updateOrganizationIntegrationConfiguration(
    orgId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
    request: OrganizationIntegrationConfigurationRequest,
  ): Promise<OrganizationIntegrationConfigurationResponse> {
    const response = await this.apiService.send(
      "PUT",
      `organizations/${orgId}/integrations/${integrationId}/configurations/${configurationId}`,
      request,
      true,
      true,
    );
    return response;
  }

  async deleteOrganizationIntegrationConfiguration(
    orgId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
  ): Promise<any> {
    await this.apiService.send(
      "DELETE",
      `organizations/${orgId}/integrations/${integrationId}/configurations/${configurationId}`,
      null,
      true,
      false,
    );
  }
}
