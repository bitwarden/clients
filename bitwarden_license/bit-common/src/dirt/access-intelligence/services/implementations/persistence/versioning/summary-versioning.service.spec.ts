import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { mockSummaryData } from "../../../../../reports/risk-insights/models/mocks/mock-data";
import { AccessReportSummaryView } from "../../../../models";
import { UnsupportedVersionError } from "../../../abstractions/versioning.service";

import { SummaryVersioningService } from "./summary-versioning.service";

describe("SummaryVersioningService", () => {
  let service: SummaryVersioningService;
  const mockLogService = mock<LogService>();

  const validSummaryData = {
    totalMemberCount: 5,
    totalAtRiskMemberCount: 2,
    totalApplicationCount: 3,
    totalAtRiskApplicationCount: 1,
    totalCriticalMemberCount: 1,
    totalCriticalAtRiskMemberCount: 1,
    totalCriticalApplicationCount: 1,
    totalCriticalAtRiskApplicationCount: 1,
    totalPasswordCount: 0,
    totalAtRiskPasswordCount: 0,
    totalCriticalPasswordCount: 0,
    totalCriticalAtRiskPasswordCount: 0,
  };

  const validEnvelope = { version: 1, data: validSummaryData };

  beforeEach(() => {
    service = new SummaryVersioningService(mockLogService);
    jest.clearAllMocks();
  });

  describe("process", () => {
    it("should accept versioned envelope and return wasLegacy: false", () => {
      const result = service.process(validEnvelope);

      expect(result.wasLegacy).toBe(false);
      expect(result.data).toMatchObject(validSummaryData);
    });

    it("should accept legacy flat object and return wasLegacy: true", () => {
      const result = service.process(validSummaryData);

      expect(result.wasLegacy).toBe(true);
      expect(result.data).toMatchObject(validSummaryData);
    });

    it("should accept mockSummaryData as legacy", () => {
      const result = service.process(mockSummaryData);

      expect(result.wasLegacy).toBe(true);
      expect(result.data).toMatchObject(mockSummaryData);
    });

    it("should throw UnsupportedVersionError for unknown version in envelope", () => {
      expect(() => service.process({ version: 99, data: validSummaryData })).toThrow(
        UnsupportedVersionError,
      );
    });

    it("should accept old blob without password count fields, defaulting them as absent", () => {
      // Old blobs predate password counts — validator must accept them unchanged
      const result = service.process(validSummaryData);
      expect(result.wasLegacy).toBe(true);
      expect(result.data).toMatchObject(validSummaryData);
    });

    it("should accept versioned blob with password count fields present", () => {
      const withPasswords = {
        ...validSummaryData,
        totalPasswordCount: 20,
        totalAtRiskPasswordCount: 5,
        totalCriticalPasswordCount: 10,
        totalCriticalAtRiskPasswordCount: 3,
      };
      const result = service.process({ version: 1, data: withPasswords });
      expect(result.wasLegacy).toBe(false);
      expect(result.data.totalPasswordCount).toBe(20);
      expect(result.data.totalAtRiskPasswordCount).toBe(5);
    });

    it("should throw when required fields are missing", () => {
      expect(() => service.process({ invalid: "summary" })).toThrow(
        /Summary data validation failed/,
      );
    });

    it("should throw for null input", () => {
      expect(() => service.process(null)).toThrow(/Summary data validation failed/);
    });
  });

  describe("serialize", () => {
    it("should serialize as versioned envelope with version 1", () => {
      const view = AccessReportSummaryView.fromJSON(validSummaryData);
      const serialized = service.serialize(view);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(1);
      expect(parsed.data).toMatchObject(validSummaryData);
    });

    it("should not include version as a sibling field alongside data fields", () => {
      const view = AccessReportSummaryView.fromJSON(validSummaryData);
      const serialized = service.serialize(view);
      const parsed = JSON.parse(serialized);

      expect(parsed.totalMemberCount).toBeUndefined();
      expect(parsed.data.totalMemberCount).toBe(validSummaryData.totalMemberCount);
    });

    it("should not include date in the serialized blob", () => {
      const view = AccessReportSummaryView.fromJSON(validSummaryData);
      view.date = new Date("2024-01-15");
      const serialized = service.serialize(view);
      const parsed = JSON.parse(serialized);

      expect(parsed.data.date).toBeUndefined();
    });

    it("should produce output that process accepts as versioned", () => {
      const view = AccessReportSummaryView.fromJSON(validSummaryData);
      const serialized = service.serialize(view);
      const parsed = JSON.parse(serialized);

      const result = service.process(parsed);
      expect(result.wasLegacy).toBe(false);
    });
  });
});
