import { mock } from "jest-mock-extended";
import { firstValueFrom, take } from "rxjs";

import {
  OrganizationId,
  OrganizationIntegrationConfigurationId,
  OrganizationIntegrationId,
} from "@bitwarden/common/types/guid";

import { OrgIntegrationConfiguration, OrgIntegrationTemplate } from "../models/integration-jsonify";
import { OrganizationIntegrationConfigurationResponse } from "../models/organization-integration-configuration-response";
import { OrganizationIntegrationResponse } from "../models/organization-integration-response";
import { OrganizationIntegrationServiceName } from "../models/organization-integration-service-type";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import { BaseOrganizationIntegrationService } from "./base-organization-integration.service";
import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";

// Mock configuration and template types for testing
class MockConfiguration implements OrgIntegrationConfiguration {
  constructor(
    public url: string,
    public apiKey: string,
    public service: OrganizationIntegrationServiceName,
  ) {}
  toString(): string {
    return JSON.stringify(this);
  }
}

class MockTemplate implements OrgIntegrationTemplate {
  constructor(public service: OrganizationIntegrationServiceName) {}
  toString(): string {
    return JSON.stringify(this);
  }
}

// Concrete implementation for testing
class TestOrganizationIntegrationService extends BaseOrganizationIntegrationService<
  MockConfiguration,
  MockTemplate
> {
  protected readonly integrationType = OrganizationIntegrationType.Datadog;

  createConfiguration(
    url: string,
    apiKey: string,
    service: OrganizationIntegrationServiceName,
  ): MockConfiguration {
    return new MockConfiguration(url, apiKey, service);
  }

  createTemplate(service: OrganizationIntegrationServiceName): MockTemplate {
    return new MockTemplate(service);
  }

  // Expose protected methods for testing
  testSave(organizationId: OrganizationId, config: MockConfiguration, template: MockTemplate) {
    return this.save(organizationId, config, template);
  }

  testUpdate(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
    config: MockConfiguration,
    template: MockTemplate,
  ) {
    return this.update(organizationId, integrationId, configurationId, config, template);
  }

  testDelete(
    organizationId: OrganizationId,
    integrationId: OrganizationIntegrationId,
    configurationId: OrganizationIntegrationConfigurationId,
  ) {
    return this.delete(organizationId, integrationId, configurationId);
  }
}

