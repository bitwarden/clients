import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import {
  OrganizationIntegrationApiService,
  OrganizationIntegrationConfigurationApiService,
} from "@bitwarden/bit-common/dirt/integrations";

import { OrganizationIntegrationService } from "./organization-integration.service";

describe("OrganizationIntegrationService", () => {
  let service: OrganizationIntegrationService;
  const mockOrgIntegrationApiService = mock<OrganizationIntegrationApiService>();
  const mockOrgIntegrationConfigurationApiService =
    mock<OrganizationIntegrationConfigurationApiService>();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: OrganizationIntegrationApiService, useValue: mockOrgIntegrationApiService },
        {
          provide: OrganizationIntegrationConfigurationApiService,
          useValue: mockOrgIntegrationConfigurationApiService,
        },
      ],
    });
    service = TestBed.inject(OrganizationIntegrationService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("saveHec", () => {
    const organizationId = "org-123" as any;
    const serviceName = "splunk";
    const hecConfiguration = { toString: () => '{"token":"abc"}' } as any;
    const hecConfigurationTemplate = { toString: () => '{"service":"splunk"}' } as any;

    beforeEach(() => {
      mockOrgIntegrationApiService.getOrganizationIntegrations.mockReset();
      mockOrgIntegrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReset();
      jest.clearAllMocks();
    });

    it("should save HEC integration and configuration successfully", async () => {
      const integrationResponse = { id: "int-1", type: "Hec" } as any;
      const configurationResponse = { id: "conf-1", template: '{"service":"splunk"}' } as any;

      jest.spyOn(service, "saveHecIntegration").mockResolvedValue(integrationResponse);
      jest
        .spyOn(service, "saveHecIntegrationConfiguration")
        .mockResolvedValue(configurationResponse);

      const result = await service.saveHec(
        organizationId,
        serviceName,
        hecConfiguration,
        hecConfigurationTemplate,
      );

      expect(service.saveHecIntegration).toHaveBeenCalledWith(organizationId, hecConfiguration);
      expect(service.saveHecIntegrationConfiguration).toHaveBeenCalledWith(
        organizationId,
        integrationResponse.id,
        serviceName,
        hecConfigurationTemplate,
      );
      expect(result).toEqual({
        integration: integrationResponse,
        configuration: configurationResponse,
      });
    });

    it("should throw error if integrationResponse.id is missing", async () => {
      const integrationResponse = { type: "Hec" } as any;
      jest.spyOn(service, "saveHecIntegration").mockResolvedValue(integrationResponse);

      await expect(
        service.saveHec(organizationId, serviceName, hecConfiguration, hecConfigurationTemplate),
      ).rejects.toThrow("Failed to save HEC integration");
    });

    it("should throw error if configurationResponse.id is missing", async () => {
      const integrationResponse = { id: "int-1", type: "Hec" } as any;
      const configurationResponse = { template: '{"service":"splunk"}' } as any;

      jest.spyOn(service, "saveHecIntegration").mockResolvedValue(integrationResponse);
      jest
        .spyOn(service, "saveHecIntegrationConfiguration")
        .mockResolvedValue(configurationResponse);

      await expect(
        service.saveHec(organizationId, serviceName, hecConfiguration, hecConfigurationTemplate),
      ).rejects.toThrow("Failed to save HEC integration configuration");
    });
  });

  describe("convertToJson", () => {
    it("should parse valid JSON string and return object", () => {
      const jsonString = '{"foo":"bar","num":42}';
      const result = service.convertToJson<{ foo: string; num: number }>(jsonString);
      expect(result).toEqual({ foo: "bar", num: 42 });
    });

    it("should return null for invalid JSON string", () => {
      const invalidJson = '{"foo":bar}';
      const result = service.convertToJson<any>(invalidJson);
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = service.convertToJson<any>("");
      expect(result).toBeNull();
    });

    it("should parse JSON arrays", () => {
      const jsonString = "[1,2,3]";
      const result = service.convertToJson<number[]>(jsonString);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse JSON boolean", () => {
      const jsonString = "true";
      const result = service.convertToJson<boolean>(jsonString);
      expect(result).toBe(true);
    });

    it("should parse JSON number", () => {
      const jsonString = "123";
      const result = service.convertToJson<number>(jsonString);
      expect(result).toBe(123);
    });

    it("should parse JSON null", () => {
      const jsonString = "null";
      const result = service.convertToJson<any>(jsonString);
      expect(result).toBeNull();
    });
  });
});
