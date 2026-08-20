import { NO_ERRORS_SCHEMA, signal } from "@angular/core";
import { ComponentFixture, TestBed, fakeAsync, tick } from "@angular/core/testing";
import { Router } from "@angular/router";
import { BehaviorSubject, of, throwError } from "rxjs";

import {
  AccessIntelligenceDataService,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import {
  createApplication,
  createReport,
  createRiskInsights,
  createRiskInsightsSummary,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { ToastService } from "@bitwarden/components";

import { RiskInsightsTabType } from "../../models/risk-insights.models";
import { AccessIntelligenceCoachmarkService } from "../../onboarding/access-intelligence-coachmark.service";
import { AccessSecurityTasksService } from "../services/abstractions/access-security-tasks.service";

import { CriticalApplicationsTabComponent } from "./critical-applications-tab.component";

/**
 * Mock type for AccessIntelligenceDataService — uses BehaviorSubjects so tests can call .next()
 */
type MockAccessIntelligenceDataService = {
  report$: BehaviorSubject<AccessReportView | null>;
  loading$: BehaviorSubject<boolean>;
  ciphers$: BehaviorSubject<CipherView[]>;
  unmarkApplicationsAsCritical$: jest.Mock;
};

/**
 * Mock type for AccessSecurityTasksService
 */
type MockSecurityTasksService = {
  unassignedCriticalCipherIds$: BehaviorSubject<string[]>;
  requestPasswordChangeForCriticalApplications$: jest.Mock;
};

describe("CriticalApplicationsTabComponent", () => {
  let component: CriticalApplicationsTabComponent;
  let fixture: ComponentFixture<CriticalApplicationsTabComponent>;
  let mockDataService: MockAccessIntelligenceDataService;
  let mockDrawerStateService: jest.Mocked<DrawerStateService>;
  let mockSecurityTasksService: MockSecurityTasksService;
  let mockCoachmarkService: { activeStepId: ReturnType<typeof signal<string | null>> };
  let mockI18nService: jest.Mocked<I18nService>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockRouter: jest.Mocked<Router>;

  /**
   * Helper to access protected/private members for testing.
   */
  const testAccess = (comp: CriticalApplicationsTabComponent) => comp as any;

  const orgId = "org-123" as OrganizationId;

  /**
   * Builds a report where `github.com` is critical and `gitlab.com` is not.
   * Both applications carry one member and one cipher so the row mapping is observable.
   */
  const createMixedCriticalityReport = () =>
    createRiskInsights({
      reports: [
        createReport("github.com", { "member-1": true }, { "cipher-1": true }),
        createReport("gitlab.com", { "member-2": false }, { "cipher-2": false }),
      ],
      applications: [createApplication("github.com", true), createApplication("gitlab.com", false)],
    });

  const createCipher = (id: string) => {
    const cipher = new CipherView();
    cipher.id = id;
    return cipher;
  };

  beforeEach(async () => {
    mockDataService = {
      report$: new BehaviorSubject<AccessReportView | null>(null),
      loading$: new BehaviorSubject<boolean>(false),
      ciphers$: new BehaviorSubject<CipherView[]>([]),
      unmarkApplicationsAsCritical$: jest.fn().mockReturnValue(of(undefined)),
    };

    mockDrawerStateService = {
      toggleDrawer: jest.fn(),
      closeDrawer: jest.fn(),
      drawerState: signal(null) as any,
    } as any;

    mockSecurityTasksService = {
      unassignedCriticalCipherIds$: new BehaviorSubject<string[]>([]),
      requestPasswordChangeForCriticalApplications$: jest.fn().mockReturnValue(of(undefined)),
    };

    mockCoachmarkService = {
      activeStepId: signal<string | null>(null),
    };

    mockI18nService = {
      t: jest.fn((key: string) => key),
    } as any;

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockRouter = {
      navigate: jest.fn().mockResolvedValue(true),
    } as any;

    await TestBed.configureTestingModule({
      imports: [CriticalApplicationsTabComponent],
      providers: [
        { provide: AccessIntelligenceDataService, useValue: mockDataService },
        { provide: DrawerStateService, useValue: mockDrawerStateService },
        { provide: AccessSecurityTasksService, useValue: mockSecurityTasksService },
        { provide: AccessIntelligenceCoachmarkService, useValue: mockCoachmarkService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: Router, useValue: mockRouter },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // Strip template + imports to keep unit tests fast and focused on component logic.
      // Template rendering is not the test focus here.
      .overrideComponent(CriticalApplicationsTabComponent, {
        set: { template: "", imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CriticalApplicationsTabComponent);
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

    it("should start with an empty data source when no report is loaded", () => {
      expect(testAccess(component).dataSource.data).toEqual([]);
    });
  });

  // ==================== Observable → Signal Conversions ====================

  describe("Observable → Signal Conversions", () => {
    it("should convert report$ to signal via toSignal()", () => {
      const testReport = createMixedCriticalityReport();

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
      mockDataService.ciphers$.next([createCipher("cipher-1")]);

      expect(testAccess(component).ciphers()).toHaveLength(1);
      expect(testAccess(component).ciphers()[0].id).toBe("cipher-1");
    });

    it("should convert unassignedCriticalCipherIds$ to signal", () => {
      mockSecurityTasksService.unassignedCriticalCipherIds$.next(["cipher-1", "cipher-2"]);

      expect(testAccess(component).unassignedCipherIds()).toEqual(["cipher-1", "cipher-2"]);
    });
  });

  // ==================== Computed Signals ====================

  describe("Computed Signals", () => {
    it("should enable request password change when critical at-risk members exist", () => {
      mockDataService.report$.next(
        createRiskInsights({
          summary: createRiskInsightsSummary({ totalCriticalAtRiskMemberCount: 3 }),
        }),
      );

      expect(testAccess(component).enableRequestPasswordChange()).toBe(true);
    });

    it("should ignore org-wide at-risk members that are not critical", () => {
      mockDataService.report$.next(
        createRiskInsights({
          summary: createRiskInsightsSummary({
            totalAtRiskMemberCount: 25,
            totalCriticalAtRiskMemberCount: 0,
          }),
        }),
      );

      expect(testAccess(component).enableRequestPasswordChange()).toBe(false);
    });

    it("should disable request password change when there are no at-risk members", () => {
      mockDataService.report$.next(
        createRiskInsights({
          summary: createRiskInsightsSummary({ totalCriticalAtRiskMemberCount: 0 }),
        }),
      );

      expect(testAccess(component).enableRequestPasswordChange()).toBe(false);
    });

    it("should disable request password change when report is null", () => {
      mockDataService.report$.next(null);

      expect(testAccess(component).enableRequestPasswordChange()).toBe(false);
    });

    it("should map applicationSummary from the report's critical counts", () => {
      mockDataService.report$.next(
        createRiskInsights({
          summary: createRiskInsightsSummary({
            totalCriticalAtRiskMemberCount: 4,
            totalCriticalMemberCount: 10,
            totalCriticalAtRiskApplicationCount: 2,
            totalCriticalApplicationCount: 5,
            // Non-critical counts must be ignored by this tab.
            totalAtRiskMemberCount: 99,
            totalApplicationCount: 99,
          }),
        }),
      );

      expect(testAccess(component).applicationSummary()).toEqual({
        totalAtRiskMemberCount: 4,
        totalMemberCount: 10,
        totalAtRiskApplicationCount: 2,
        totalApplicationCount: 5,
      });
    });

    it("should return null applicationSummary when report is null", () => {
      mockDataService.report$.next(null);

      expect(testAccess(component).applicationSummary()).toBeNull();
    });

    it("should open the helpMembers coachmark only for the matching step id", () => {
      expect(testAccess(component).helpMembersOpen()).toBe(false);

      mockCoachmarkService.activeStepId.set("helpMembers");
      expect(testAccess(component).helpMembersOpen()).toBe(true);

      mockCoachmarkService.activeStepId.set("someOtherStep");
      expect(testAccess(component).helpMembersOpen()).toBe(false);
    });
  });

  // ==================== Table Data ====================

  describe("Table data", () => {
    it("should include only applications marked as critical", () => {
      mockDataService.report$.next(createMixedCriticalityReport());

      const rows = testAccess(component).dataSource.data;
      expect(rows).toHaveLength(1);
      expect(rows[0].applicationName).toBe("github.com");
    });

    it("should exclude applications with no metadata entry", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("orphan.com", {}, {})],
          applications: [],
        }),
      );

      expect(testAccess(component).dataSource.data).toEqual([]);
    });

    it("should map report counts onto the table row and force isMarkedAsCritical", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [
            createReport(
              "github.com",
              { "member-1": true, "member-2": false },
              { "cipher-1": true, "cipher-2": false },
            ),
          ],
          applications: [createApplication("github.com", true)],
        }),
      );

      expect(testAccess(component).dataSource.data[0]).toEqual(
        expect.objectContaining({
          applicationName: "github.com",
          passwordCount: 2,
          atRiskPasswordCount: 1,
          memberCount: 2,
          atRiskMemberCount: 1,
          isMarkedAsCritical: true,
        }),
      );
    });

    it("should resolve the icon cipher from ciphers$", () => {
      const cipher = createCipher("cipher-1");
      mockDataService.ciphers$.next([cipher]);
      mockDataService.report$.next(createMixedCriticalityReport());

      expect(testAccess(component).dataSource.data[0].iconCipher).toBe(cipher);
    });

    it("should leave iconCipher undefined when no cipher matches", () => {
      mockDataService.ciphers$.next([createCipher("some-other-cipher")]);
      mockDataService.report$.next(createMixedCriticalityReport());

      expect(testAccess(component).dataSource.data[0].iconCipher).toBeUndefined();
    });

    it("should rebuild rows when ciphers$ emits after the report", () => {
      mockDataService.report$.next(createMixedCriticalityReport());
      expect(testAccess(component).dataSource.data[0].iconCipher).toBeUndefined();

      const cipher = createCipher("cipher-1");
      mockDataService.ciphers$.next([cipher]);

      expect(testAccess(component).dataSource.data[0].iconCipher).toBe(cipher);
    });

    it("should clear rows when the report becomes null", () => {
      mockDataService.report$.next(createMixedCriticalityReport());
      expect(testAccess(component).dataSource.data).toHaveLength(1);

      mockDataService.report$.next(null);

      expect(testAccess(component).dataSource.data).toEqual([]);
    });
  });

  // ==================== Search ====================

  describe("Search", () => {
    /** Two critical applications, so a search term can meaningfully narrow the set. */
    const loadTwoCriticalApps = () =>
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})],
          applications: [
            createApplication("github.com", true),
            createApplication("gitlab.com", true),
          ],
        }),
      );

    const filteredNames = () =>
      testAccess(component).dataSource.filteredData.map((row: any) => row.applicationName);

    it("should apply the search term to the data source after the debounce window", fakeAsync(() => {
      loadTwoCriticalApps();

      testAccess(component).searchControl.setValue("github");
      expect(filteredNames()).toEqual(["github.com", "gitlab.com"]);

      tick(200);

      expect(filteredNames()).toEqual(["github.com"]);
    }));

    it("should only apply the final value when typing quickly", fakeAsync(() => {
      loadTwoCriticalApps();

      testAccess(component).searchControl.setValue("gitlab");
      tick(50);
      testAccess(component).searchControl.setValue("github");
      tick(50);

      // Neither intermediate value has settled yet.
      expect(filteredNames()).toEqual(["github.com", "gitlab.com"]);

      tick(200);

      expect(filteredNames()).toEqual(["github.com"]);
    }));
  });

  // ==================== removeCriticalApplication ====================

  describe("removeCriticalApplication()", () => {
    it("should unmark the single application passed in", () => {
      component.removeCriticalApplication("github.com");

      expect(mockDataService.unmarkApplicationsAsCritical$).toHaveBeenCalledTimes(1);
      expect(mockDataService.unmarkApplicationsAsCritical$).toHaveBeenCalledWith(["github.com"]);
    });

    it("should show a success toast on completion", () => {
      component.removeCriticalApplication("github.com");

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "success",
          message: "criticalApplicationUnmarkedSuccessfully",
        }),
      );
    });

    it("should show an error toast when the service call fails", () => {
      mockDataService.unmarkApplicationsAsCritical$.mockReturnValue(
        throwError(() => new Error("fail")),
      );

      component.removeCriticalApplication("github.com");

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "unexpectedError" }),
      );
    });
  });

  // ==================== requestPasswordChange ====================

  describe("requestPasswordChange()", () => {
    it("should pass the organization id and the unassigned cipher ids", () => {
      mockSecurityTasksService.unassignedCriticalCipherIds$.next(["cipher-1", "cipher-2"]);

      testAccess(component).requestPasswordChange();

      expect(
        mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
      ).toHaveBeenCalledWith(orgId, ["cipher-1", "cipher-2"]);
    });

    it("should show a success toast on completion", () => {
      testAccess(component).requestPasswordChange();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", message: "notifiedMembers" }),
      );
    });

    it("should show an error toast when the service call fails", () => {
      mockSecurityTasksService.requestPasswordChangeForCriticalApplications$.mockReturnValue(
        throwError(() => new Error("fail")),
      );

      testAccess(component).requestPasswordChange();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "unexpectedError" }),
      );
    });

    it("should show an error toast and skip the service call when there is no organization id", () => {
      fixture.componentRef.setInput("organizationId", undefined);

      testAccess(component).requestPasswordChange();

      expect(
        mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
      ).not.toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "error", message: "unexpectedError" }),
      );
    });
  });

  // ==================== Drawers ====================

  describe("Drawers", () => {
    it("should toggle the critical at-risk members drawer", () => {
      testAccess(component).openCriticalAtRiskMembersDrawer();

      expect(mockDrawerStateService.toggleDrawer).toHaveBeenCalledWith(
        DrawerType.CriticalAtRiskMembers,
        "criticalAppsAtRiskMembers",
      );
    });

    it("should toggle the critical at-risk apps drawer", () => {
      testAccess(component).openCriticalAtRiskAppsDrawer();

      expect(mockDrawerStateService.toggleDrawer).toHaveBeenCalledWith(
        DrawerType.CriticalAtRiskApps,
        "criticalAppsAtRiskApplications",
      );
    });

    it("should toggle the app at-risk members drawer for a given application", () => {
      component.showAppAtRiskMembers("github.com");

      expect(mockDrawerStateService.toggleDrawer).toHaveBeenCalledWith(
        DrawerType.AppAtRiskMembers,
        "github.com",
      );
    });

    it("should expose the drawer state from the drawer service", () => {
      expect(testAccess(component).drawerState).toBe(mockDrawerStateService.drawerState);
    });
  });

  // ==================== goToAllAppsTab ====================

  describe("goToAllAppsTab()", () => {
    it("should navigate to the all-apps tab for the current organization", async () => {
      await component.goToAllAppsTab();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        [`organizations/${orgId}/access-intelligence`],
        {
          queryParams: { tabIndex: RiskInsightsTabType.AllApps },
          queryParamsHandling: "merge",
        },
      );
    });
  });
});
