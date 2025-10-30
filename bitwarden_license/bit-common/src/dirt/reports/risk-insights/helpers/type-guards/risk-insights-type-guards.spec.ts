import { MemberDetails } from "../../models";

import {
  isApplicationHealthReportDetail,
  isMemberDetails,
  isOrganizationReportApplication,
  isOrganizationReportSummary,
  validateApplicationHealthReportDetailArray,
  validateOrganizationReportApplicationArray,
  validateOrganizationReportSummary,
} from "./risk-insights-type-guards";

describe("Risk Insights Type Guards", () => {
  describe("validateApplicationHealthReportDetailArray", () => {
    it("should validate valid ApplicationHealthReportDetail array", () => {
      const validData = [
        {
          applicationName: "Test App",
          passwordCount: 10,
          atRiskPasswordCount: 2,
          atRiskCipherIds: ["cipher-1", "cipher-2"],
          memberCount: 5,
          atRiskMemberCount: 1,
          memberDetails: [
            {
              userGuid: "user-1",
              userName: "John Doe",
              email: "john@example.com",
              cipherId: "cipher-1",
            },
          ],
          atRiskMemberDetails: [
            {
              userGuid: "user-2",
              userName: "Jane Doe",
              email: "jane@example.com",
              cipherId: "cipher-2",
            },
          ],
          cipherIds: ["cipher-1", "cipher-2"],
        },
      ];

      expect(() => validateApplicationHealthReportDetailArray(validData)).not.toThrow();
      expect(validateApplicationHealthReportDetailArray(validData)).toEqual(validData);
    });

    it("should throw error for non-array input", () => {
      expect(() => validateApplicationHealthReportDetailArray("not an array")).toThrow(
        "Invalid report data: expected array of ApplicationHealthReportDetail, received non-array",
      );
    });

    it("should throw error for array with invalid elements", () => {
      const invalidData = [
        {
          applicationName: "Test App",
          // missing required fields
        },
      ];

      expect(() => validateApplicationHealthReportDetailArray(invalidData)).toThrow(
        /Invalid report data: array contains 1 invalid ApplicationHealthReportDetail element\(s\) at indices: 0/,
      );
    });

    it("should throw error for array with multiple invalid elements", () => {
      const invalidData = [
        { applicationName: "App 1" }, // invalid
        {
          applicationName: "App 2",
          passwordCount: 10,
          atRiskPasswordCount: 2,
          atRiskCipherIds: ["cipher-1"],
          memberCount: 5,
          atRiskMemberCount: 1,
          memberDetails: [] as MemberDetails[],
          atRiskMemberDetails: [] as MemberDetails[],
          cipherIds: ["cipher-1"],
        }, // valid
        { applicationName: "App 3" }, // invalid
      ];

      expect(() => validateApplicationHealthReportDetailArray(invalidData)).toThrow(
        /Invalid report data: array contains 2 invalid ApplicationHealthReportDetail element\(s\) at indices: 0, 2/,
      );
    });

    it("should throw error for invalid memberDetails", () => {
      const invalidData = [
        {
          applicationName: "Test App",
          passwordCount: 10,
          atRiskPasswordCount: 2,
          atRiskCipherIds: ["cipher-1"],
          memberCount: 5,
          atRiskMemberCount: 1,
          memberDetails: [{ userGuid: "user-1" }] as any, // missing required fields
          atRiskMemberDetails: [] as MemberDetails[],
          cipherIds: ["cipher-1"],
        },
      ];

      expect(() => validateApplicationHealthReportDetailArray(invalidData)).toThrow(
        /Invalid report data/,
      );
    });

    it("should throw error for empty string in atRiskCipherIds", () => {
      const invalidData = [
        {
          applicationName: "Test App",
          passwordCount: 10,
          atRiskPasswordCount: 2,
          atRiskCipherIds: ["cipher-1", "", "cipher-3"], // empty string
          memberCount: 5,
          atRiskMemberCount: 1,
          memberDetails: [] as MemberDetails[],
          atRiskMemberDetails: [] as MemberDetails[],
          cipherIds: ["cipher-1"],
        },
      ];

      expect(() => validateApplicationHealthReportDetailArray(invalidData)).toThrow(
        /Invalid report data/,
      );
    });

    it("should throw error for empty string in cipherIds", () => {
      const invalidData = [
        {
          applicationName: "Test App",
          passwordCount: 10,
          atRiskPasswordCount: 2,
          atRiskCipherIds: ["cipher-1"],
          memberCount: 5,
          atRiskMemberCount: 1,
          memberDetails: [] as MemberDetails[],
          atRiskMemberDetails: [] as MemberDetails[],
          cipherIds: ["", "cipher-2"], // empty string
        },
      ];

      expect(() => validateApplicationHealthReportDetailArray(invalidData)).toThrow(
        /Invalid report data/,
      );
    });
  });

  describe("validateOrganizationReportSummary", () => {
    it("should validate valid OrganizationReportSummary", () => {
      const validData = {
        totalMemberCount: 10,
        totalApplicationCount: 5,
        totalAtRiskMemberCount: 2,
        totalAtRiskApplicationCount: 1,
        totalCriticalApplicationCount: 3,
        totalCriticalMemberCount: 4,
        totalCriticalAtRiskMemberCount: 1,
        totalCriticalAtRiskApplicationCount: 1,
      };

      expect(() => validateOrganizationReportSummary(validData)).not.toThrow();
      expect(validateOrganizationReportSummary(validData)).toEqual(validData);
    });

    it("should throw error for invalid field types", () => {
      const invalidData = {
        totalMemberCount: "10", // should be number
        totalApplicationCount: 5,
        totalAtRiskMemberCount: 2,
        totalAtRiskApplicationCount: 1,
        totalCriticalApplicationCount: 3,
        totalCriticalMemberCount: 4,
        totalCriticalAtRiskMemberCount: 1,
        totalCriticalAtRiskApplicationCount: 1,
      };

      expect(() => validateOrganizationReportSummary(invalidData)).toThrow(
        /Invalid report summary/,
      );
    });
  });

  describe("validateOrganizationReportApplicationArray", () => {
    it("should validate valid OrganizationReportApplication array", () => {
      const validData = [
        {
          applicationName: "Test App",
          isCritical: true,
          reviewedDate: null,
        },
        {
          applicationName: "Another App",
          isCritical: false,
          reviewedDate: new Date("2024-01-01"),
        },
      ];

      expect(() => validateOrganizationReportApplicationArray(validData)).not.toThrow();
      const result = validateOrganizationReportApplicationArray(validData);
      expect(result[0].applicationName).toBe("Test App");
      expect(result[1].reviewedDate).toBeInstanceOf(Date);
    });

    it("should convert string dates to Date objects", () => {
      const validData = [
        {
          applicationName: "Test App",
          isCritical: true,
          reviewedDate: "2024-01-01T00:00:00.000Z",
        },
      ];

      const result = validateOrganizationReportApplicationArray(validData);
      expect(result[0].reviewedDate).toBeInstanceOf(Date);
      expect(result[0].reviewedDate?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    });

    it("should throw error for invalid date strings", () => {
      const invalidData = [
        {
          applicationName: "Test App",
          isCritical: true,
          reviewedDate: "invalid-date",
        },
      ];

      expect(() => validateOrganizationReportApplicationArray(invalidData)).toThrow(
        "Invalid application data: array contains 1 invalid OrganizationReportApplication element(s) at indices: 0",
      );
    });

    it("should throw error for non-array input", () => {
      expect(() => validateOrganizationReportApplicationArray("not an array")).toThrow(
        "Invalid application data: expected array of OrganizationReportApplication, received non-array",
      );
    });

    it("should throw error for array with invalid elements", () => {
      const invalidData = [
        {
          applicationName: "Test App",
          reviewedDate: null as any,
          // missing isCritical field
        } as any,
      ];

      expect(() => validateOrganizationReportApplicationArray(invalidData)).toThrow(
        /Invalid application data: array contains 1 invalid OrganizationReportApplication element\(s\) at indices: 0/,
      );
    });

    it("should throw error for invalid field types", () => {
      const invalidData = [
        {
          applicationName: 123 as any, // should be string
          isCritical: true,
          reviewedDate: null as any,
        } as any,
      ];

      expect(() => validateOrganizationReportApplicationArray(invalidData)).toThrow(
        /Invalid application data/,
      );
    });

    it("should accept null reviewedDate", () => {
      const validData = [
        {
          applicationName: "Test App",
          isCritical: true,
          reviewedDate: null as any,
        },
      ];

      expect(() => validateOrganizationReportApplicationArray(validData)).not.toThrow();
      const result = validateOrganizationReportApplicationArray(validData);
      expect(result[0].reviewedDate).toBeNull();
    });
  });

  // Tests for exported type guard functions
  describe("isMemberDetails", () => {
    it("should return true for valid MemberDetails", () => {
      const validData = {
        userGuid: "user-1",
        userName: "John Doe",
        email: "john@example.com",
        cipherId: "cipher-1",
      };
      expect(isMemberDetails(validData)).toBe(true);
    });

    it("should return false for empty userGuid", () => {
      const invalidData = {
        userGuid: "",
        userName: "John Doe",
        email: "john@example.com",
        cipherId: "cipher-1",
      };
      expect(isMemberDetails(invalidData)).toBe(false);
    });

    it("should return false for empty userName", () => {
      const invalidData = {
        userGuid: "user-1",
        userName: "",
        email: "john@example.com",
        cipherId: "cipher-1",
      };
      expect(isMemberDetails(invalidData)).toBe(false);
    });

    it("should return true for null userName", () => {
      const validData = {
        userGuid: "user-1",
        userName: null as string | null,
        email: "john@example.com",
        cipherId: "cipher-1",
      };
      expect(isMemberDetails(validData)).toBe(true);
    });

    it("should return false for empty email", () => {
      const invalidData = {
        userGuid: "user-1",
        userName: "John Doe",
        email: "",
        cipherId: "cipher-1",
      };
      expect(isMemberDetails(invalidData)).toBe(false);
    });

    it("should return false for empty cipherId", () => {
      const invalidData = {
        userGuid: "user-1",
        userName: "John Doe",
        email: "john@example.com",
        cipherId: "",
      };
      expect(isMemberDetails(invalidData)).toBe(false);
    });

    it("should return false for prototype pollution attempts", () => {
      const invalidData = {
        userGuid: "user-1",
        userName: "John Doe",
        email: "john@example.com",
        cipherId: "cipher-1",
        __proto__: { malicious: "payload" },
      };
      expect(isMemberDetails(invalidData)).toBe(false);
    });
  });

  describe("isApplicationHealthReportDetail", () => {
    it("should return true for valid ApplicationHealthReportDetail", () => {
      const validData = {
        applicationName: "Test App",
        passwordCount: 10,
        atRiskPasswordCount: 2,
        atRiskCipherIds: ["cipher-1"],
        memberCount: 5,
        atRiskMemberCount: 1,
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher-1"],
      };
      expect(isApplicationHealthReportDetail(validData)).toBe(true);
    });

    it("should return false for empty applicationName", () => {
      const invalidData = {
        applicationName: "",
        passwordCount: 10,
        atRiskPasswordCount: 2,
        atRiskCipherIds: ["cipher-1"],
        memberCount: 5,
        atRiskMemberCount: 1,
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher-1"],
      };
      expect(isApplicationHealthReportDetail(invalidData)).toBe(false);
    });

    it("should return false for NaN passwordCount", () => {
      const invalidData = {
        applicationName: "Test App",
        passwordCount: NaN,
        atRiskPasswordCount: 2,
        atRiskCipherIds: ["cipher-1"],
        memberCount: 5,
        atRiskMemberCount: 1,
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher-1"],
      };
      expect(isApplicationHealthReportDetail(invalidData)).toBe(false);
    });

    it("should return false for Infinity passwordCount", () => {
      const invalidData = {
        applicationName: "Test App",
        passwordCount: Infinity,
        atRiskPasswordCount: 2,
        atRiskCipherIds: ["cipher-1"],
        memberCount: 5,
        atRiskMemberCount: 1,
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher-1"],
      };
      expect(isApplicationHealthReportDetail(invalidData)).toBe(false);
    });

    it("should return false for negative passwordCount", () => {
      const invalidData = {
        applicationName: "Test App",
        passwordCount: -5,
        atRiskPasswordCount: 2,
        atRiskCipherIds: ["cipher-1"],
        memberCount: 5,
        atRiskMemberCount: 1,
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher-1"],
      };
      expect(isApplicationHealthReportDetail(invalidData)).toBe(false);
    });

    it("should return false for negative memberCount", () => {
      const invalidData = {
        applicationName: "Test App",
        passwordCount: 10,
        atRiskPasswordCount: 2,
        atRiskCipherIds: ["cipher-1"],
        memberCount: -1,
        atRiskMemberCount: 1,
        memberDetails: [] as MemberDetails[],
        atRiskMemberDetails: [] as MemberDetails[],
        cipherIds: ["cipher-1"],
      };
      expect(isApplicationHealthReportDetail(invalidData)).toBe(false);
    });
  });

  describe("isOrganizationReportSummary", () => {
    it("should return true for valid OrganizationReportSummary", () => {
      const validData = {
        totalMemberCount: 10,
        totalApplicationCount: 5,
        totalAtRiskMemberCount: 2,
        totalAtRiskApplicationCount: 1,
        totalCriticalApplicationCount: 3,
        totalCriticalMemberCount: 4,
        totalCriticalAtRiskMemberCount: 1,
        totalCriticalAtRiskApplicationCount: 1,
      };
      expect(isOrganizationReportSummary(validData)).toBe(true);
    });

    it("should return false for NaN totalMemberCount", () => {
      const invalidData = {
        totalMemberCount: NaN,
        totalApplicationCount: 5,
        totalAtRiskMemberCount: 2,
        totalAtRiskApplicationCount: 1,
        totalCriticalApplicationCount: 3,
        totalCriticalMemberCount: 4,
        totalCriticalAtRiskMemberCount: 1,
        totalCriticalAtRiskApplicationCount: 1,
      };
      expect(isOrganizationReportSummary(invalidData)).toBe(false);
    });

    it("should return false for Infinity totalApplicationCount", () => {
      const invalidData = {
        totalMemberCount: 10,
        totalApplicationCount: Infinity,
        totalAtRiskMemberCount: 2,
        totalAtRiskApplicationCount: 1,
        totalCriticalApplicationCount: 3,
        totalCriticalMemberCount: 4,
        totalCriticalAtRiskMemberCount: 1,
        totalCriticalAtRiskApplicationCount: 1,
      };
      expect(isOrganizationReportSummary(invalidData)).toBe(false);
    });

    it("should return false for negative totalAtRiskMemberCount", () => {
      const invalidData = {
        totalMemberCount: 10,
        totalApplicationCount: 5,
        totalAtRiskMemberCount: -1,
        totalAtRiskApplicationCount: 1,
        totalCriticalApplicationCount: 3,
        totalCriticalMemberCount: 4,
        totalCriticalAtRiskMemberCount: 1,
        totalCriticalAtRiskApplicationCount: 1,
      };
      expect(isOrganizationReportSummary(invalidData)).toBe(false);
    });
  });

  describe("isOrganizationReportApplication", () => {
    it("should return true for valid OrganizationReportApplication", () => {
      const validData = {
        applicationName: "Test App",
        isCritical: true,
        reviewedDate: null as Date | null,
      };
      expect(isOrganizationReportApplication(validData)).toBe(true);
    });

    it("should return false for empty applicationName", () => {
      const invalidData = {
        applicationName: "",
        isCritical: true,
        reviewedDate: null as Date | null,
      };
      expect(isOrganizationReportApplication(invalidData)).toBe(false);
    });

    it("should return true for Date reviewedDate", () => {
      const validData = {
        applicationName: "Test App",
        isCritical: true,
        reviewedDate: new Date(),
      };
      expect(isOrganizationReportApplication(validData)).toBe(true);
    });

    it("should return true for string reviewedDate", () => {
      const validData = {
        applicationName: "Test App",
        isCritical: false,
        reviewedDate: "2024-01-01",
      };
      expect(isOrganizationReportApplication(validData)).toBe(true);
    });

    it("should return false for prototype pollution attempts via __proto__", () => {
      const invalidData = {
        applicationName: "Test App",
        isCritical: true,
        reviewedDate: null as Date | null,
        __proto__: { polluted: true },
      };
      expect(isOrganizationReportApplication(invalidData)).toBe(false);
    });
  });
});