describe("BaseOrganizationIntegrationService", () => {
  let service: TestOrganizationIntegrationService;
  const mockIntegrationApiService = mock<OrganizationIntegrationApiService>();
  const mockIntegrationConfigurationApiService =
    mock<OrganizationIntegrationConfigurationApiService>();
  const organizationId = "org-1" as OrganizationId;
  const integrationId = "int-1" as OrganizationIntegrationId;
  const configId = "conf-1" as OrganizationIntegrationConfigurationId;
  const serviceType = OrganizationIntegrationServiceName.CrowdStrike;
  const url = "https://example.com";
  const apiKey = "test-api-key";

  beforeEach(() => {
    service = new TestOrganizationIntegrationService(
      mockIntegrationApiService,
      mockIntegrationConfigurationApiService,
    );

    jest.resetAllMocks();
  });

  describe("setOrganizationIntegrations", () => {
    it("should skip if same organization ID is set again", (done) => {
      mockIntegrationApiService.getOrganizationIntegrations.mockResolvedValue([]);
      service.setOrganizationIntegrations(organizationId);
      service.integrations$.pipe(take(1)).subscribe((integrations) => {
        expect(integrations).toEqual([]);
        done();
      });
    });

    it("should skip if same organization ID is set again", (done) => {
      mockIntegrationApiService.getOrganizationIntegrations.mockResolvedValue([]);
      service.setOrganizationIntegrations(organizationId);

      // Wait for initial subscription
      setTimeout(() => {
        const callCount = mockIntegrationApiService.getOrganizationIntegrations.mock.calls.length;
        service.setOrganizationIntegrations(organizationId); // Same org ID

        // Should not trigger another API call
        setTimeout(() => {
          expect(mockIntegrationApiService.getOrganizationIntegrations.mock.calls.length).toBe(
            callCount,
          );
          done();
        }, 100);
      }, 100);
    });
  });

  describe("save", () => {
    it("should save a new integration", async () => {
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

      mockIntegrationApiService.createOrganizationIntegration.mockResolvedValue(
        integrationResponse,
      );
      mockIntegrationConfigurationApiService.createOrganizationIntegrationConfiguration.mockResolvedValue(
        configResponse,
      );

      const config = service.createConfiguration(url, apiKey, serviceType);
      const template = service.createTemplate(serviceType);
      const result = await service.testSave(organizationId, config, template);

      expect(result.success).toBe(true);
      expect(result.mustBeOwner).toBe(false);

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations.length).toBe(1);
      expect(integrations[0].id).toBe(integrationId);
    });

    it("should throw error on organization ID mismatch", async () => {
      service.setOrganizationIntegrations("other-org" as OrganizationId);
      const config = service.createConfiguration(url, apiKey, serviceType);
      const template = service.createTemplate(serviceType);

      await expect(service.testSave(organizationId, config, template)).rejects.toThrow(
        "Organization ID mismatch",
      );
    });
  });

  describe("update", () => {
    it("should update an existing integration", async () => {
      service.setOrganizationIntegrations(organizationId);

      // First create an integration
      const createIntegrationResponse = {
        id: integrationId,
        type: OrganizationIntegrationType.Datadog,
        configuration: JSON.stringify({ url, apiKey, service: serviceType }),
      } as OrganizationIntegrationResponse;

      const createConfigResponse = {
        id: configId,
        template: JSON.stringify({ service: serviceType }),
      } as OrganizationIntegrationConfigurationResponse;

      mockIntegrationApiService.createOrganizationIntegration.mockResolvedValue(
        createIntegrationResponse,
      );
      mockIntegrationConfigurationApiService.createOrganizationIntegrationConfiguration.mockResolvedValue(
        createConfigResponse,
      );

      const config = service.createConfiguration(url, apiKey, serviceType);
      const template = service.createTemplate(serviceType);
      await service.testSave(organizationId, config, template);

      // Now update it
      const updatedUrl = "https://updated.example.com";
      const updateIntegrationResponse = {
        id: integrationId,
        type: OrganizationIntegrationType.Datadog,
        configuration: JSON.stringify({ url: updatedUrl, apiKey, service: serviceType }),
      } as OrganizationIntegrationResponse;

      const updateConfigResponse = {
        id: configId,
        template: JSON.stringify({ service: serviceType }),
      } as OrganizationIntegrationConfigurationResponse;

      mockIntegrationApiService.updateOrganizationIntegration.mockResolvedValue(
        updateIntegrationResponse,
      );
      mockIntegrationConfigurationApiService.updateOrganizationIntegrationConfiguration.mockResolvedValue(
        updateConfigResponse,
      );

      const updatedConfig = service.createConfiguration(updatedUrl, apiKey, serviceType);
      const result = await service.testUpdate(
        organizationId,
        integrationId,
        configId,
        updatedConfig,
        template,
      );

      expect(result.success).toBe(true);
      expect(result.mustBeOwner).toBe(false);

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations.length).toBe(1);
      expect(integrations[0].id).toBe(integrationId);
    });

    it("should throw error on organization ID mismatch", async () => {
      service.setOrganizationIntegrations("other-org" as OrganizationId);
      const config = service.createConfiguration(url, apiKey, serviceType);
      const template = service.createTemplate(serviceType);

      await expect(
        service.testUpdate(organizationId, integrationId, configId, config, template),
      ).rejects.toThrow("Organization ID mismatch");
    });
  });

  describe("delete", () => {
    it("should delete an integration", async () => {
      service.setOrganizationIntegrations(organizationId);

      // First create an integration
      const integrationResponse = {
        id: integrationId,
        type: OrganizationIntegrationType.Datadog,
        configuration: JSON.stringify({ url, apiKey, service: serviceType }),
      } as OrganizationIntegrationResponse;

      const configResponse = {
        id: configId,
        template: JSON.stringify({ service: serviceType }),
      } as OrganizationIntegrationConfigurationResponse;

      mockIntegrationApiService.createOrganizationIntegration.mockResolvedValue(
        integrationResponse,
      );
      mockIntegrationConfigurationApiService.createOrganizationIntegrationConfiguration.mockResolvedValue(
        configResponse,
      );

      const config = service.createConfiguration(url, apiKey, serviceType);
      const template = service.createTemplate(serviceType);
      await service.testSave(organizationId, config, template);

      // Verify it was created
      let integrations = await firstValueFrom(service.integrations$);
      expect(integrations.length).toBe(1);

      // Now delete it
      mockIntegrationConfigurationApiService.deleteOrganizationIntegrationConfiguration.mockResolvedValue(
        undefined,
      );
      mockIntegrationApiService.deleteOrganizationIntegration.mockResolvedValue(undefined);

      const result = await service.testDelete(organizationId, integrationId, configId);

      expect(result.success).toBe(true);
      expect(result.mustBeOwner).toBe(false);

      integrations = await firstValueFrom(service.integrations$);
      expect(integrations.length).toBe(0);
    });

    it("should throw error on organization ID mismatch", async () => {
      service.setOrganizationIntegrations("other-org" as OrganizationId);

      await expect(service.testDelete(organizationId, integrationId, configId)).rejects.toThrow(
        "Organization ID mismatch",
      );
    });
  });

  describe("convertToJson", () => {
    it("should convert valid JSON string", () => {
      const jsonString = JSON.stringify({ test: "value" });
      const result = service["convertToJson"]<{ test: string }>(jsonString);
      expect(result).toEqual({ test: "value" });
    });

    it("should return null for invalid JSON", () => {
      const result = service["convertToJson"]("invalid json");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = service["convertToJson"]("");
      expect(result).toBeNull();
    });
  });
});
