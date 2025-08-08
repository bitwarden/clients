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

  describe("getIntegrationsAndConfigurations", () => {
    const orgId = "org-123" as any;

    beforeEach(() => {
      mockOrgIntegrationApiService.getOrganizationIntegrations.mockReset();
      mockOrgIntegrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReset();
      service["integrations"].next([]);
      service["integrationConfigurations"].next([]);
    });

    it("should fetch integrations and their configurations and update observables", async () => {
      const integration1 = { id: "int-1", type: "type1" } as any;
      const integration2 = { id: "int-2", type: "type2" } as any;
      const config1 = [{ id: "conf-1", template: "{}" }] as any;
      const config2 = [{ id: "conf-2", template: "{}" }] as any;

      mockOrgIntegrationApiService.getOrganizationIntegrations.mockResolvedValue([
        integration1,
        integration2,
      ]);
      mockOrgIntegrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockImplementation(
        (_, integrationId) => {
          if (integrationId === "int-1") {
            return Promise.resolve(config1);
          }
          if (integrationId === "int-2") {
            return Promise.resolve(config2);
          }
          return Promise.resolve([]);
        },
      );

      const result = await service.getIntegrationsAndConfigurations(orgId);

      expect(mockOrgIntegrationApiService.getOrganizationIntegrations).toHaveBeenCalledWith(orgId);
      expect(
        mockOrgIntegrationConfigurationApiService.getOrganizationIntegrationConfigurations,
      ).toHaveBeenCalledWith(orgId, "int-1");
      expect(
        mockOrgIntegrationConfigurationApiService.getOrganizationIntegrationConfigurations,
      ).toHaveBeenCalledWith(orgId, "int-2");

      expect(result.integrations).toEqual([integration1, integration2]);
      expect(result.configurations.length).toBe(2);
      expect(result.configurations[0].integrationId).toBe("int-1");
      expect(result.configurations[1].integrationId).toBe("int-2");

      // Check observables updated
      service.integrations$.subscribe((integrations) => {
        expect(integrations).toEqual([integration1, integration2]);
      });
      service.integrationConfigurations$.subscribe((configs) => {
        expect(configs.length).toBe(2);
      });
    });

    it("should handle no integrations", async () => {
      mockOrgIntegrationApiService.getOrganizationIntegrations.mockResolvedValue([]);
      const result = await service.getIntegrationsAndConfigurations(orgId);

      expect(result.integrations).toEqual([]);
      expect(result.configurations).toEqual([]);
      service.integrations$.subscribe((integrations) => {
        expect(integrations).toEqual([]);
      });
      service.integrationConfigurations$.subscribe((configs) => {
        expect(configs).toEqual([]);
      });
    });

    it("should handle integrations with no configurations", async () => {
      const integration = { id: "int-1", type: "type1" } as any;
      mockOrgIntegrationApiService.getOrganizationIntegrations.mockResolvedValue([integration]);
      mockOrgIntegrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockResolvedValue(
        [],
      );

      const result = await service.getIntegrationsAndConfigurations(orgId);

      expect(result.integrations).toEqual([integration]);
      expect(result.configurations.length).toBe(1);
      expect(result.configurations[0].integrationId).toBe("int-1");
      expect(result.configurations[0].configurationResponses).toEqual([]);
    });
  });

  describe("saveHec", () => {
    const organizationId = "org-123" as any;
    const serviceName = "splunk";
    const hecConfiguration = { toString: () => '{"token":"abc"}' } as any;
    const hecConfigurationTemplate = { toString: () => '{"service":"splunk"}' } as any;

    beforeEach(() => {
      mockOrgIntegrationApiService.getOrganizationIntegrations.mockReset();
      mockOrgIntegrationConfigurationApiService.getOrganizationIntegrationConfigurations.mockReset();
      service["integrations"].next([]);
      service["integrationConfigurations"].next([]);
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

  describe("getIntegrationConfiguration", () => {
    const integrationId = "int-1" as any;
    const serviceName = "splunk";
    const otherServiceName = "datadog";

    it("should return null if integrationConfigurations is empty", () => {
      const result = service.getIntegrationConfiguration(integrationId, serviceName, []);
      expect(result).toBeNull();
    });

    it("should return null if no integrationConfigs found for integrationId", () => {
      const integrationConfigurations = [
        {
          integrationId: "int-2",
          configurationResponses: [{ id: "conf-1", template: '{"service":"splunk"}' }],
        },
      ] as any;
      const result = service.getIntegrationConfiguration(
        integrationId,
        serviceName,
        integrationConfigurations,
      );
      expect(result).toBeNull();
    });

    it("should return null if no configurationResponses match the service", () => {
      const sampleIntegrationConfigurations = [
        {
          integrationId,
          configurationResponses: [{ id: "conf-1", template: '{"service":"splunk"}' }],
        },
      ] as any;
      const result = service.getIntegrationConfiguration(
        integrationId,
        otherServiceName,
        sampleIntegrationConfigurations,
      );
      expect(result).toBeNull();
    });

    it("should return the configuration template if service matches", () => {
      const template = { service: "splunk", token: "abc" };
      const integrationConfigurations = [
        {
          integrationId,
          configurationResponses: [
            { id: "conf-1", template: JSON.stringify(template) },
            { id: "conf-2", template: '{"service":"datadog"}' },
          ],
        },
      ] as any;
      const result = service.getIntegrationConfiguration(
        integrationId,
        serviceName,
        integrationConfigurations,
      );
      expect(result).toEqual(template);
    });

    it("should return the first matching configuration if multiple match", () => {
      const template1 = { service: "splunk", token: "abc" };
      const template2 = { service: "splunk", token: "def" };
      const integrationConfigurations = [
        {
          integrationId,
          configurationResponses: [
            { id: "conf-1", template: JSON.stringify(template1) },
            { id: "conf-2", template: JSON.stringify(template2) },
          ],
        },
      ] as any;
      const result = service.getIntegrationConfiguration(
        integrationId,
        serviceName,
        integrationConfigurations,
      );
      expect(result).toEqual(template1);
    });

    it("should skip invalid JSON templates", () => {
      const template = { service: "splunk", token: "abc" };
      const integrationConfigurations = [
        {
          integrationId,
          configurationResponses: [
            { id: "conf-1", template: "invalid-json" },
            { id: "conf-2", template: JSON.stringify(template) },
          ],
        },
      ] as any;
      const result = service.getIntegrationConfiguration(
        integrationId,
        serviceName,
        integrationConfigurations,
      );
      expect(result).toEqual(template);
    });

    it("should return null if all templates are invalid JSON", () => {
      const integrationConfigurations = [
        {
          integrationId,
          configurationResponses: [
            { id: "conf-1", template: "invalid-json" },
            { id: "conf-2", template: "" },
          ],
        },
      ] as any;
      const result = service.getIntegrationConfiguration(
        integrationId,
        serviceName,
        integrationConfigurations,
      );
      expect(result).toBeNull();
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
