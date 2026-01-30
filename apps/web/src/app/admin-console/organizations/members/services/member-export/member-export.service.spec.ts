import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { UserTypePipe } from "@bitwarden/angular/pipes/user-type.pipe";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/logging";

import { OrganizationUserView } from "../../../core";
import { UserStatusPipe } from "../../pipes";

import { MemberExportService } from "./member-export.service";

describe("MemberExportService", () => {
  let service: MemberExportService;
  let i18nService: MockProxy<I18nService>;
  let fileDownloadService: MockProxy<FileDownloadService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    i18nService = mock<I18nService>();
    fileDownloadService = mock<FileDownloadService>();
    logService = mock<LogService>();

    // Setup common i18n translations
    i18nService.t.mockImplementation((key: string) => {
      const translations: Record<string, string> = {
        // Column headers
        email: "Email",
        name: "Name",
        status: "Status",
        role: "Role",
        twoStepLogin: "Two-step Login",
        accountRecovery: "Account Recovery",
        secretsManager: "Secrets Manager",
        groups: "Groups",
        // Status values
        invited: "Invited",
        accepted: "Accepted",
        confirmed: "Confirmed",
        revoked: "Revoked",
        // Role values
        owner: "Owner",
        admin: "Admin",
        user: "User",
        custom: "Custom",
        // Boolean states
        enabled: "Enabled",
        optionEnabled: "Enabled",
        disabled: "Disabled",
        enrolled: "Enrolled",
        notEnrolled: "Not Enrolled",
        // Error messages
        noMembersToExport: "No members to export",
      };
      return translations[key] || key;
    });

    TestBed.configureTestingModule({
      providers: [
        MemberExportService,
        { provide: FileDownloadService, useValue: fileDownloadService },
        { provide: LogService, useValue: logService },
        { provide: I18nService, useValue: i18nService },
        UserTypePipe,
        UserStatusPipe,
      ],
    });

    service = TestBed.inject(MemberExportService);
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

      const result = service.getMemberExport(members);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(fileDownloadService.download).toHaveBeenCalledTimes(1);

      const downloadCall = fileDownloadService.download.mock.calls[0][0];
      expect(downloadCall.fileName).toContain("org-members");
      expect(downloadCall.fileName).toContain(".csv");
      expect(downloadCall.blobOptions).toEqual({ type: "text/plain" });

      const csvData = downloadCall.blobData as string;
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

      const result = service.getMemberExport(members);

      expect(result.success).toBe(true);
      expect(fileDownloadService.download).toHaveBeenCalled();

      const csvData = fileDownloadService.download.mock.calls[0][0].blobData as string;
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

      const result = service.getMemberExport(members);

      expect(result.success).toBe(true);
      expect(fileDownloadService.download).toHaveBeenCalled();

      const csvData = fileDownloadService.download.mock.calls[0][0].blobData as string;
      expect(csvData).toContain("user@example.com");
      expect(csvData).toBeDefined();
    });

    it("should handle empty members array", () => {
      const result = service.getMemberExport([]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe("No members to export");
      expect(fileDownloadService.download).not.toHaveBeenCalled();
    });
  });
});
