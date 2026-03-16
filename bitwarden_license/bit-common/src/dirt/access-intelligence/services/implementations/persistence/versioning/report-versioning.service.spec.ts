import { mock } from "jest-mock-extended";

import { CipherId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  ApplicationHealthReportDetail,
  MemberDetails,
} from "../../../../../reports/risk-insights/models";
import { mockReportData } from "../../../../../reports/risk-insights/models/mocks/mock-data";
import { AccessReportPayload } from "../../../abstractions/access-report-encryption.service";
import { UnsupportedVersionError } from "../../../abstractions/versioning.service";

import { ReportVersioningService } from "./report-versioning.service";

describe("ReportVersioningService", () => {
  let service: ReportVersioningService;
  const mockLogService = mock<LogService>();

  const validPayload: AccessReportPayload = {
    reports: [
      {
        applicationName: "app.com",
        passwordCount: 3,
        atRiskPasswordCount: 1,
        memberRefs: { "user-1": true, "user-2": false },
        cipherRefs: { "cipher-1": true },
        memberCount: 2,
        atRiskMemberCount: 1,
      },
    ],
    memberRegistry: {
      "user-1": { id: "user-1", userName: "Alice", email: "alice@example.com" },
      "user-2": { id: "user-2", userName: "Bob", email: "bob@example.com" },
    },
  };

  const validEnvelope = { version: 1, data: validPayload };

  beforeEach(() => {
    service = new ReportVersioningService(mockLogService);
    jest.clearAllMocks();
  });

  describe("process", () => {
    it("should accept versioned envelope and return wasLegacy: false", () => {
      const result = service.process(validEnvelope);

      expect(result.wasLegacy).toBe(false);
      expect(result.data.reports).toHaveLength(1);
      expect(result.data.reports[0].applicationName).toBe("app.com");
      expect(result.data.memberRegistry).toHaveProperty("user-1");
    });

    it("should transform legacy array to payload and return wasLegacy: true", () => {
      const result = service.process(mockReportData);

      expect(result.wasLegacy).toBe(true);
      expect(result.data.reports).toHaveLength(mockReportData.length);
      expect(result.data.memberRegistry).toBeDefined();
    });

    it("should build member registry from legacy memberDetails", () => {
      const legacyData: ApplicationHealthReportDetail[] = [
        {
          applicationName: "app.com",
          passwordCount: 1,
          atRiskPasswordCount: 0,
          memberCount: 1,
          atRiskMemberCount: 0,
          memberDetails: [
            {
              userGuid: "u1",
              userName: "Alice",
              email: "alice@test.com",
              cipherId: "c1" as CipherId,
            },
          ],
          atRiskMemberDetails: [] as MemberDetails[],
          cipherIds: ["c1" as CipherId],
          atRiskCipherIds: [] as CipherId[],
        },
      ];

      const result = service.process(legacyData);

      expect(result.data.memberRegistry["u1"]).toEqual({
        id: "u1",
        userName: "Alice",
        email: "alice@test.com",
      });
    });

    it("should convert legacy memberDetails and cipherIds to memberRefs and cipherRefs", () => {
      const legacyData: ApplicationHealthReportDetail[] = [
        {
          applicationName: "app.com",
          passwordCount: 2,
          atRiskPasswordCount: 1,
          memberCount: 2,
          atRiskMemberCount: 1,
          memberDetails: [
            { userGuid: "u1", userName: "Alice", email: "a@test.com", cipherId: "c1" as CipherId },
            { userGuid: "u2", userName: "Bob", email: "b@test.com", cipherId: "c2" as CipherId },
          ],
          atRiskMemberDetails: [
            { userGuid: "u1", userName: "Alice", email: "a@test.com", cipherId: "c1" as CipherId },
          ],
          cipherIds: ["c1" as CipherId, "c2" as CipherId],
          atRiskCipherIds: ["c1" as CipherId],
        },
      ];

      const result = service.process(legacyData);

      const report = result.data.reports[0];
      expect(report.memberRefs).toEqual({ u1: true, u2: false });
      expect(report.cipherRefs).toEqual({ c1: true, c2: false });
    });

    it("should deduplicate members across legacy apps in registry", () => {
      const sharedMember: MemberDetails = {
        userGuid: "u1",
        userName: "Alice",
        email: "a@test.com",
        cipherId: "c1" as CipherId,
      };
      const legacyData: ApplicationHealthReportDetail[] = [
        {
          applicationName: "app1.com",
          passwordCount: 1,
          atRiskPasswordCount: 0,
          memberCount: 1,
          atRiskMemberCount: 0,
          memberDetails: [sharedMember],
          atRiskMemberDetails: [] as MemberDetails[],
          cipherIds: ["c1" as CipherId],
          atRiskCipherIds: [] as CipherId[],
        },
        {
          applicationName: "app2.com",
          passwordCount: 1,
          atRiskPasswordCount: 0,
          memberCount: 1,
          atRiskMemberCount: 0,
          memberDetails: [sharedMember],
          atRiskMemberDetails: [] as MemberDetails[],
          cipherIds: ["c2" as CipherId],
          atRiskCipherIds: [] as CipherId[],
        },
      ];

      const result = service.process(legacyData);

      expect(Object.keys(result.data.memberRegistry)).toHaveLength(1);
    });

    it("should throw UnsupportedVersionError for unknown version in envelope", () => {
      expect(() =>
        service.process({ version: 99, data: { reports: [], memberRegistry: {} } }),
      ).toThrow(UnsupportedVersionError);
    });

    it("should throw UnsupportedVersionError for non-array non-envelope object", () => {
      expect(() => service.process({ someField: "value" })).toThrow(UnsupportedVersionError);
    });

    it("should throw UnsupportedVersionError for null input", () => {
      expect(() => service.process(null)).toThrow(UnsupportedVersionError);
    });
  });

  describe("serialize", () => {
    it("should serialize as versioned envelope with version 1", () => {
      const serialized = service.serialize(validPayload);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(1);
      expect(parsed.data.reports).toEqual(validPayload.reports);
      expect(parsed.data.memberRegistry).toEqual(validPayload.memberRegistry);
    });

    it("should produce output that process accepts as versioned", () => {
      const serialized = service.serialize(validPayload);
      const parsed = JSON.parse(serialized);

      const result = service.process(parsed);
      expect(result.wasLegacy).toBe(false);
      expect(result.data).toMatchObject(validPayload);
    });
  });
});
