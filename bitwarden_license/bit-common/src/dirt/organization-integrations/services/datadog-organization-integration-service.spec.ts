import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  OrganizationId,
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

import { DatadogConfiguration } from "../models/configuration/datadog-configuration";
import { DatadogTemplate } from "../models/integration-configuration-config/configuration-template/datadog-template";
import { OrganizationIntegration } from "../models/organization-integration";
import { OrganizationIntegrationConfiguration } from "../models/organization-integration-configuration";
import { OrganizationIntegrationConfigurationResponse } from "../models/organization-integration-configuration-response";
import { OrganizationIntegrationResponse } from "../models/organization-integration-response";
import { OrganizationIntegrationServiceType } from "../models/organization-integration-service-type";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import { DatadogOrganizationIntegrationService } from "./datadog-organization-integration-service";
import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

describe("DatadogOrganizationIntegrationService", () => {
  let service: DatadogOrganizationIntegrationService;
  const mockIntegrationApiService = mock<OrganizationIntegrationApiService>();
  const mockIntegrationConfigurationApiService =
    mock<OrganizationIntegrationConfigurationApiService>();
  const organizationId = "org-1" as OrganizationId;
  const integrationId = "int-1" as OrganizationIntegrationId;
  const configId = "conf-1" as OrganizationIntegrationConfigurationId;
  const serviceType = OrganizationIntegrationServiceType.CrowdStrike;
  const url = "https://example.com";
  const apiKey = "token";

  beforeEach(() => {
    service = new DatadogOrganizationIntegrationService(
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

  it("should save a new Datadog integration", async () => {
    service.setOrganizationIntegrations(organizationId);

    const integrationResponse = {
      id: integrationId,
      type: OrganizationIntegrationType.Datadog,
      configuration: JSON.stringify({ url, apiKey, service: serviceType }),
    } as OrganizationIntegrationResponse;

    const configResponse = {
      id: configId,
      template: JSON.stringify({ service: serviceType }),
    } as OrganizationIntegrationConfigurationResponse;

    mockIntegrationApiService.createOrganizationIntegration.mockResolvedValue(integrationResponse);
    mockIntegrationConfigurationApiService.createOrganizationIntegrationConfiguration.mockResolvedValue(
      configResponse,
    );

    await service.saveDatadog(organizationId, serviceType, url, apiKey);

    const integrations = await firstValueFrom(service.integrations$);
    expect(integrations.length).toBe(1);
    expect(integrations[0].id).toBe(integrationId);
    expect(integrations[0].serviceType).toBe(serviceType);
  });

  it("should throw error on organization ID mismatch in saveDatadog", async () => {
    service.setOrganizationIntegrations("other-org" as OrganizationId);
    await expect(service.saveDatadog(organizationId, serviceType, url, apiKey)).rejects.toThrow(
      Error("Organization ID mismatch"),
    );
  });

  it("should update an existing Datadog integration", async () => {
    service.setOrganizationIntegrations(organizationId);

    const integrationResponse = {
      id: integrationId,
      type: OrganizationIntegrationType.Datadog,
      configuration: JSON.stringify({ url, apiKey, service: serviceType }),
    } as OrganizationIntegrationResponse;

    const configResponse = {
      id: configId,
      template: JSON.stringify({ service: serviceType }),
    } as OrganizationIntegrationConfigurationResponse;

    mockIntegrationApiService.updateOrganizationIntegration.mockResolvedValue(integrationResponse);
    mockIntegrationConfigurationApiService.updateOrganizationIntegrationConfiguration.mockResolvedValue(
      configResponse,
    );

    await service.updateDatadog(organizationId, integrationId, configId, serviceType, url, apiKey);

    const integrations = await firstValueFrom(service.integrations$);
    expect(integrations.length).toBe(1);
    expect(integrations[0].id).toBe(integrationId);
  });

  it("should throw error on organization ID mismatch in updateDatadog", async () => {
    service.setOrganizationIntegrations("other-org" as OrganizationId);
    await expect(
      service.updateDatadog(organizationId, integrationId, configId, serviceType, url, apiKey),
    ).rejects.toThrow(Error("Organization ID mismatch"));
  });

  it("should get integration by id", async () => {
    service["_integrations$"].next([
      new OrganizationIntegration(
        integrationId,
        OrganizationIntegrationType.Datadog,
        serviceType,
        {} as DatadogConfiguration,
        [],
      ),
    ]);
    const integration = await service.getIntegrationById(integrationId);
    expect(integration).not.toBeNull();
    expect(integration!.id).toBe(integrationId);
  });

  it("should get integration by service type", async () => {
    service["_integrations$"].next([
      new OrganizationIntegration(
        integrationId,
        OrganizationIntegrationType.Datadog,
        serviceType,
        {} as DatadogConfiguration,
        [],
      ),
    ]);
    const integration = await service.getIntegrationByServiceType(serviceType);
    expect(integration).not.toBeNull();
    expect(integration!.serviceType).toBe(serviceType);
  });

  it("should get integration configurations", async () => {
    const config = new OrganizationIntegrationConfiguration(
      configId,
      integrationId,
      null,
      null,
      "",
      {} as DatadogTemplate,
    );

    service["_integrations$"].next([
      new OrganizationIntegration(
        integrationId,
        OrganizationIntegrationType.Datadog,
        serviceType,
        {} as DatadogConfiguration,
        [config],
      ),
    ]);
    const configs = await service.getIntegrationConfigurations(integrationId);
    expect(configs).not.toBeNull();
    expect(configs![0].id).toBe(configId);
  });

  it("convertToJson should parse valid JSON", () => {
    const obj = service.convertToJson<{ a: number }>('{"a":1}');
    expect(obj).toEqual({ a: 1 });
  });

  it("convertToJson should return null for invalid JSON", () => {
    const obj = service.convertToJson<{ a: number }>("invalid");
    expect(obj).toBeNull();
  });
});
