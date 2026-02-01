import { DatadogConfiguration } from "./configuration/datadog-configuration";
import { HecConfiguration } from "./configuration/hec-configuration";
import { OrgIntegrationBuilder } from "./integration-builder";
import { DatadogTemplate } from "./integration-configuration-config/configuration-template/datadog-template";
import { HecTemplate } from "./integration-configuration-config/configuration-template/hec-template";
import { OrganizationIntegrationServiceName } from "./organization-integration-service-type";
import { OrganizationIntegrationType } from "./organization-integration-type";

describe("OrgIntegrationBuilder", () => {
  describe("buildHecConfiguration", () => {
    const testUri = "https://hec.example.com:8088/services/collector";
    const testToken = "test-token";

    it("should create HecConfiguration with correct values", () => {
      const config = OrgIntegrationBuilder.buildHecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );

      expect(config).toBeInstanceOf(HecConfiguration);
      expect((config as HecConfiguration).uri).toBe(testUri);
      expect((config as HecConfiguration).token).toBe(testToken);
      expect(config.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
    });

    it("should use default Bearer scheme", () => {
      const config = OrgIntegrationBuilder.buildHecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );

      expect((config as HecConfiguration).scheme).toBe("Bearer");
    });

    it("should use custom scheme when provided", () => {
      const config = OrgIntegrationBuilder.buildHecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.CrowdStrike,
        "Splunk",
      );

      expect((config as HecConfiguration).scheme).toBe("Splunk");
    });

    it("should work with CrowdStrike service name", () => {
      const config = OrgIntegrationBuilder.buildHecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.CrowdStrike,
      );

      expect(config.bw_serviceName).toBe(OrganizationIntegrationServiceName.CrowdStrike);
    });
  });

  describe("buildHecTemplate", () => {
    it("should create HecTemplate with correct values", () => {
      const template = OrgIntegrationBuilder.buildHecTemplate(
        "main",
        OrganizationIntegrationServiceName.Huntress,
      );

      expect(template).toBeInstanceOf(HecTemplate);
      expect((template as HecTemplate).index).toBe("main");
      expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
    });

    it("should handle empty index", () => {
      const template = OrgIntegrationBuilder.buildHecTemplate(
        "",
        OrganizationIntegrationServiceName.Huntress,
      );

      expect((template as HecTemplate).index).toBe("");
    });
  });

  describe("buildDataDogConfiguration", () => {
    const testUri = "https://http-intake.logs.datadoghq.com/api/v2/logs";
    const testApiKey = "test-api-key";

    it("should create DatadogConfiguration with correct values", () => {
      const config = OrgIntegrationBuilder.buildDataDogConfiguration(testUri, testApiKey);

      expect(config).toBeInstanceOf(DatadogConfiguration);
      expect((config as DatadogConfiguration).uri).toBe(testUri);
      expect((config as DatadogConfiguration).apiKey).toBe(testApiKey);
    });

    it("should always use Datadog service name", () => {
      const config = OrgIntegrationBuilder.buildDataDogConfiguration(testUri, testApiKey);

      expect(config.bw_serviceName).toBe(OrganizationIntegrationServiceName.Datadog);
    });
  });

  describe("buildDataDogTemplate", () => {
    it("should create DatadogTemplate with correct service name", () => {
      const template = OrgIntegrationBuilder.buildDataDogTemplate(
        OrganizationIntegrationServiceName.Datadog,
      );

      expect(template).toBeInstanceOf(DatadogTemplate);
      expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.Datadog);
    });
  });

  describe("buildConfiguration", () => {
    describe("HEC type", () => {
      it("should build HecConfiguration from JSON string", () => {
        const json = JSON.stringify({
          Uri: "https://hec.example.com",
          Token: "test-token",
          Scheme: "Bearer",
          bw_serviceName: OrganizationIntegrationServiceName.Huntress,
        });

        const config = OrgIntegrationBuilder.buildConfiguration(
          OrganizationIntegrationType.Hec,
          json,
        );

        expect(config).toBeInstanceOf(HecConfiguration);
        expect((config as HecConfiguration).uri).toBe("https://hec.example.com");
        expect((config as HecConfiguration).token).toBe("test-token");
        expect((config as HecConfiguration).scheme).toBe("Bearer");
      });

      it("should normalize PascalCase properties to camelCase", () => {
        const json = JSON.stringify({
          Uri: "https://hec.example.com",
          Token: "test-token",
          Scheme: "Splunk",
          bw_serviceName: OrganizationIntegrationServiceName.CrowdStrike,
        });

        const config = OrgIntegrationBuilder.buildConfiguration(
          OrganizationIntegrationType.Hec,
          json,
        );

        expect((config as HecConfiguration).uri).toBe("https://hec.example.com");
        expect((config as HecConfiguration).token).toBe("test-token");
        expect((config as HecConfiguration).scheme).toBe("Splunk");
      });
    });

    describe("Datadog type", () => {
      it("should build DatadogConfiguration from JSON string", () => {
        const json = JSON.stringify({
          Uri: "https://datadoghq.com/api",
          ApiKey: "dd-api-key",
          bw_serviceName: OrganizationIntegrationServiceName.Datadog,
        });

        const config = OrgIntegrationBuilder.buildConfiguration(
          OrganizationIntegrationType.Datadog,
          json,
        );

        expect(config).toBeInstanceOf(DatadogConfiguration);
        expect((config as DatadogConfiguration).uri).toBe("https://datadoghq.com/api");
        expect((config as DatadogConfiguration).apiKey).toBe("dd-api-key");
      });
    });

    describe("error handling", () => {
      it("should throw for unsupported integration type", () => {
        const json = JSON.stringify({ uri: "test" });

        expect(() =>
          OrgIntegrationBuilder.buildConfiguration(999 as OrganizationIntegrationType, json),
        ).toThrow("Unsupported integration type: 999");
      });

      it("should throw for invalid JSON", () => {
        expect(() =>
          OrgIntegrationBuilder.buildConfiguration(OrganizationIntegrationType.Hec, "invalid-json"),
        ).toThrow("Invalid integration configuration: JSON parse error");
      });

      it("should handle empty JSON string by using empty object", () => {
        const config = OrgIntegrationBuilder.buildConfiguration(
          OrganizationIntegrationType.Hec,
          "",
        );

        expect(config).toBeInstanceOf(HecConfiguration);
      });

      it("should handle undefined values in JSON", () => {
        const json = JSON.stringify({});

        const config = OrgIntegrationBuilder.buildConfiguration(
          OrganizationIntegrationType.Hec,
          json,
        );

        expect(config).toBeInstanceOf(HecConfiguration);
        expect((config as HecConfiguration).uri).toBeUndefined();
      });
    });
  });

  describe("buildTemplate", () => {
    describe("HEC type", () => {
      it("should build HecTemplate from JSON string", () => {
        const json = JSON.stringify({
          index: "main",
          bw_serviceName: OrganizationIntegrationServiceName.Huntress,
        });

        const template = OrgIntegrationBuilder.buildTemplate(OrganizationIntegrationType.Hec, json);

        expect(template).toBeInstanceOf(HecTemplate);
        expect((template as HecTemplate).index).toBe("main");
        expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
      });

      it("should normalize PascalCase properties", () => {
        const json = JSON.stringify({
          Index: "security",
          bw_serviceName: OrganizationIntegrationServiceName.CrowdStrike,
        });

        const template = OrgIntegrationBuilder.buildTemplate(OrganizationIntegrationType.Hec, json);

        expect((template as HecTemplate).index).toBe("security");
      });
    });

    describe("Datadog type", () => {
      it("should build DatadogTemplate from JSON string", () => {
        const json = JSON.stringify({
          bw_serviceName: OrganizationIntegrationServiceName.Datadog,
        });

        const template = OrgIntegrationBuilder.buildTemplate(
          OrganizationIntegrationType.Datadog,
          json,
        );

        expect(template).toBeInstanceOf(DatadogTemplate);
        expect(template.bw_serviceName).toBe(OrganizationIntegrationServiceName.Datadog);
      });
    });

    describe("error handling", () => {
      it("should throw for unsupported integration type", () => {
        const json = JSON.stringify({ index: "test" });

        expect(() =>
          OrgIntegrationBuilder.buildTemplate(999 as OrganizationIntegrationType, json),
        ).toThrow("Unsupported integration type: 999");
      });

      it("should throw for invalid JSON", () => {
        expect(() =>
          OrgIntegrationBuilder.buildTemplate(OrganizationIntegrationType.Hec, "invalid-json"),
        ).toThrow("Invalid integration configuration: JSON parse error");
      });
    });
  });

  describe("property case normalization", () => {
    it("should convert first character to lowercase", () => {
      const json = JSON.stringify({
        Uri: "https://example.com",
        Token: "token",
        Scheme: "Bearer",
        bw_serviceName: "Huntress",
      });

      const config = OrgIntegrationBuilder.buildConfiguration(
        OrganizationIntegrationType.Hec,
        json,
      );

      // Verify the properties were normalized (accessed via camelCase)
      expect((config as HecConfiguration).uri).toBe("https://example.com");
      expect((config as HecConfiguration).token).toBe("token");
    });

    it("should handle nested objects", () => {
      // Using Datadog type which has nested enrichment_details
      const json = JSON.stringify({
        Uri: "https://datadoghq.com",
        ApiKey: "key",
        NestedObject: {
          InnerProperty: "value",
        },
      });

      // This tests that nested properties are also normalized
      const config = OrgIntegrationBuilder.buildConfiguration(
        OrganizationIntegrationType.Datadog,
        json,
      );

      expect(config).toBeInstanceOf(DatadogConfiguration);
    });

    it("should handle arrays", () => {
      const json = JSON.stringify({
        Uri: "https://example.com",
        Token: "token",
        Items: [{ Name: "item1" }, { Name: "item2" }],
        bw_serviceName: "Huntress",
      });

      const config = OrgIntegrationBuilder.buildConfiguration(
        OrganizationIntegrationType.Hec,
        json,
      );

      expect(config).toBeInstanceOf(HecConfiguration);
    });

    it("should preserve properties that start with lowercase", () => {
      const json = JSON.stringify({
        uri: "https://example.com",
        token: "token",
        bw_serviceName: "Huntress",
      });

      const config = OrgIntegrationBuilder.buildConfiguration(
        OrganizationIntegrationType.Hec,
        json,
      );

      expect((config as HecConfiguration).uri).toBe("https://example.com");
      expect((config as HecConfiguration).token).toBe("token");
    });
  });
});
