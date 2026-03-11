import { mock } from "jest-mock-extended";

import { CipherId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import {
  ApplicationHealthReportDetail,
  MemberDetails,
  OrganizationReportApplication,
} from "../../models";
import { mockReportData, mockSummaryData } from "../../models/mocks/mock-data";
import {
  AccessReportPayload,
  UnsupportedReportFormatError,
} from "../abstractions/access-report-encryption.service";

import { DefaultBlobVersioningService } from "./default-blob-versioning.service";

describe("DefaultBlobVersioningService", () => {
  let service: DefaultBlobVersioningService;
  const mockLogService = mock<LogService>();

  const validV2ReportPayload: AccessReportPayload = {
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

  const validV2ReportBlob = { version: 2, ...validV2ReportPayload };

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

  beforeEach(() => {
    service = new DefaultBlobVersioningService(mockLogService);
    jest.clearAllMocks();
  });

  describe("processReport", () => {
    it("should accept V2 blob and return wasV1: false", () => {
      const result = service.processReport(validV2ReportBlob);

      expect(result.wasV1).toBe(false);
      expect(result.data.reports).toHaveLength(1);
      expect(result.data.reports[0].applicationName).toBe("app.com");
      expect(result.data.memberRegistry).toHaveProperty("user-1");
    });

    it("should transform V1 array to V2 payload and return wasV1: true", () => {
      const result = service.processReport(mockReportData);

      expect(result.wasV1).toBe(true);
      expect(result.data.reports).toHaveLength(mockReportData.length);
      expect(result.data.memberRegistry).toBeDefined();
    });

    it("should build member registry from V1 memberDetails", () => {
      const v1Data: ApplicationHealthReportDetail[] = [
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

      const result = service.processReport(v1Data);

      expect(result.data.memberRegistry["u1"]).toEqual({
        id: "u1",
        userName: "Alice",
        email: "alice@test.com",
      });
    });

    it("should convert V1 memberDetails and cipherIds to memberRefs and cipherRefs", () => {
      const v1Data: ApplicationHealthReportDetail[] = [
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

      const result = service.processReport(v1Data);

      const report = result.data.reports[0];
      expect(report.memberRefs).toEqual({ u1: true, u2: false });
      expect(report.cipherRefs).toEqual({ c1: true, c2: false });
    });

    it("should deduplicate members across V1 apps in registry", () => {
      const sharedMember: MemberDetails = {
        userGuid: "u1",
        userName: "Alice",
        email: "a@test.com",
        cipherId: "c1" as CipherId,
      };
      const v1Data: ApplicationHealthReportDetail[] = [
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

      const result = service.processReport(v1Data);

      expect(Object.keys(result.data.memberRegistry)).toHaveLength(1);
    });

    it("should throw UnsupportedReportFormatError for unknown version", () => {
      expect(() => service.processReport({ version: 99, reports: [], memberRegistry: {} })).toThrow(
        UnsupportedReportFormatError,
      );
    });

    it("should throw UnsupportedReportFormatError for non-array non-versioned object", () => {
      expect(() => service.processReport({ someField: "value" })).toThrow(
        UnsupportedReportFormatError,
      );
    });

    it("should throw UnsupportedReportFormatError for null input", () => {
      expect(() => service.processReport(null)).toThrow(UnsupportedReportFormatError);
    });
  });

  describe("processApplication", () => {
    it("should accept V2 wrapper blob and return wasV1: false", () => {
      const v2Blob = {
        version: 2,
        items: [
          {
            applicationName: "app.com",
            isCritical: true,
            reviewedDate: "2024-01-01T00:00:00.000Z",
          },
        ],
      };

      const result = service.processApplication(v2Blob);

      expect(result.wasV1).toBe(false);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].applicationName).toBe("app.com");
    });

    it("should accept V1 array and return wasV1: true with reviewedDate converted to string", () => {
      const v1Apps = [
        { applicationName: "app.com", isCritical: true, reviewedDate: new Date("2024-01-01") },
      ];

      const result = service.processApplication(v1Apps);

      expect(result.wasV1).toBe(true);
      expect(result.data[0].reviewedDate).toBe("2024-01-01T00:00:00.000Z");
    });

    it("should convert V1 null reviewedDate to undefined", () => {
      const v1Apps: OrganizationReportApplication[] = [
        { applicationName: "app.com", isCritical: false, reviewedDate: null },
      ];

      const result = service.processApplication(v1Apps);

      expect(result.wasV1).toBe(true);
      expect(result.data[0].reviewedDate).toBeUndefined();
    });

    it("should throw for non-array non-wrapper input", () => {
      expect(() => service.processApplication({ invalid: true })).toThrow(
        /Application data validation failed/,
      );
    });

    it("should throw for null input", () => {
      expect(() => service.processApplication(null)).toThrow(/Application data validation failed/);
    });
  });

  describe("processSummary", () => {
    it("should accept V2 object with version field and return wasV1: false", () => {
      const v2Summary = { version: 2, ...validSummaryData };

      const result = service.processSummary(v2Summary);

      expect(result.wasV1).toBe(false);
      expect(result.data).toMatchObject(validSummaryData);
    });

    it("should accept V1 object without version field and return wasV1: true", () => {
      const result = service.processSummary(validSummaryData);

      expect(result.wasV1).toBe(true);
      expect(result.data).toMatchObject(validSummaryData);
    });

    it("should accept mockSummaryData as V1", () => {
      const result = service.processSummary(mockSummaryData);

      expect(result.wasV1).toBe(true);
      expect(result.data).toMatchObject(mockSummaryData);
    });

    it("should throw when required fields are missing", () => {
      expect(() => service.processSummary({ invalid: "summary" })).toThrow(
        /Summary data validation failed/,
      );
    });

    it("should throw for null input", () => {
      expect(() => service.processSummary(null)).toThrow(/Summary data validation failed/);
    });
  });

  describe("serializeReport", () => {
    it("should serialize with version: 2 wrapper", () => {
      const serialized = service.serializeReport(validV2ReportPayload);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(2);
      expect(parsed.reports).toEqual(validV2ReportPayload.reports);
      expect(parsed.memberRegistry).toEqual(validV2ReportPayload.memberRegistry);
    });

    it("should produce output that processReport accepts as V2", () => {
      const serialized = service.serializeReport(validV2ReportPayload);
      const parsed = JSON.parse(serialized);

      const result = service.processReport(parsed);
      expect(result.wasV1).toBe(false);
      expect(result.data).toMatchObject(validV2ReportPayload);
    });
  });

  describe("serializeApplication", () => {
    it("should serialize as versioned wrapper object", () => {
      const items: Array<{
        applicationName: string;
        isCritical: boolean;
        reviewedDate: string | undefined;
      }> = [{ applicationName: "app.com", isCritical: true, reviewedDate: undefined }];
      const serialized = service.serializeApplication(items);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(2);
      expect(parsed.items).toEqual(items);
    });

    it("should produce output that processApplication accepts as V2", () => {
      const items = [
        { applicationName: "app.com", isCritical: false, reviewedDate: "2024-01-01T00:00:00.000Z" },
      ];
      const serialized = service.serializeApplication(items);
      const parsed = JSON.parse(serialized);

      const result = service.processApplication(parsed);
      expect(result.wasV1).toBe(false);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("serializeSummary", () => {
    it("should serialize with version: 2 field", () => {
      const serialized = service.serializeSummary(validSummaryData);
      const parsed = JSON.parse(serialized);

      expect(parsed.version).toBe(2);
      expect(parsed.totalMemberCount).toBe(validSummaryData.totalMemberCount);
    });

    it("should produce output that processSummary accepts as V2", () => {
      const serialized = service.serializeSummary(validSummaryData);
      const parsed = JSON.parse(serialized);

      const result = service.processSummary(parsed);
      expect(result.wasV1).toBe(false);
    });
  });
});
