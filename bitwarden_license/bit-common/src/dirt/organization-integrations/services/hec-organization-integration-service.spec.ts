import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  OrganizationId,
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

import { OrganizationIntegrationConfigurationResponse } from "../models/organization-integration-configuration-response";
import { OrganizationIntegrationResponse } from "../models/organization-integration-response";
import { OrganizationIntegrationServiceName } from "../models/organization-integration-service-type";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import { HecOrganizationIntegrationService } from "./hec-organization-integration-service";
import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

describe("HecOrganizationIntegrationService", () => {
  let service: HecOrganizationIntegrationService;
  const mockIntegrationApiService = mock<OrganizationIntegrationApiService>();
  const mockIntegrationConfigurationApiService =
    mock<OrganizationIntegrationConfigurationApiService>();
  const organizationId = "org-1" as OrganizationId;
  const integrationId = "int-1" as OrganizationIntegrationId;
  const configId = "conf-1" as OrganizationIntegrationConfigurationId;
  const serviceType = OrganizationIntegrationServiceName.CrowdStrike;
  const url = "https://example.com";
  const bearerToken = "token";
  const index = "main";

  beforeEach(() => {
    service = new HecOrganizationIntegrationService(
      mockIntegrationApiService,
      mockIntegrationConfigurationApiService,
    );

    jest.resetAllMocks();
  });

  it("should set organization integrations", (done) => {
    mockIntegrationApiService.getOrganizationIntegrations.mockResolvedValue([]);
    service.setOrganizationIntegrations(organizationId);
    const subscription = service.integrations$.subscribe((integrations) => {
      expect(integrations).toEqual([]);
      subscription.unsubscribe();
      done();
    });
  });

  it("should save a new Hec integration", async () => {
    service.setOrganizationIntegrations(organizationId);

    const integrationResponse = {
      id: integrationId,
      type: OrganizationIntegrationType.Hec,
      configuration: JSON.stringify({ url, bearerToken, service: serviceType }),
    } as OrganizationIntegrationResponse;

    const configResponse = {
      id: configId,
      template: JSON.stringify({ index, service: serviceType }),
    } as OrganizationIntegrationConfigurationResponse;

    mockIntegrationApiService.createOrganizationIntegration.mockResolvedValue(integrationResponse);
    mockIntegrationConfigurationApiService.createOrganizationIntegrationConfiguration.mockResolvedValue(
      configResponse,
    );

    await service.saveHec(organizationId, serviceType, url, bearerToken, index);

    const integrations = await firstValueFrom(service.integrations$);
    expect(integrations.length).toBe(1);
    expect(integrations[0].id).toBe(integrationId);
    expect(integrations[0].serviceName).toBe(serviceType);
  });

  it("should throw error on organization ID mismatch in saveHec", async () => {
    service.setOrganizationIntegrations("other-org" as OrganizationId);
    await expect(
      service.saveHec(organizationId, serviceType, url, bearerToken, index),
    ).rejects.toThrow(Error("Organization ID mismatch"));
  });

  it("should update an existing Hec integration", async () => {
    service.setOrganizationIntegrations(organizationId);

    const integrationResponse = {
      id: integrationId,
      type: OrganizationIntegrationType.Hec,
      configuration: JSON.stringify({ url, bearerToken, service: serviceType }),
    } as OrganizationIntegrationResponse;

    const configResponse = {
      id: configId,
      template: JSON.stringify({ index, service: serviceType }),
    } as OrganizationIntegrationConfigurationResponse;

    mockIntegrationApiService.updateOrganizationIntegration.mockResolvedValue(integrationResponse);
    mockIntegrationConfigurationApiService.updateOrganizationIntegrationConfiguration.mockResolvedValue(
      configResponse,
    );

    await service.updateHec(
      organizationId,
      integrationId,
      configId,
      serviceType,
      url,
      bearerToken,
      index,
    );

    const integrations = await firstValueFrom(service.integrations$);
    expect(integrations.length).toBe(1);
    expect(integrations[0].id).toBe(integrationId);
  });

  it("should throw error on organization ID mismatch in updateHec", async () => {
    service.setOrganizationIntegrations("other-org" as OrganizationId);
    await expect(
      service.updateHec(
        organizationId,
        integrationId,
        configId,
        serviceType,
        url,
        bearerToken,
        index,
      ),
    ).rejects.toThrow(Error("Organization ID mismatch"));
  });
});
