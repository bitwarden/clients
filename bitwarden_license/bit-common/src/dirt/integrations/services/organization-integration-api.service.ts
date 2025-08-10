import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId, OrganizationIntegrationId } from "@bitwarden/common/types/guid";

import { OrganizationIntegrationRequest } from "../models/organization-integration-request";
import { OrganizationIntegrationResponse } from "../models/organization-integration-response";

@Injectable()
export class OrganizationIntegrationApiService {
  constructor(private apiService: ApiService) {}

  async getOrganizationIntegrations(
    orgId: OrganizationId,
  ): Promise<OrganizationIntegrationResponse[]> {
    const response = await this.apiService.send(
      "GET",
      `/organizations/${orgId}/integrations`,
      null,
      true,
      true,
    );
    return response;
  }

  async createOrganizationIntegration(
    orgId: OrganizationId,
    request: OrganizationIntegrationRequest,
  ): Promise<OrganizationIntegrationResponse> {
    const response = await this.apiService.send(
      "POST",
      `/organizations/${orgId}/integrations`,
      request,
      true,
      true,
    );
    return response;
  }

  async updateOrganizationIntegration(
    orgId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    request: OrganizationIntegrationRequest,
  ): Promise<OrganizationIntegrationResponse> {
    const response = await this.apiService.send(
      "PUT",
      `/organizations/${orgId}/integrations/${integrationId}`,
      request,
      true,
      true,
    );
    return response;
  }

  async deleteOrganizationIntegration(
    orgId: OrganizationId,
    integrationId: OrganizationIntegrationId,
  ): Promise<any> {
    await this.apiService.send(
      "DELETE",
      `/organizations/${orgId}/integrations/${integrationId}`,
      null,
      true,
      false,
    );
  }
}
