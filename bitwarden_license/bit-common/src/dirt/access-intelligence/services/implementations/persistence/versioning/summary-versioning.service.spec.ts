import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { mockSummaryData } from "../../../../../reports/risk-insights/models/mocks/mock-data";
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
      const serialized = service.serialize(validSummaryData);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(1);
      expect(parsed.data).toMatchObject(validSummaryData);
    });

    it("should not include version as a sibling field alongside data fields", () => {
      const serialized = service.serialize(validSummaryData);
      const parsed = JSON.parse(serialized);

      expect(parsed.totalMemberCount).toBeUndefined();
      expect(parsed.data.totalMemberCount).toBe(validSummaryData.totalMemberCount);
    });

    it("should produce output that process accepts as versioned", () => {
      const serialized = service.serialize(validSummaryData);
      const parsed = JSON.parse(serialized);

      const result = service.process(parsed);
      expect(result.wasLegacy).toBe(false);
    });
  });
});
