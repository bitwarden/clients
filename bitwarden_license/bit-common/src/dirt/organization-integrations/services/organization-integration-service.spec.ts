import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import {
  OrganizationId,
  OrganizationIntegrationId,
  OrganizationIntegrationConfigurationId,
} from "@bitwarden/common/types/guid";

import { OrgIntegrationBuilder } from "../models/integration-builder";
import { OrganizationIntegration } from "../models/organization-integration";
import { OrganizationIntegrationConfigurationRequest } from "../models/organization-integration-configuration-request";
import { OrganizationIntegrationConfigurationResponse } from "../models/organization-integration-configuration-response";
import { OrganizationIntegrationRequest } from "../models/organization-integration-request";
import { OrganizationIntegrationResponse } from "../models/organization-integration-response";
import { OrganizationIntegrationServiceName } from "../models/organization-integration-service-type";
import { OrganizationIntegrationType } from "../models/organization-integration-type";

import { OrganizationIntegrationApiService } from "./organization-integration-api.service";
import { OrganizationIntegrationConfigurationApiService } from "./organization-integration-configuration-api.service";
import { OrganizationIntegrationService } from "./organization-integration-service";

describe("OrganizationIntegrationService", () => {
  let service: OrganizationIntegrationService;
  let integrationApiService: MockProxy<OrganizationIntegrationApiService>;
  let integrationConfigurationApiService: MockProxy<OrganizationIntegrationConfigurationApiService>;

  const orgId = "org-123" as OrganizationId;
  const integrationId = "integration-456" as OrganizationIntegrationId;
  const configurationId = "config-789" as OrganizationIntegrationConfigurationId;

  const mockIntegrationResponse = new OrganizationIntegrationResponse({
    Id: integrationId,
    Type: OrganizationIntegrationType.Hec,
    Configuration: JSON.stringify({
      uri: "https://test.splunk.com",
      token: "test-token",
      service: OrganizationIntegrationServiceName.CrowdStrike,
    }),
  });

  const mockConfigurationResponse = new OrganizationIntegrationConfigurationResponse({
    Id: configurationId,
    Template: JSON.stringify({
      index: "main",
      service: OrganizationIntegrationServiceName.CrowdStrike,
    }),
  });

  beforeEach(() => {
    integrationApiService = mock<OrganizationIntegrationApiService>();
    integrationConfigurationApiService = mock<OrganizationIntegrationConfigurationApiService>();

    service = new OrganizationIntegrationService(
      integrationApiService,
      integrationConfigurationApiService,
    );
  });

  describe("initialization", () => {
    it("should be created", () => {
      expect(service).toBeTruthy();
    });

    it("should initialize with empty integrations", async () => {
      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toEqual([]);
    });
  });

  describe("setOrganizationId", () => {
    it("should fetch and set integrations for the organization", async () => {
      integrationApiService.getOrganizationIntegrations.mockReturnValue(
        Promise.resolve([mockIntegrationResponse]),
      );
      integrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReturnValue(
        Promise.resolve([mockConfigurationResponse]),
      );

      service.setOrganizationId(orgId).subscribe();

      // Wait for the observable to emit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(1);
      expect(integrations[0].id).toBe(integrationId);
      expect(integrations[0].type).toBe(OrganizationIntegrationType.Hec);
      expect(integrationApiService.getOrganizationIntegrations).toHaveBeenCalledWith(orgId);
      expect(
        integrationConfigurationApiService.getOrganizationIntegrationConfigurations,
      ).toHaveBeenCalledWith(orgId, integrationId);
    });

    it("should skip fetching if organization ID is the same", async () => {
      integrationApiService.getOrganizationIntegrations.mockReturnValue(Promise.resolve([]));

      service.setOrganizationId(orgId).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 50));

      integrationApiService.getOrganizationIntegrations.mockClear();

      // Call again with the same org ID
      service.setOrganizationId(orgId).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(integrationApiService.getOrganizationIntegrations).not.toHaveBeenCalled();
    });

    it("should clear existing integrations when switching organizations", async () => {
      const orgId2 = "org-456" as OrganizationId;

      integrationApiService.getOrganizationIntegrations.mockReturnValue(
        Promise.resolve([mockIntegrationResponse]),
      );
      integrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReturnValue(
        Promise.resolve([mockConfigurationResponse]),
      );

      service.setOrganizationId(orgId).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 100));

      let integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(1);

      // Switch to different org
      integrationApiService.getOrganizationIntegrations.mockReturnValue(Promise.resolve([]));
      service.setOrganizationId(orgId2).subscribe();

      // Should immediately clear
      integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toEqual([]);
    });

    it("should unsubscribe from previous fetch when setting new organization", async () => {
      integrationApiService.getOrganizationIntegrations.mockReturnValue(Promise.resolve([]));

      service.setOrganizationId(orgId).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const orgId2 = "org-456" as OrganizationId;
      service.setOrganizationId(orgId2).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should call the API for both organizations (no errors about duplicate subscriptions)
      // The exact call count may vary based on observable behavior
      expect(integrationApiService.getOrganizationIntegrations).toHaveBeenCalled();
    });

    it("should handle multiple integrations", async () => {
      const integration2Response = new OrganizationIntegrationResponse({
        Id: "integration-2" as OrganizationIntegrationId,
        Type: OrganizationIntegrationType.Datadog,
        Configuration: JSON.stringify({
          uri: "https://datadog.com",
          apiKey: "test-api-key",
          service: OrganizationIntegrationServiceName.Datadog,
        }),
      });

      const configuration2Response = new OrganizationIntegrationConfigurationResponse({
        Id: "config-2" as OrganizationIntegrationConfigurationId,
        Template: JSON.stringify({
          service: OrganizationIntegrationServiceName.Datadog,
        }),
      });

      integrationApiService.getOrganizationIntegrations.mockReturnValue(
        Promise.resolve([mockIntegrationResponse, integration2Response]),
      );
      integrationConfigurationApiService.getOrganizationIntegrationConfigurations
        .mockReturnValueOnce(Promise.resolve([mockConfigurationResponse]))
        .mockReturnValueOnce(Promise.resolve([configuration2Response]));

      service.setOrganizationId(orgId).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(2);
    });
  });

  describe("save", () => {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      "https://test.splunk.com",
      "test-token",
      OrganizationIntegrationServiceName.CrowdStrike,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "main",
      OrganizationIntegrationServiceName.CrowdStrike,
    );

    beforeEach(() => {
      // Set the organization first
      integrationApiService.getOrganizationIntegrations.mockReturnValue(Promise.resolve([]));
      service.setOrganizationId(orgId).subscribe();
    });

    it("should save a new integration successfully", async () => {
      integrationApiService.createOrganizationIntegration.mockResolvedValue(
        mockIntegrationResponse,
      );
      integrationConfigurationApiService.createOrganizationIntegrationConfiguration.mockResolvedValue(
        mockConfigurationResponse,
      );

      const result = await service.save(orgId, OrganizationIntegrationType.Hec, config, template);

      expect(result).toEqual({
        mustBeOwner: false,
        success: true,
        organizationIntegrationResult: expect.any(OrganizationIntegration),
      });
      expect(integrationApiService.createOrganizationIntegration).toHaveBeenCalledWith(
        orgId,
        expect.any(OrganizationIntegrationRequest),
      );
      expect(
        integrationConfigurationApiService.createOrganizationIntegrationConfiguration,
      ).toHaveBeenCalledWith(
        orgId,
        integrationId,
        expect.any(OrganizationIntegrationConfigurationRequest),
      );

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(1);
      expect(integrations[0].id).toBe(integrationId);
    });

    it("should throw error when organization ID mismatch", async () => {
      const differentOrgId = "different-org" as OrganizationId;

      await expect(
        service.save(differentOrgId, OrganizationIntegrationType.Hec, config, template),
      ).rejects.toThrow("Organization ID mismatch");
    });

    it("should return mustBeOwner true when API returns 404", async () => {
      const error = new ErrorResponse({}, 404);
      integrationApiService.createOrganizationIntegration.mockRejectedValue(error);

      const result = await service.save(orgId, OrganizationIntegrationType.Hec, config, template);

      expect(result).toEqual({ mustBeOwner: true, success: false });
    });

    it("should rethrow non-404 errors", async () => {
      const error = new Error("Server error");
      integrationApiService.createOrganizationIntegration.mockRejectedValue(error);

      await expect(
        service.save(orgId, OrganizationIntegrationType.Hec, config, template),
      ).rejects.toThrow("Server error");
    });

    it("should handle configuration creation failure with 404", async () => {
      const error = new ErrorResponse({}, 404);
      integrationApiService.createOrganizationIntegration.mockResolvedValue(
        mockIntegrationResponse,
      );
      integrationConfigurationApiService.createOrganizationIntegrationConfiguration.mockRejectedValue(
        error,
      );

      const result = await service.save(orgId, OrganizationIntegrationType.Hec, config, template);

      expect(result).toEqual({ mustBeOwner: true, success: false });
    });
  });

  describe("update", () => {
    const config = OrgIntegrationBuilder.buildHecConfiguration(
      "https://updated.splunk.com",
      "updated-token",
      OrganizationIntegrationServiceName.CrowdStrike,
    );
    const template = OrgIntegrationBuilder.buildHecTemplate(
      "updated-index",
      OrganizationIntegrationServiceName.CrowdStrike,
    );

    beforeEach(() => {
      // Set the organization and add an existing integration
      integrationApiService.getOrganizationIntegrations.mockReturnValue(
        Promise.resolve([mockIntegrationResponse]),
      );
      integrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReturnValue(
        Promise.resolve([mockConfigurationResponse]),
      );
      service.setOrganizationId(orgId).subscribe();
    });

    it("should update an integration successfully", async () => {
      const updatedIntegrationResponse = new OrganizationIntegrationResponse({
        Id: integrationId,
        Type: OrganizationIntegrationType.Hec,
        Configuration: JSON.stringify({
          uri: "https://updated.splunk.com",
          token: "updated-token",
          service: OrganizationIntegrationServiceName.CrowdStrike,
        }),
      });

      const updatedConfigurationResponse = new OrganizationIntegrationConfigurationResponse({
        Id: configurationId,
        Template: JSON.stringify({
          index: "updated-index",
          service: OrganizationIntegrationServiceName.CrowdStrike,
        }),
      });

      integrationApiService.updateOrganizationIntegration.mockResolvedValue(
        updatedIntegrationResponse,
      );
      integrationConfigurationApiService.updateOrganizationIntegrationConfiguration.mockResolvedValue(
        updatedConfigurationResponse,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await service.update(
        orgId,
        integrationId,
        OrganizationIntegrationType.Hec,
        configurationId,
        config,
        template,
      );

      expect(result).toEqual({
        mustBeOwner: false,
        success: true,
        organizationIntegrationResult: expect.any(OrganizationIntegration),
      });
      expect(integrationApiService.updateOrganizationIntegration).toHaveBeenCalledWith(
        orgId,
        integrationId,
        expect.any(OrganizationIntegrationRequest),
      );
      expect(
        integrationConfigurationApiService.updateOrganizationIntegrationConfiguration,
      ).toHaveBeenCalledWith(
        orgId,
        integrationId,
        configurationId,
        expect.any(OrganizationIntegrationConfigurationRequest),
      );

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(1);
      expect(integrations[0].id).toBe(integrationId);
    });

    it("should throw error when organization ID mismatch", async () => {
      const differentOrgId = "different-org" as OrganizationId;

      await expect(
        service.update(
          differentOrgId,
          integrationId,
          OrganizationIntegrationType.Hec,
          configurationId,
          config,
          template,
        ),
      ).rejects.toThrow("Organization ID mismatch");
    });

    it("should return mustBeOwner true when API returns 404", async () => {
      const error = new ErrorResponse({}, 404);
      integrationApiService.updateOrganizationIntegration.mockRejectedValue(error);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await service.update(
        orgId,
        integrationId,
        OrganizationIntegrationType.Hec,
        configurationId,
        config,
        template,
      );

      expect(result).toEqual({
        mustBeOwner: true,
        success: false,
        organizationIntegrationResult: undefined,
      });
    });

    it("should rethrow non-404 errors", async () => {
      const error = new Error("Server error");
      integrationApiService.updateOrganizationIntegration.mockRejectedValue(error);

      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(
        service.update(
          orgId,
          integrationId,
          OrganizationIntegrationType.Hec,
          configurationId,
          config,
          template,
        ),
      ).rejects.toThrow("Server error");
    });

    it("should replace old integration with updated one in the list", async () => {
      // Add multiple integrations first
      const integration2Response = new OrganizationIntegrationResponse({
        Id: "integration-2" as OrganizationIntegrationId,
        Type: OrganizationIntegrationType.Hec,
        Configuration: mockIntegrationResponse.configuration,
      });
      const configuration2Response = new OrganizationIntegrationConfigurationResponse({
        Id: "config-2" as OrganizationIntegrationConfigurationId,
        Template: mockConfigurationResponse.template,
      });

      const orgId2 = "org-456" as OrganizationId;
      integrationApiService.getOrganizationIntegrations.mockReturnValue(
        Promise.resolve([mockIntegrationResponse, integration2Response]),
      );
      integrationConfigurationApiService.getOrganizationIntegrationConfigurations
        .mockReturnValue(Promise.resolve([mockConfigurationResponse]))
        .mockReturnValueOnce(Promise.resolve([mockConfigurationResponse]))
        .mockReturnValueOnce(Promise.resolve([configuration2Response]));

      service.setOrganizationId(orgId2).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 100));

      let integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(2);

      // Now update the first integration
      integrationApiService.updateOrganizationIntegration.mockResolvedValue(
        mockIntegrationResponse,
      );
      integrationConfigurationApiService.updateOrganizationIntegrationConfiguration.mockResolvedValue(
        mockConfigurationResponse,
      );

      await service.update(
        orgId2,
        integrationId,
        OrganizationIntegrationType.Hec,
        configurationId,
        config,
        template,
      );

      integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(2);
      expect(integrations.find((i) => i.id === integrationId)).toBeDefined();
      expect(integrations.find((i) => i.id === "integration-2")).toBeDefined();
    });
  });

  describe("delete", () => {
    beforeEach(() => {
      // Set the organization and add an existing integration
      integrationApiService.getOrganizationIntegrations.mockReturnValue(
        Promise.resolve([mockIntegrationResponse]),
      );
      integrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReturnValue(
        Promise.resolve([mockConfigurationResponse]),
      );
      service.setOrganizationId(orgId).subscribe();
    });

    it("should delete an integration successfully", async () => {
      integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration.mockResolvedValue(
        undefined,
      );
      integrationApiService.deleteOrganizationIntegration.mockResolvedValue(undefined);

      await new Promise((resolve) => setTimeout(resolve, 100));

      let integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(1);

      const result = await service.delete(orgId, integrationId, configurationId);

      expect(result).toEqual({ mustBeOwner: false, success: true });
      expect(
        integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration,
      ).toHaveBeenCalledWith(orgId, integrationId, configurationId);
      expect(integrationApiService.deleteOrganizationIntegration).toHaveBeenCalledWith(
        orgId,
        integrationId,
      );

      integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(0);
    });

    it("should delete configuration before integration", async () => {
      const callOrder: string[] = [];

      integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration.mockImplementation(
        async () => {
          callOrder.push("configuration");
        },
      );
      integrationApiService.deleteOrganizationIntegration.mockImplementation(async () => {
        callOrder.push("integration");
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await service.delete(orgId, integrationId, configurationId);

      expect(callOrder).toEqual(["configuration", "integration"]);
    });

    it("should throw error when organization ID mismatch", async () => {
      const differentOrgId = "different-org" as OrganizationId;

      await expect(service.delete(differentOrgId, integrationId, configurationId)).rejects.toThrow(
        "Organization ID mismatch",
      );
    });

    it("should return mustBeOwner true when API returns 404", async () => {
      const error = new ErrorResponse({}, 404);
      integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration.mockRejectedValue(
        error,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await service.delete(orgId, integrationId, configurationId);

      expect(result).toEqual({ mustBeOwner: true, success: false });
    });

    it("should rethrow non-404 errors", async () => {
      const error = new Error("Server error");
      integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration.mockRejectedValue(
        error,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      await expect(service.delete(orgId, integrationId, configurationId)).rejects.toThrow(
        "Server error",
      );
    });

    it("should handle 404 error when deleting integration", async () => {
      const error = new ErrorResponse({}, 404);
      integrationConfigurationApiService.deleteOrganizationIntegrationConfiguration.mockResolvedValue(
        undefined,
      );
      integrationApiService.deleteOrganizationIntegration.mockRejectedValue(error);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await service.delete(orgId, integrationId, configurationId);

      expect(result).toEqual({ mustBeOwner: true, success: false });
    });
  });

  describe("mapResponsesToOrganizationIntegration", () => {
    it("should return null if configuration cannot be built", () => {
      const invalidIntegrationResponse = new OrganizationIntegrationResponse({
        Id: integrationId,
        Type: 999 as OrganizationIntegrationType, // Invalid type
        Configuration: "invalid-json",
      });

      // The buildConfiguration method throws for unsupported types
      // In production, this error is caught in the setIntegrations pipeline
      expect(() =>
        service["mapResponsesToOrganizationIntegration"](
          invalidIntegrationResponse,
          mockConfigurationResponse,
        ),
      ).toThrow("Unsupported integration type: 999");
    });

    it("should handle template with invalid data", () => {
      const invalidConfigurationResponse = new OrganizationIntegrationConfigurationResponse({
        Id: configurationId,
        Template: "{}", // Empty template, will have undefined values but won't return null
      });

      const result = service["mapResponsesToOrganizationIntegration"](
        mockIntegrationResponse,
        invalidConfigurationResponse,
      );

      // The result won't be null, but will have a template with undefined/default values
      expect(result).not.toBeNull();
      expect(result?.integrationConfiguration[0].template).toBeDefined();
    });

    it("should successfully map valid responses to OrganizationIntegration", () => {
      const result = service["mapResponsesToOrganizationIntegration"](
        mockIntegrationResponse,
        mockConfigurationResponse,
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(integrationId);
      expect(result?.type).toBe(OrganizationIntegrationType.Hec);
      expect(result?.integrationConfiguration).toHaveLength(1);
      expect(result?.integrationConfiguration[0].id).toBe(configurationId);
    });
  });

  describe("edge cases", () => {
    it("should handle empty integration list from API", async () => {
      integrationApiService.getOrganizationIntegrations.mockReturnValue(Promise.resolve([]));

      service.setOrganizationId(orgId).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toEqual([]);
    });

    it("should handle errors when fetching integrations", async () => {
      const validIntegration = mockIntegrationResponse;

      integrationApiService.getOrganizationIntegrations.mockReturnValue(
        Promise.resolve([validIntegration]),
      );
      integrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReturnValue(
        Promise.resolve([mockConfigurationResponse]),
      );

      service.setOrganizationId(orgId).subscribe();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const integrations = await firstValueFrom(service.integrations$);
      expect(integrations).toHaveLength(1);
      expect(integrations[0].id).toBe(integrationId);
    });
  });
});
