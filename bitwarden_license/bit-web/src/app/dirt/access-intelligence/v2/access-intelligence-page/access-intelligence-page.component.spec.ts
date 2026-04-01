import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { ActivatedRoute, Router } from "@angular/router";
import { BehaviorSubject, of, throwError } from "rxjs";

import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { ReportProgress } from "@bitwarden/bit-common/dirt/reports/risk-insights";
import {
  createApplication,
  createMemberRegistry,
  createReport,
  createRiskInsights,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService } from "@bitwarden/components";

import { RiskInsightsTabType } from "../../models/risk-insights.models";
import {
  AppAtRiskMembersData,
  CriticalAtRiskAppsData,
  CriticalAtRiskMembersData,
  OrgAtRiskAppsData,
  OrgAtRiskMembersData,
} from "../models/drawer-content-data.types";

import { AccessIntelligencePageComponent } from "./access-intelligence-page.component";

/**
 * Mock type for AccessIntelligenceDataService that uses BehaviorSubjects
 * instead of Observables so we can call .next() in tests
 */
type MockAccessIntelligenceDataService = {
  report$: BehaviorSubject<AccessReportView | null>;
  loading$: BehaviorSubject<boolean>;
  error$: BehaviorSubject<string | null>;
  reportProgress$: BehaviorSubject<ReportProgress | null>;
  initializeForOrganization$: jest.Mock;
  generateNewReport$: jest.Mock;
};

