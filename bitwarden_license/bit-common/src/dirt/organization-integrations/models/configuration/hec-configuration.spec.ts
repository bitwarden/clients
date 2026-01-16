import { OrganizationIntegrationServiceName } from "../organization-integration-service-type";

import { HecConfiguration } from "./hec-configuration";

describe("HecConfiguration", () => {
  const testUri = "https://hec.example.com:8088/services/collector";
  const testToken = "test-hec-token-12345";

  describe("constructor", () => {
    it("should initialize with required parameters", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );

      expect(config.uri).toBe(testUri);
      expect(config.token).toBe(testToken);
      expect(config.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
    });

    it("should default scheme to Bearer when not provided", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );

      expect(config.scheme).toBe("Bearer");
    });

    it("should use custom scheme when provided", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
        "Splunk",
      );

      expect(config.scheme).toBe("Splunk");
    });

    it("should work with CrowdStrike service name", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.CrowdStrike,
        "Bearer",
      );

      expect(config.bw_serviceName).toBe(OrganizationIntegrationServiceName.CrowdStrike);
    });
  });

  describe("toString", () => {
    it("should produce valid JSON", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );

      expect(() => JSON.parse(config.toString())).not.toThrow();
    });

    it("should include Uri with PascalCase key", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );
      const result = JSON.parse(config.toString());

      expect(result.Uri).toBe(testUri);
      expect(result.uri).toBeUndefined();
    });

    it("should include Scheme with PascalCase key", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
        "Splunk",
      );
      const result = JSON.parse(config.toString());

      expect(result.Scheme).toBe("Splunk");
      expect(result.scheme).toBeUndefined();
    });

    it("should include Token with PascalCase key", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );
      const result = JSON.parse(config.toString());

      expect(result.Token).toBe(testToken);
      expect(result.token).toBeUndefined();
    });

    it("should include bw_serviceName with original casing", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );
      const result = JSON.parse(config.toString());

      expect(result.bw_serviceName).toBe(OrganizationIntegrationServiceName.Huntress);
    });

    it("should include default Bearer scheme in output", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );
      const result = JSON.parse(config.toString());

      expect(result.Scheme).toBe("Bearer");
    });

    it("should produce consistent output for same input", () => {
      const config1 = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
        "Bearer",
      );
      const config2 = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
        "Bearer",
      );

      expect(config1.toString()).toBe(config2.toString());
    });

    it("should handle special characters in token", () => {
      const specialToken = "token+with/special=chars&more";
      const config = new HecConfiguration(
        testUri,
        specialToken,
        OrganizationIntegrationServiceName.Huntress,
      );
      const result = JSON.parse(config.toString());

      expect(result.Token).toBe(specialToken);
    });

    it("should handle URLs with query parameters", () => {
      const uriWithParams = "https://hec.example.com:8088/services/collector?channel=abc123";
      const config = new HecConfiguration(
        uriWithParams,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );
      const result = JSON.parse(config.toString());

      expect(result.Uri).toBe(uriWithParams);
    });
  });

  describe("service property", () => {
    it("should allow setting optional service property", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );
      config.service = "custom-service";

      expect(config.service).toBe("custom-service");
    });

    it("should be undefined by default", () => {
      const config = new HecConfiguration(
        testUri,
        testToken,
        OrganizationIntegrationServiceName.Huntress,
      );

      expect(config.service).toBeUndefined();
    });
  });
});
