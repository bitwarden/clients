import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { DrawerType } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import {
  DrawerApplicationData,
  DrawerContentData,
  DrawerMemberData,
} from "../../models/drawer-content-data.types";

import { AccessIntelligenceDrawerV2Component } from "./access-intelligence-drawer-v2.component";

describe("AccessIntelligenceDrawerV2Component", () => {
  let component: AccessIntelligenceDrawerV2Component;
  let fixture: ComponentFixture<AccessIntelligenceDrawerV2Component>;
  let mockFileDownloadService: jest.Mocked<FileDownloadService>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockLogService: jest.Mocked<LogService>;

  /**
   * Helper to access protected members for testing.
   */
  const testAccess = (comp: AccessIntelligenceDrawerV2Component) => comp as any;

  /** Sample members used in drawer data */
  const sampleMembers: DrawerMemberData[] = [
    { email: "alice@example.com", userName: "Alice Smith", userGuid: "u1", atRiskPasswordCount: 5 },
    { email: "bob@example.com", userName: "Bob Jones", userGuid: "u2", atRiskPasswordCount: 3 },
  ];

  /** Sample applications used in drawer data */
  const sampleApplications: DrawerApplicationData[] = [
    { applicationName: "github.com", atRiskPasswordCount: 10 },
    { applicationName: "gitlab.com", atRiskPasswordCount: 4 },
  ];

  /** Default DIALOG_DATA used unless overridden via testAccess */
  const defaultDrawerData: DrawerContentData = {
    type: DrawerType.OrgAtRiskMembers,
    members: sampleMembers,
  };

  beforeEach(async () => {
    mockFileDownloadService = {
      download: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string) => key),
    } as any;

    mockLogService = {
      error: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [AccessIntelligenceDrawerV2Component],
      providers: [
        { provide: DIALOG_DATA, useValue: defaultDrawerData },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Strip template + imports: tests cover logic only, not template rendering.
      // SharedModule has complex DI and is not needed for method tests.
      .overrideComponent(AccessIntelligenceDrawerV2Component, {
        set: { template: "", imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AccessIntelligenceDrawerV2Component);
    component = fixture.componentInstance;
  });

  // ==================== Component Creation ====================

  describe("Initialization", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should expose DrawerType enum to template", () => {
      expect(testAccess(component).DrawerType).toBe(DrawerType);
    });

    it("should inject DIALOG_DATA as data", () => {
      expect(testAccess(component).data).toBe(defaultDrawerData);
    });
  });

  // ==================== downloadAtRiskMembers ====================

  describe("downloadAtRiskMembers()", () => {
    it("should call FileDownloadService.download for OrgAtRiskMembers drawer type", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskMembers,
        members: sampleMembers,
      };

      component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).toHaveBeenCalledTimes(1);
      expect(mockFileDownloadService.download).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining("at-risk-members"),
          blobData: expect.any(String),
          blobOptions: { type: "text/plain" },
        }),
      );
    });

    it("should call FileDownloadService.download for CriticalAtRiskMembers drawer type", () => {
      testAccess(component).data = {
        type: DrawerType.CriticalAtRiskMembers,
        members: sampleMembers,
      };

      component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).toHaveBeenCalledTimes(1);
    });

    it("should include member data in CSV output", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskMembers,
        members: sampleMembers,
      };

      component.downloadAtRiskMembers();

      const callArg = mockFileDownloadService.download.mock.calls[0][0];
      expect(callArg.blobData).toContain("alice@example.com");
      expect(callArg.blobData).toContain("bob@example.com");
    });

    it("should NOT call download for OrgAtRiskApps drawer type (wrong type guard)", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskApps,
        applications: sampleApplications,
      };

      component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should NOT call download for AppAtRiskMembers drawer type (wrong type guard)", () => {
      testAccess(component).data = {
        type: DrawerType.AppAtRiskMembers,
        applicationName: "github.com",
        members: sampleMembers,
      };

      component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should NOT call download when members array is empty", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskMembers,
        members: [],
      };

      component.downloadAtRiskMembers();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should log error and not throw when download fails", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskMembers,
        members: sampleMembers,
      };
      const downloadError = new Error("Download failed");
      mockFileDownloadService.download.mockImplementation(() => {
        throw downloadError;
      });

      expect(() => component.downloadAtRiskMembers()).not.toThrow();
      expect(mockLogService.error).toHaveBeenCalledWith(
        expect.stringContaining("at-risk members"),
        downloadError,
      );
    });
  });

  // ==================== downloadAtRiskApplications ====================

  describe("downloadAtRiskApplications()", () => {
    it("should call FileDownloadService.download for OrgAtRiskApps drawer type", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskApps,
        applications: sampleApplications,
      };

      component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).toHaveBeenCalledTimes(1);
      expect(mockFileDownloadService.download).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining("at-risk-applications"),
          blobData: expect.any(String),
          blobOptions: { type: "text/plain" },
        }),
      );
    });

    it("should call FileDownloadService.download for CriticalAtRiskApps drawer type", () => {
      testAccess(component).data = {
        type: DrawerType.CriticalAtRiskApps,
        applications: sampleApplications,
      };

      component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).toHaveBeenCalledTimes(1);
    });

    it("should include application data in CSV output", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskApps,
        applications: sampleApplications,
      };

      component.downloadAtRiskApplications();

      const callArg = mockFileDownloadService.download.mock.calls[0][0];
      expect(callArg.blobData).toContain("github.com");
      expect(callArg.blobData).toContain("gitlab.com");
    });

    it("should NOT call download for OrgAtRiskMembers drawer type (wrong type guard)", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskMembers,
        members: sampleMembers,
      };

      component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should NOT call download when applications array is empty", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskApps,
        applications: [],
      };

      component.downloadAtRiskApplications();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });

    it("should log error and not throw when download fails", () => {
      testAccess(component).data = {
        type: DrawerType.OrgAtRiskApps,
        applications: sampleApplications,
      };
      const downloadError = new Error("Download failed");
      mockFileDownloadService.download.mockImplementation(() => {
        throw downloadError;
      });

      expect(() => component.downloadAtRiskApplications()).not.toThrow();
      expect(mockLogService.error).toHaveBeenCalledWith(
        expect.stringContaining("at-risk applications"),
        downloadError,
      );
    });
  });
});