describe("AccessIntelligencePageComponent", () => {
  let component: AccessIntelligencePageComponent;
  let fixture: ComponentFixture<AccessIntelligencePageComponent>;
  let mockAccessIntelligenceService: MockAccessIntelligenceDataService;
  let mockDrawerStateService: jest.Mocked<DrawerStateService>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockLogService: jest.Mocked<LogService>;
  let mockRouter: jest.Mocked<Router>;
  let mockActivatedRoute: {
    paramMap: BehaviorSubject<any>;
    queryParams: BehaviorSubject<any>;
  };

  /**
   * Helper to access protected/private members for testing.
   * Angular components use protected/private for encapsulation, but tests need access to verify internal state.
   * Using type assertion is the recommended approach per Angular testing best practices.
   */
  const testAccess = (comp: AccessIntelligencePageComponent) => comp as any;

  const orgId = "org-123" as OrganizationId;
  const testReport = createRiskInsights({
    organizationId: orgId,
    reports: [
      createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
      createReport("gitlab.com", { u2: true, u3: false }, { c3: true, c4: false }),
    ],
    applications: [createApplication("github.com", true), createApplication("gitlab.com", false)],
    memberRegistry: createMemberRegistry([
      { id: "u1", name: "Alice", email: "alice@example.com" },
      { id: "u2", name: "Bob", email: "bob@example.com" },
      { id: "u3", name: "Charlie", email: "charlie@example.com" },
    ]),
  });

  beforeEach(async () => {
    // Create mock services
    mockAccessIntelligenceService = {
      report$: new BehaviorSubject<AccessReportView | null>(null),
      loading$: new BehaviorSubject<boolean>(false),
      error$: new BehaviorSubject<string | null>(null),
      reportProgress$: new BehaviorSubject<ReportProgress | null>(null),
      initializeForOrganization$: jest.fn(),
      generateNewReport$: jest.fn(),
    };

    mockDrawerStateService = {
      drawerState: jest.fn().mockReturnValue({ open: false, type: null, invokerId: "" }),
      openDrawer: jest.fn(),
      closeDrawer: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string, ...args: any[]) => key),
    } as any;

    mockDialogService = {
      openDrawer: jest.fn().mockReturnValue({ close: jest.fn() }),
    } as any;

    mockLogService = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockRouter = {
      navigate: jest.fn().mockResolvedValue(true),
    } as any;

    mockActivatedRoute = {
      paramMap: new BehaviorSubject(new Map([["organizationId", orgId]]) as any),
      queryParams: new BehaviorSubject({}),
    };

    await TestBed.configureTestingModule({
      imports: [AccessIntelligencePageComponent],
      providers: [
        { provide: AccessIntelligenceDataService, useValue: mockAccessIntelligenceService },
        { provide: DrawerStateService, useValue: mockDrawerStateService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: LogService, useValue: mockLogService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
      schemas: [NO_ERRORS_SCHEMA], // Ignore child component errors for unit testing
    })
      .overrideComponent(AccessIntelligencePageComponent, {
        set: { template: "", imports: [] },
      })
      .compileComponents();

    mockAccessIntelligenceService.initializeForOrganization$.mockReturnValue(of(undefined));

    fixture = TestBed.createComponent(AccessIntelligencePageComponent);
    component = fixture.componentInstance;
  });

  // ==================== Initialization Tests ====================

  describe("Initialization", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should initialize for organization on ngOnInit", async () => {
      await component.ngOnInit();

      expect(mockAccessIntelligenceService.initializeForOrganization$).toHaveBeenCalledWith(orgId);
      expect(testAccess(component).organizationId()).toBe(orgId);
    });

    it("should subscribe to report updates", async () => {
      mockAccessIntelligenceService.report$.next(testReport);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(testAccess(component).appsCount()).toBe(2);
      expect(testAccess(component).dataLastUpdated()).toEqual(testReport.creationDate);
    });

    it("should handle organization switching", async () => {
      const newOrgId = "org-456" as OrganizationId;

      await component.ngOnInit();

      // Switch organization
      mockActivatedRoute.paramMap.next(new Map([["organizationId", newOrgId]]) as any);

      expect(mockAccessIntelligenceService.initializeForOrganization$).toHaveBeenCalledWith(
        newOrgId,
      );
      expect(testAccess(component).organizationId()).toBe(newOrgId);
    });

    it("should set default tab from query params", async () => {
      mockActivatedRoute.queryParams.next({ tabIndex: RiskInsightsTabType.AllApps });

      await component.ngOnInit();

      expect(testAccess(component).tabIndex()).toBe(RiskInsightsTabType.AllApps);
    });

    it("should default to AllActivity tab when query param is invalid", async () => {
      mockActivatedRoute.queryParams.next({ tabIndex: "invalid" });

      await component.ngOnInit();

      expect(testAccess(component).tabIndex()).toBe(RiskInsightsTabType.AllActivity);
    });
  });

  // ==================== Report Loading Tests ====================

  describe("Report Loading", () => {
    it("should display loading state when loading$ emits true", async () => {
      mockAccessIntelligenceService.loading$.next(true);

      await component.ngOnInit();
      fixture.detectChanges();

      const loadingSignal = component["loading"];
      expect(loadingSignal).toBeTruthy();
    });

    it("should display report when V2 report loads successfully", async () => {
      mockAccessIntelligenceService.report$.next(testReport);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(testAccess(component).report()).toBe(testReport);
      expect(testAccess(component).hasReportData()).toBe(true);
    });

    it("should handle null report state", async () => {
      mockAccessIntelligenceService.report$.next(null);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(testAccess(component).report()).toBeNull();
      expect(testAccess(component).hasReportData()).toBe(false);
    });

    it("should handle report with no data", async () => {
      const emptyReport = createRiskInsights({ reports: [] });
      mockAccessIntelligenceService.report$.next(emptyReport);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(testAccess(component).hasReportData()).toBe(false);
    });

    it("should display error when error$ emits", async () => {
      const errorMessage = "Failed to load report";
      mockAccessIntelligenceService.error$.next(errorMessage);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(testAccess(component).error()).toBe(errorMessage);
    });
  });

  // ==================== Tab Navigation Tests ====================

  describe("Tab Navigation", () => {
    it("should update query params when tab changes", async () => {
      await component.ngOnInit();
      await testAccess(component).onTabChange(RiskInsightsTabType.AllApps);

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({
          queryParams: { tabIndex: RiskInsightsTabType.AllApps },
          queryParamsHandling: "merge",
        }),
      );
    });

    it("should close drawer when tab changes", async () => {
      await component.ngOnInit();
      await testAccess(component).onTabChange(RiskInsightsTabType.AllApps);

      expect(mockDrawerStateService.closeDrawer).toHaveBeenCalled();
    });

    it("should close current dialog when tab changes", async () => {
      const mockDialogRef = { close: jest.fn() };
      component["currentDialogRef"].set(mockDialogRef as any);

      await testAccess(component).onTabChange(RiskInsightsTabType.AllApps);

      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it("should sync tabIndex with query params on navigation", async () => {
      await component.ngOnInit();

      mockActivatedRoute.queryParams.next({ tabIndex: RiskInsightsTabType.AllApps });

      expect(testAccess(component).tabIndex()).toBe(RiskInsightsTabType.AllApps);
    });
  });

  // ==================== Drawer Content Derivation Tests ====================

  describe("Drawer Content Derivation", () => {
    beforeEach(async () => {
      testReport.recomputeSummary();
      mockAccessIntelligenceService.report$.next(testReport);
      await component.ngOnInit();
    });

    it("should derive AppAtRiskMembers content", () => {
      const content = component["getAppAtRiskMembersContent"](testReport, "github.com");

      expect(content).toBeDefined();
      expect((content as AppAtRiskMembersData).type).toBe(DrawerType.AppAtRiskMembers);
      expect((content as AppAtRiskMembersData).applicationName).toBe("github.com");
      expect((content as AppAtRiskMembersData).members).toHaveLength(1);
      expect((content as AppAtRiskMembersData).members[0].email).toBe("alice@example.com");
    });

    it("should return null for AppAtRiskMembers when app not found", () => {
      const content = component["getAppAtRiskMembersContent"](testReport, "nonexistent.com");

      expect(content).toBeNull();
    });

    it("should derive OrgAtRiskMembers content", () => {
      const content = component["getOrgAtRiskMembersContent"](testReport);

      expect(content).toBeDefined();
      expect((content as OrgAtRiskMembersData).type).toBe(DrawerType.OrgAtRiskMembers);
      expect((content as OrgAtRiskMembersData).members.length).toBeGreaterThan(0);
    });

    it("should derive OrgAtRiskApps content", () => {
      const content = component["getOrgAtRiskAppsContent"](testReport);

      expect(content).toBeDefined();
      expect((content as OrgAtRiskAppsData).type).toBe(DrawerType.OrgAtRiskApps);
      expect((content as OrgAtRiskAppsData).applications).toHaveLength(2); // Both apps have at-risk passwords
    });

    it("should derive CriticalAtRiskMembers content", () => {
      const content = component["getCriticalAtRiskMembersContent"](testReport);

      expect(content).toBeDefined();
      expect((content as CriticalAtRiskMembersData).type).toBe(DrawerType.CriticalAtRiskMembers);
      expect((content as CriticalAtRiskMembersData).members.length).toBeGreaterThan(0);
    });

    it("should derive CriticalAtRiskApps content", () => {
      const content = component["getCriticalAtRiskAppsContent"](testReport);

      expect(content).toBeDefined();
      expect((content as CriticalAtRiskAppsData).type).toBe(DrawerType.CriticalAtRiskApps);
      expect((content as CriticalAtRiskAppsData).applications).toHaveLength(1); // Only github.com is critical
      expect((content as CriticalAtRiskAppsData).applications[0].applicationName).toBe(
        "github.com",
      );
    });

    it("should use view model method for member password counts", () => {
      const content = component["getAppAtRiskMembersContent"](testReport, "github.com");

      expect((content as AppAtRiskMembersData).members[0].atRiskPasswordCount).toBeGreaterThan(0);
    });
  });

  // ==================== Empty State Tests ====================

  describe("Empty State", () => {
    it("should display empty state when no report data", async () => {
      mockAccessIntelligenceService.report$.next(null);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(testAccess(component).hasReportData()).toBe(false);
    });

    it("should provide benefit items for empty state", () => {
      expect(testAccess(component).emptyStateBenefits).toHaveLength(3);
      expect(testAccess(component).emptyStateBenefits[0]).toHaveLength(2); // [title, description]
    });

    it("should have video source for empty state", () => {
      expect(testAccess(component).emptyStateVideoSrc).toBeTruthy();
    });
  });

  // ==================== Report Generation Tests ====================

  describe("Report Generation", () => {
    it("should generate new report", async () => {
      mockAccessIntelligenceService.generateNewReport$.mockReturnValue(of(undefined));
      component["organizationId"].set(orgId);

      testAccess(component).generateReport();

      expect(mockAccessIntelligenceService.generateNewReport$).toHaveBeenCalledWith(orgId);
    });

    it("should log error when generation fails", async () => {
      const error = new Error("Generation failed");
      mockAccessIntelligenceService.generateNewReport$.mockReturnValue(throwError(() => error));
      component["organizationId"].set(orgId);

      testAccess(component).generateReport();

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockLogService.error).toHaveBeenCalledWith("Failed to generate report", error);
    });

    it("should not generate when no organization ID", () => {
      component["organizationId"].set("" as OrganizationId);

      testAccess(component).generateReport();

      expect(mockAccessIntelligenceService.generateNewReport$).not.toHaveBeenCalled();
    });

    it("should show FetchingMembers step immediately when progress emits", fakeAsync(() => {
      fixture = TestBed.createComponent(AccessIntelligencePageComponent);
      component = fixture.componentInstance;

      mockAccessIntelligenceService.reportProgress$.next(ReportProgress.FetchingMembers);
      tick();

      expect(testAccess(component).currentProgressStep()).toBe(ReportProgress.FetchingMembers);
    }));

    it("should delay intermediate progress steps", fakeAsync(() => {
      fixture = TestBed.createComponent(AccessIntelligencePageComponent);
      component = fixture.componentInstance;

      mockAccessIntelligenceService.reportProgress$.next(ReportProgress.AnalyzingPasswords);

      // Not yet visible (delayed)
      expect(testAccess(component).currentProgressStep()).toBeNull();

      tick(250);

      expect(testAccess(component).currentProgressStep()).toBe(ReportProgress.AnalyzingPasswords);
    }));

    it("should hide loader after Complete step", fakeAsync(() => {
      fixture = TestBed.createComponent(AccessIntelligencePageComponent);
      component = fixture.componentInstance;

      mockAccessIntelligenceService.reportProgress$.next(ReportProgress.Complete);
      tick(250); // Complete step shows
      expect(testAccess(component).currentProgressStep()).toBe(ReportProgress.Complete);

      tick(250); // Then null hides the loader
      expect(testAccess(component).currentProgressStep()).toBeNull();
    }));

    it("should start with null progress step", () => {
      expect(testAccess(component).currentProgressStep()).toBeNull();
    });
  });

  // ==================== Error Handling Tests ====================

  describe("Error Handling", () => {
    it("should display error state", async () => {
      const errorMessage = "Something went wrong";
      mockAccessIntelligenceService.error$.next(errorMessage);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(testAccess(component).error()).toBe(errorMessage);
    });

    it("should clear error on successful load", async () => {
      mockAccessIntelligenceService.error$.next("Error");
      await component.ngOnInit();

      mockAccessIntelligenceService.error$.next(null);
      fixture.detectChanges();

      expect(testAccess(component).error()).toBeNull();
    });
  });

  // ==================== Cleanup Tests ====================

  describe("Cleanup", () => {
    it("should close dialog on destroy", () => {
      const mockDialogRef = { close: jest.fn() };
      component["currentDialogRef"].set(mockDialogRef as any);

      component.ngOnDestroy();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });

    it("should close dialog when switching organizations", async () => {
      const mockDialogRef = { close: jest.fn() };
      component["currentDialogRef"].set(mockDialogRef as any);

      await component.ngOnInit();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
