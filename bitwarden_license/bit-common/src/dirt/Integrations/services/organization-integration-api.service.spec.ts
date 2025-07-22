import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationId, OrganizationIntegrationId } from "@bitwarden/common/types/guid";

import { OrganizationIntegrationRequest } from "../models/organization-integration-request";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationServiceType } from "../models/organization-integration-service-type";

export const mockIntegrationResponse: any = {
  id: "1" as OrganizationIntegrationId,
  organizationIntegrationType: OrganizationIntegrationType.Hec,
};

export const mockIntegrationResponses: any[] = [
  {
    id: "1" as OrganizationIntegrationId,
    OrganizationIntegrationType: OrganizationIntegrationType.Hec,
  },
  {
    id: "2" as OrganizationIntegrationId,
    OrganizationIntegrationType: OrganizationIntegrationType.Webhook,
  },
];

describe("OrganizationIntegrationApiService", () => {
  let service: OrganizationIntegrationApiService;
  const apiService = mock<ApiService>();

  beforeEach(() => {
    service = new OrganizationIntegrationApiService(apiService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("should call apiService.send with correct parameters for getOrganizationIntegrations", async () => {
    const orgId = "org1" as OrganizationId;

    apiService.send.mockReturnValue(Promise.resolve(mockIntegrationResponses));

    const result = await service.getOrganizationIntegrations(orgId);
    expect(result).toEqual(mockIntegrationResponses);
    expect(apiService.send).toHaveBeenCalledWith(
      "GET",
      `organizations/${orgId}/integrations`,
      null,
      true,
      true,
    );
  });

  it("should call apiService.send with correct parameters for createOrganizationIntegration", async () => {
    const request = new OrganizationIntegrationRequest(
      OrganizationIntegrationType.Hec,
      `{ 'uri:' 'test.com', 'scheme:' 'bearer', 'token:' '123456789', 'service:' '${OrganizationIntegrationServiceType.CrowdStrike}' }`,
    );
    const orgId = "org1" as OrganizationId;

    apiService.send.mockReturnValue(Promise.resolve(mockIntegrationResponse));

    const result = await service.createOrganizationIntegration(orgId, request);
    expect(result.organizationIntegrationType).toEqual(
      mockIntegrationResponse.organizationIntegrationType,
    );
    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      `organizations/${orgId.toString()}/integrations`,
      request,
      true,
      true,
    );
  });

  it("should call apiService.send with the correct parameters for updateOrganizationIntegration", async () => {
    const request = new OrganizationIntegrationRequest(
      OrganizationIntegrationType.Hec,
      `{ 'uri:' 'test.com', 'scheme:' 'bearer', 'token:' '123456789', 'service:' '${OrganizationIntegrationServiceType.CrowdStrike}' }`,
    );
    const orgId = "org1" as OrganizationId;
    const integrationId = "integration1" as OrganizationIntegrationId;

    apiService.send.mockReturnValue(Promise.resolve(mockIntegrationResponse));

    const result = await service.updateOrganizationIntegration(orgId, integrationId, request);
    expect(result.organizationIntegrationType).toEqual(
      mockIntegrationResponse.organizationIntegrationType,
    );
    expect(apiService.send).toHaveBeenCalledWith(
      "PUT",
      `organizations/${orgId}/integrations/${integrationId}`,
      request,
      true,
      true,
    );
  });

  it("should call apiService.send with the correct parameters for deleteOrganizationIntegration", async () => {
    const orgId = "org1" as OrganizationId;
    const integrationId = "integration1" as OrganizationIntegrationId;

    await service.deleteOrganizationIntegration(orgId, integrationId);

    expect(apiService.send).toHaveBeenCalledWith(
      "DELETE",
      `organizations/${orgId}/integrations/${integrationId}`,
      null,
      true,
      false,
    );
  });
});
