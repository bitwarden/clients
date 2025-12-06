import { MockProxy, mock } from "jest-mock-extended";

import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { OrganizationUserView } from "../../core/views/organization-user.view";

import { MemberExportService } from "./member-export.service";

describe("MemberExportService", () => {
  let service: MemberExportService;
  let i18nService: MockProxy<I18nService>;

  beforeEach(() => {
    i18nService = mock<I18nService>();

    // Setup common i18n translations
    i18nService.t.mockImplementation((key: string) => {
      const translations: Record<string, string> = {
        invited: "Invited",
        accepted: "Accepted",
        confirmed: "Confirmed",
        revoked: "Revoked",
        owner: "Owner",
        admin: "Admin",
        user: "User",
        custom: "Custom",
        enabled: "Enabled",
        disabled: "Disabled",
        enrolled: "Enrolled",
        notEnrolled: "Not Enrolled",
      };
      return translations[key] || key;
    });

    service = new MemberExportService(i18nService);
  });

  describe("getMemberExport", () => {
    it("should export members with all fields populated", () => {
      const members: OrganizationUserView[] = [
        {
          email: "user1@example.com",
          name: "User One",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.Admin,
          twoFactorEnabled: true,
          resetPasswordEnrolled: true,
          accessSecretsManager: true,
          groupNames: ["Group A", "Group B"],
        } as OrganizationUserView,
        {
          email: "user2@example.com",
          name: "User Two",
          status: OrganizationUserStatusType.Invited,
          type: OrganizationUserType.User,
          twoFactorEnabled: false,
          resetPasswordEnrolled: false,
          accessSecretsManager: false,
          groupNames: ["Group C"],
        } as OrganizationUserView,
      ];

      const csvData = service.getMemberExport(members);

      expect(csvData).toContain("Email,Name,Status,Role,Two-step Login,Account Recovery");
      expect(csvData).toContain("user1@example.com");
      expect(csvData).toContain("User One");
      expect(csvData).toContain("Confirmed");
      expect(csvData).toContain("Admin");
      expect(csvData).toContain("user2@example.com");
      expect(csvData).toContain("User Two");
      expect(csvData).toContain("Invited");
    });

    it("should handle members with null name", () => {
      const members: OrganizationUserView[] = [
        {
          email: "user@example.com",
          name: null,
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.User,
          twoFactorEnabled: false,
          resetPasswordEnrolled: false,
          accessSecretsManager: false,
          groupNames: [],
        } as OrganizationUserView,
      ];

      const csvData = service.getMemberExport(members);

      expect(csvData).toContain("user@example.com");
      // Empty name is represented as an empty field in CSV
      expect(csvData).toContain("user@example.com,,Confirmed");
    });

    it("should handle members with no groups", () => {
      const members: OrganizationUserView[] = [
        {
          email: "user@example.com",
          name: "User",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.User,
          twoFactorEnabled: false,
          resetPasswordEnrolled: false,
          accessSecretsManager: false,
          groupNames: null,
        } as OrganizationUserView,
      ];

      const csvData = service.getMemberExport(members);

      expect(csvData).toContain("user@example.com");
      expect(csvData).toBeDefined();
    });

    it("should export all status types correctly", () => {
      const members: OrganizationUserView[] = [
        {
          email: "invited@example.com",
          status: OrganizationUserStatusType.Invited,
          type: OrganizationUserType.User,
        } as OrganizationUserView,
        {
          email: "accepted@example.com",
          status: OrganizationUserStatusType.Accepted,
          type: OrganizationUserType.User,
        } as OrganizationUserView,
        {
          email: "confirmed@example.com",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.User,
        } as OrganizationUserView,
        {
          email: "revoked@example.com",
          status: OrganizationUserStatusType.Revoked,
          type: OrganizationUserType.User,
        } as OrganizationUserView,
      ];

      const csvData = service.getMemberExport(members);

      expect(csvData).toContain("Invited");
      expect(csvData).toContain("Accepted");
      expect(csvData).toContain("Confirmed");
      expect(csvData).toContain("Revoked");
    });

    it("should export all role types correctly", () => {
      const members: OrganizationUserView[] = [
        {
          email: "owner@example.com",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.Owner,
        } as OrganizationUserView,
        {
          email: "admin@example.com",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.Admin,
        } as OrganizationUserView,
        {
          email: "user@example.com",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.User,
        } as OrganizationUserView,
        {
          email: "custom@example.com",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.Custom,
        } as OrganizationUserView,
      ];

      const csvData = service.getMemberExport(members);

      expect(csvData).toContain("Owner");
      expect(csvData).toContain("Admin");
      expect(csvData).toContain("User");
      expect(csvData).toContain("Custom");
    });

    it("should handle empty members array", () => {
      const csvData = service.getMemberExport([]);

      // When array is empty, papaparse returns an empty string
      expect(csvData).toBe("");
    });

    it("should format groups as comma-separated list", () => {
      const members: OrganizationUserView[] = [
        {
          email: "user@example.com",
          name: "User",
          status: OrganizationUserStatusType.Confirmed,
          type: OrganizationUserType.User,
          twoFactorEnabled: false,
          resetPasswordEnrolled: false,
          accessSecretsManager: false,
          groupNames: ["Engineering", "Design", "Product"],
        } as OrganizationUserView,
      ];

      const csvData = service.getMemberExport(members);

      expect(csvData).toContain("Engineering, Design, Product");
    });
  });

  describe("getFileName", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-03-15T14:30:45"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should generate filename with prefix and timestamp", () => {
      const fileName = service.getFileName("org-members");

      expect(fileName).toBe("bitwarden_org-members_export_20250315143045.csv");
    });

    it("should generate filename without prefix when null", () => {
      const fileName = service.getFileName(null);

      expect(fileName).toBe("bitwarden_export_20250315143045.csv");
    });

    it("should generate filename with custom extension", () => {
      const fileName = service.getFileName("test", "txt");

      expect(fileName).toBe("bitwarden_test_export_20250315143045.txt");
    });

    it("should pad single digit date components", () => {
      jest.setSystemTime(new Date("2025-01-05T08:07:06"));

      const fileName = service.getFileName("members");

      expect(fileName).toBe("bitwarden_members_export_20250105080706.csv");
    });

    it("should use default csv extension when not specified", () => {
      const fileName = service.getFileName("members");

      expect(fileName).toContain(".csv");
    });
  });
});
