import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { OrganizationReportApplication } from "../../../../../reports/risk-insights/models";
import { UnsupportedVersionError } from "../../../abstractions/versioning.service";

import { ApplicationVersioningService } from "./application-versioning.service";

describe("ApplicationVersioningService", () => {
  let service: ApplicationVersioningService;
  const mockLogService = mock<LogService>();

  const validData = [
    { applicationName: "app.com", isCritical: true, reviewedDate: "2024-01-01T00:00:00.000Z" },
    { applicationName: "app2.com", isCritical: false, reviewedDate: undefined },
  ];

  const validEnvelope = { version: 1, data: validData };

  beforeEach(() => {
    service = new ApplicationVersioningService(mockLogService);
    jest.clearAllMocks();
  });

  describe("process", () => {
    it("should accept versioned envelope and return wasLegacy: false", () => {
      const result = service.process(validEnvelope);

      expect(result.wasLegacy).toBe(false);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].applicationName).toBe("app.com");
    });

    it("should accept legacy array and return wasLegacy: true with reviewedDate converted to string", () => {
      const legacyApps = [
        { applicationName: "app.com", isCritical: true, reviewedDate: new Date("2024-01-01") },
      ];

      const result = service.process(legacyApps);

      expect(result.wasLegacy).toBe(true);
      expect(result.data[0].reviewedDate).toBe("2024-01-01T00:00:00.000Z");
    });

    it("should convert legacy null reviewedDate to undefined", () => {
      const legacyApps: OrganizationReportApplication[] = [
        { applicationName: "app.com", isCritical: false, reviewedDate: null },
      ];

      const result = service.process(legacyApps);

      expect(result.wasLegacy).toBe(true);
      expect(result.data[0].reviewedDate).toBeUndefined();
    });

    it("should throw UnsupportedVersionError for unknown version in envelope", () => {
      expect(() => service.process({ version: 99, data: [] })).toThrow(UnsupportedVersionError);
    });

    it("should throw for non-array non-envelope input", () => {
      expect(() => service.process({ invalid: true })).toThrow(
        /Application data validation failed/,
      );
    });

    it("should throw for null input", () => {
      expect(() => service.process(null)).toThrow(/Application data validation failed/);
    });
  });

  describe("serialize", () => {
    it("should serialize as versioned envelope with version 1", () => {
      const serialized = service.serialize(validData);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(1);
      expect(parsed.data).toEqual(validData);
    });

    it("should produce output that process accepts as versioned", () => {
      const serialized = service.serialize(validData);
      const parsed = JSON.parse(serialized);

      const result = service.process(parsed);
      expect(result.wasLegacy).toBe(false);
      expect(result.data).toHaveLength(2);
    });
  });
});
