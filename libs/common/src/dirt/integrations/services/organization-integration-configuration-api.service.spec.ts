import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  OrganizationId,
  OrganizationIntegrationId,
  OrganizationIntegrationConfigurationId,
} from "@bitwarden/common/types/guid";

import { OrganizationIntegrationConfigurationRequest } from "../models/organization-integration-configuration-request";

import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

export const mockConfigurationResponse: any = {
  id: "1" as OrganizationIntegrationConfigurationId,
  template: "{ 'event': '#EventMessage#', 'source': 'Bitwarden', 'index': 'testIndex' }",
};

export const mockConfigurationResponses: any[] = [
  {
    id: "1" as OrganizationIntegrationConfigurationId,
    template: "{ 'event': '#EventMessage#', 'source': 'Bitwarden', 'index': 'testIndex' }",
  },
  {
    id: "2" as OrganizationIntegrationConfigurationId,
    template: "{ 'event': '#EventMessage#', 'source': 'Bitwarden', 'index': 'otherIndex' }",
  },
];

describe("OrganizationIntegrationConfigurationApiService", () => {
  let service: OrganizationIntegrationConfigurationApiService;
  const apiService = mock<ApiService>();

  beforeEach(() => {
    service = new OrganizationIntegrationConfigurationApiService(apiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should call apiService.send with correct parameters for getOrganizationIntegrationConfigurations", async () => {
    const orgId = "org1" as OrganizationId;
    const integrationId = "integration1" as OrganizationIntegrationId;

    apiService.send.mockReturnValue(Promise.resolve(mockConfigurationResponses));

    const result = await service.getOrganizationIntegrationConfigurations(orgId, integrationId);
    expect(result).toEqual(mockConfigurationResponses);
    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      `organizations/${orgId}/integrations/${integrationId}/configurations`,
      null,
      true,
      true,
    );
  });

  it("should call apiService.send with correct parameters for createOrganizationIntegrationConfiguration", async () => {
    const request = new OrganizationIntegrationConfigurationRequest(
      null,
      null,
      null,
      "{ 'event': '#EventMessage#', 'source': 'Bitwarden', 'index': 'testIndex' }",
    );
    const orgId = "org1" as OrganizationId;
    const integrationId = "integration1" as OrganizationIntegrationId;

    apiService.send.mockReturnValue(Promise.resolve(mockConfigurationResponse));

    const result = await service.createOrganizationIntegrationConfiguration(
      orgId,
      integrationId,
      request,
    );
    expect(result.eventType).toEqual(mockConfigurationResponse.eventType);
    expect(result.template).toEqual(mockConfigurationResponse.template);
    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      `organizations/${orgId}/integrations/${integrationId}/configurations`,
      request,
      true,
      true,
    );
  });

  it("should call apiService.send with correct parameters for updateOrganizationIntegrationConfiguration", async () => {
    const request = new OrganizationIntegrationConfigurationRequest(
      null,
      null,
      null,
      "{ 'event': '#EventMessage#', 'source': 'Bitwarden', 'index': 'testIndex' }",
    );
    const orgId = "org1" as OrganizationId;
    const integrationId = "integration1" as OrganizationIntegrationId;
    const configurationId = "configurationId" as OrganizationIntegrationConfigurationId;

    apiService.send.mockReturnValue(Promise.resolve(mockConfigurationResponse));

    const result = await service.updateOrganizationIntegrationConfiguration(
      orgId,
      integrationId,
      configurationId,
      request,
    );
    expect(result.eventType).toEqual(mockConfigurationResponse.eventType);
    expect(result.template).toEqual(mockConfigurationResponse.template);
    expect(apiService.send).toHaveBeenCalledWith(
      "PUT",
      `organizations/${orgId}/integrations/${integrationId}/configurations/${configurationId}`,
      request,
      true,
      true,
    );
  });

  it("should call apiService.send with correct parameters for deleteOrganizationIntegrationConfiguration", async () => {
    const orgId = "org1" as OrganizationId;
    const integrationId = "integration1" as OrganizationIntegrationId;
    const configurationId = "configurationId" as OrganizationIntegrationConfigurationId;

    await service.deleteOrganizationIntegrationConfiguration(orgId, integrationId, configurationId);

    expect(apiService.send).toHaveBeenCalledWith(
      "DELETE",
      `organizations/${orgId}/integrations/${integrationId}/configurations/${configurationId}`,
      null,
      true,
      false,
    );
  });
});
