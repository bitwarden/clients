import { NO_ERRORS_SCHEMA, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of, throwError } from "rxjs";

import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import {
  createApplication,
  createMemberRegistry,
  createReport,
  createRiskInsights,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, CipherId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

import { SecurityTasksService } from "../services/abstractions/security-tasks.service";

import { ApplicationsV2Component } from "./applications-v2.component";

/**
 * Mock type for AccessIntelligenceDataService — uses BehaviorSubjects so tests can call .next()
 */
type MockAccessIntelligenceDataService = {
  report$: BehaviorSubject<AccessReportView | null>;
  loading$: BehaviorSubject<boolean>;
  ciphers$: BehaviorSubject<CipherView[]>;
  markApplicationsAsCritical$: jest.Mock;
  unmarkApplicationsAsCritical$: jest.Mock;
};

/**
 * Mock type for AccessIntelligenceSecurityTasksService
 */
type MockSecurityTasksService = {
  unassignedCriticalCipherIds$: BehaviorSubject<CipherId[]>;
  requestPasswordChangeForCriticalApplications$: jest.Mock;
};

describe("ApplicationsV2Component", () => {
  let component: ApplicationsV2Component;
  let fixture: ComponentFixture<ApplicationsV2Component>;
  let mockDataService: MockAccessIntelligenceDataService;
  let mockDrawerStateService: jest.Mocked<DrawerStateService>;
  let mockSecurityTasksService: MockSecurityTasksService;
  let mockFileDownloadService: jest.Mocked<FileDownloadService>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockLogService: jest.Mocked<LogService>;

  /**
   * Helper to access protected/private members for testing.
   */
  const testAccess = (comp: ApplicationsV2Component) => comp as any;

  const orgId = "org-123" as OrganizationId;

  beforeEach(async () => {
    mockDataService = {
      report$: new BehaviorSubject<AccessReportView | null>(null),
      loading$: new BehaviorSubject<boolean>(false),
      ciphers$: new BehaviorSubject<CipherView[]>([]),
      markApplicationsAsCritical$: jest.fn().mockReturnValue(of(undefined)),
      unmarkApplicationsAsCritical$: jest.fn().mockReturnValue(of(undefined)),
    };

    mockDrawerStateService = {
      openDrawer: jest.fn(),
      closeDrawer: jest.fn(),
      drawerState: signal(null) as any,
    } as any;

    mockSecurityTasksService = {
      unassignedCriticalCipherIds$: new BehaviorSubject<CipherId[]>([]),
      requestPasswordChangeForCriticalApplications$: jest.fn().mockReturnValue(of(undefined)),
    };

    mockFileDownloadService = {
      download: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string) => key),
    } as any;

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockLogService = {
      error: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ApplicationsV2Component],
      providers: [
        { provide: AccessIntelligenceDataService, useValue: mockDataService },
        { provide: DrawerStateService, useValue: mockDrawerStateService },
        { provide: SecurityTasksService, useValue: mockSecurityTasksService },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Strip template + imports to keep unit tests fast and focused on component logic.
      // Template rendering is not the test focus here.
      .overrideComponent(ApplicationsV2Component, {
        set: { template: "", imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ApplicationsV2Component);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("organizationId", orgId);
  });

  // ==================== Initialization ====================

  describe("Initialization", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should accept organizationId input", () => {
      expect(component.organizationId()).toBe(orgId);
    });
  });

  // ==================== Observable → Signal Conversions ====================

  describe("Observable → Signal Conversions", () => {
    it("should convert report$ to signal via toSignal()", () => {
      const testReport = createRiskInsights({
        reports: [createReport("github.com", {}, {})],
      });

      mockDataService.report$.next(testReport);

      expect(testAccess(component).report()).toBe(testReport);
    });

    it("should convert loading$ to signal", () => {
      mockDataService.loading$.next(true);
      expect(testAccess(component).loading()).toBe(true);

      mockDataService.loading$.next(false);
      expect(testAccess(component).loading()).toBe(false);
    });

    it("should convert ciphers$ to signal", () => {
      const cipher = new CipherView();
      cipher.id = "cipher-1";
      mockDataService.ciphers$.next([cipher]);

      expect(testAccess(component).ciphers()).toHaveLength(1);
      expect(testAccess(component).ciphers()[0].id).toBe("cipher-1");
    });
  });

  // ==================== Computed Signals ====================

  describe("Computed Signals", () => {
    it("should compute criticalApplicationsCount from report", () => {
      const testReport = createRiskInsights({
        reports: [
          createReport("github.com", {}, {}),
          createReport("gitlab.com", {}, {}),
          createReport("bitbucket.com", {}, {}),
        ],
        applications: [
          createApplication("github.com", true), // Critical
          createApplication("gitlab.com", false), // Not critical
          createApplication("bitbucket.com", true), // Critical
        ],
        memberRegistry: createMemberRegistry([]),
      });

      mockDataService.report$.next(testReport);

      expect(testAccess(component).criticalApplicationsCount()).toBe(2);
    });

    it("should compute totalApplicationsCount from report.reports.length", () => {
      const testReport = createRiskInsights({
        reports: [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})],
      });

      mockDataService.report$.next(testReport);

      expect(testAccess(component).totalApplicationsCount()).toBe(2);
    });

    it("should compute nonCriticalApplicationsCount = total - critical", () => {
      const testReport = createRiskInsights({
        reports: [
          createReport("github.com", {}, {}),
          createReport("gitlab.com", {}, {}),
          createReport("bitbucket.com", {}, {}),
        ],
        applications: [
          createApplication("github.com", true),
          createApplication("gitlab.com", false),
          createApplication("bitbucket.com", false),
        ],
        memberRegistry: createMemberRegistry([]),
      });

      mockDataService.report$.next(testReport);

      expect(testAccess(component).nonCriticalApplicationsCount()).toBe(2);
    });

    it("should compute enableRequestPasswordChange as true when unassigned ciphers exist", () => {
      expect(testAccess(component).enableRequestPasswordChange()).toBe(false);

      mockSecurityTasksService.unassignedCriticalCipherIds$.next([
        "cipher-1" as CipherId,
        "cipher-2" as CipherId,
      ]);

      expect(testAccess(component).enableRequestPasswordChange()).toBe(true);
    });

    it("should return 0 counts when report is null", () => {
      mockDataService.report$.next(null);

      expect(testAccess(component).criticalApplicationsCount()).toBe(0);
      expect(testAccess(component).totalApplicationsCount()).toBe(0);
      expect(testAccess(component).nonCriticalApplicationsCount()).toBe(0);
    });
  });

  // ==================== markAppsAsCritical ====================

  describe("markAppsAsCritical()", () => {
    it("should call markApplicationsAsCritical$ once with all selected URLs", async () => {
      testAccess(component).selectedUrls.set(new Set(["github.com", "gitlab.com"]));

      await component.markAppsAsCritical();

      expect(mockDataService.markApplicationsAsCritical$).toHaveBeenCalledTimes(1);
      expect(mockDataService.markApplicationsAsCritical$).toHaveBeenCalledWith(
        expect.arrayContaining(["github.com", "gitlab.com"]),
      );
    });

    it("should show success toast on completion", async () => {
      testAccess(component).selectedUrls.set(new Set(["github.com"]));

      await component.markAppsAsCritical();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("should clear selectedUrls after marking", async () => {
      testAccess(component).selectedUrls.set(new Set(["github.com"]));

      await component.markAppsAsCritical();

      expect(testAccess(component).selectedUrls().size).toBe(0);
    });

    it("should show error toast when service call fails", async () => {
      testAccess(component).selectedUrls.set(new Set(["github.com"]));
      mockDataService.markApplicationsAsCritical$.mockReturnValue(
        throwError(() => new Error("fail")),
      );

      await component.markAppsAsCritical();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error" }),
      );
    });
  });

  // ==================== unmarkAppsAsCritical ====================

  describe("unmarkAppsAsCritical()", () => {
    it("should call unmarkApplicationsAsCritical$ once with all selected URLs", async () => {
      testAccess(component).selectedUrls.set(new Set(["github.com", "gitlab.com"]));

      await component.unmarkAppsAsCritical();

      expect(mockDataService.unmarkApplicationsAsCritical$).toHaveBeenCalledTimes(1);
      expect(mockDataService.unmarkApplicationsAsCritical$).toHaveBeenCalledWith(
        expect.arrayContaining(["github.com", "gitlab.com"]),
      );
    });

    it("should show success toast on completion", async () => {
      testAccess(component).selectedUrls.set(new Set(["github.com"]));

      await component.unmarkAppsAsCritical();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("should clear selectedUrls after unmarking", async () => {
      testAccess(component).selectedUrls.set(new Set(["github.com"]));

      await component.unmarkAppsAsCritical();

      expect(testAccess(component).selectedUrls().size).toBe(0);
    });
  });

  // ==================== requestPasswordChange ====================

  describe("requestPasswordChange()", () => {
    it("should call requestPasswordChangeForCriticalApplications with orgId", async () => {
      mockSecurityTasksService.unassignedCriticalCipherIds$.next(["cipher-1" as CipherId]);

      await component.requestPasswordChange();

      expect(
        mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
      ).toHaveBeenCalledWith(orgId, expect.arrayContaining(["cipher-1"]));
    });

    it("should show success toast on completion", async () => {
      await component.requestPasswordChange();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });
  });

  // ==================== showAppAtRiskMembers ====================

  describe("showAppAtRiskMembers()", () => {
    it("should call drawerStateService.openDrawer with AppAtRiskMembers type and app name", async () => {
      await component.showAppAtRiskMembers("github.com");

      expect(mockDrawerStateService.openDrawer).toHaveBeenCalledWith(
        DrawerType.AppAtRiskMembers,
        "github.com",
      );
    });
  });

  // ==================== downloadApplicationsCSV ====================

  describe("downloadApplicationsCSV()", () => {
    it("should call FileDownloadService.download with CSV when dataSource has data", () => {
      // Populate dataSource.data directly (bypasses the debounced subscription)
      testAccess(component).dataSource.data = [
        {
          applicationName: "github.com",
          atRiskPasswordCount: 5,
          passwordCount: 10,
          atRiskMemberCount: 2,
          memberCount: 8,
          isMarkedAsCritical: false,
        },
      ];

      component.downloadApplicationsCSV();

      expect(mockFileDownloadService.download).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: expect.stringContaining("applications"),
          blobData: expect.stringContaining("github.com"),
          blobOptions: { type: "text/plain" },
        }),
      );
    });

    it("should NOT call download when dataSource is empty", () => {
      testAccess(component).dataSource.data = [];

      component.downloadApplicationsCSV();

      expect(mockFileDownloadService.download).not.toHaveBeenCalled();
    });
  });

  // ==================== onCheckboxChange ====================

  describe("onCheckboxChange()", () => {
    it("should add app to selectedUrls when checkbox is checked", () => {
      component.onCheckboxChange({ applicationName: "github.com", checked: true });

      expect(testAccess(component).selectedUrls().has("github.com")).toBe(true);
    });

    it("should remove app from selectedUrls when checkbox is unchecked", () => {
      testAccess(component).selectedUrls.set(new Set(["github.com"]));

      component.onCheckboxChange({ applicationName: "github.com", checked: false });

      expect(testAccess(component).selectedUrls().has("github.com")).toBe(false);
    });
  });
});
