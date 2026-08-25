import { NO_ERRORS_SCHEMA, signal } from "@angular/core";
import { ComponentFixture, fakeAsync, TestBed, tick } from "@angular/core/testing";
import { Router } from "@angular/router";
import { BehaviorSubject, of, throwError } from "rxjs";

import {
  AccessIntelligenceDataService,
  DrawerState,
  DrawerStateService,
  DrawerType,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import {
  createApplication,
  createCipher,
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
import { ApplicationTableRowV2 } from "../shared/applications-table-v2/applications-table-v2.component";

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

type MockSecurityTasksService = {
  requestPasswordChangeForCriticalApplications$: jest.Mock;
};

describe("CriticalApplicationsTabComponent", () => {
  let component: CriticalApplicationsTabComponent;
  let fixture: ComponentFixture<CriticalApplicationsTabComponent>;
  let mockDataService: MockAccessIntelligenceDataService;
  let mockDrawerStateService: jest.Mocked<DrawerStateService>;
  let mockDrawerState: ReturnType<typeof signal<DrawerState | null>>;
  let mockSecurityTasksService: MockSecurityTasksService;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockRouter: jest.Mocked<Router>;
  let mockActiveStepId: ReturnType<typeof signal<string | null>>;

  /**
   * Helper to access protected/private members for testing.
   */
  const testAccess = (comp: CriticalApplicationsTabComponent) => comp as any;

  const orgId = "org-123" as OrganizationId;

  beforeEach(async () => {
    mockDataService = {
      report$: new BehaviorSubject<AccessReportView | null>(null),
      loading$: new BehaviorSubject<boolean>(false),
      ciphers$: new BehaviorSubject<CipherView[]>([]),
      unmarkApplicationsAsCritical$: jest.fn().mockReturnValue(of(undefined)),
    };

    mockDrawerState = signal<DrawerState | null>(null);
    mockDrawerStateService = {
      toggleDrawer: jest.fn(),
      closeDrawer: jest.fn(),
      drawerState: mockDrawerState,
    } as any;

    mockSecurityTasksService = {
      requestPasswordChangeForCriticalApplications$: jest.fn().mockReturnValue(of(undefined)),
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

    mockActiveStepId = signal<string | null>(null);

    await TestBed.configureTestingModule({
      imports: [CriticalApplicationsTabComponent],
      providers: [
        { provide: AccessIntelligenceDataService, useValue: mockDataService },
        { provide: DrawerStateService, useValue: mockDrawerStateService },
        { provide: AccessSecurityTasksService, useValue: mockSecurityTasksService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: ToastService, useValue: mockToastService },
        { provide: Router, useValue: mockRouter },
        {
          provide: AccessIntelligenceCoachmarkService,
          useValue: { activeStepId: mockActiveStepId },
        },
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

    it("should start with an empty dataSource when no report has loaded", () => {
      expect(testAccess(component).dataSource.data).toEqual([]);
    });
  });

  // ==================== atRiskCipherIds ====================

  describe("atRiskCipherIds", () => {
    it("should default to an empty array when no report is loaded", () => {
      expect(testAccess(component).atRiskCipherIds()).toEqual([]);
    });

    it("should collect at-risk cipher IDs across all critical at-risk applications", () => {
      const testReport = createRiskInsights({
        reports: [
          createReport("github.com", {}, { "c-1": true, "c-2": false }),
          createReport("gitlab.com", {}, { "c-3": true, "c-4": true }),
        ],
        applications: [
          createApplication("github.com", true),
          createApplication("gitlab.com", true),
        ],
      });

      mockDataService.report$.next(testReport);

      expect(testAccess(component).atRiskCipherIds()).toEqual(["c-1", "c-3", "c-4"]);
    });

    it("should exclude ciphers from applications that are not marked critical", () => {
      const testReport = createRiskInsights({
        reports: [
          createReport("github.com", {}, { "c-1": true }),
          createReport("gitlab.com", {}, { "c-2": true }),
        ],
        applications: [
          createApplication("github.com", true),
          createApplication("gitlab.com", false),
        ],
      });

      mockDataService.report$.next(testReport);

      expect(testAccess(component).atRiskCipherIds()).toEqual(["c-1"]);
    });

    it("should exclude critical applications that have no at-risk ciphers", () => {
      const testReport = createRiskInsights({
        reports: [createReport("github.com", {}, { "c-1": false, "c-2": false })],
        applications: [createApplication("github.com", true)],
      });

      mockDataService.report$.next(testReport);

      expect(testAccess(component).atRiskCipherIds()).toEqual([]);
    });

    it("should reset to an empty array when the report becomes null", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, { "c-1": true })],
          applications: [createApplication("github.com", true)],
        }),
      );
      expect(testAccess(component).atRiskCipherIds()).toEqual(["c-1"]);

      mockDataService.report$.next(null);

      expect(testAccess(component).atRiskCipherIds()).toEqual([]);
    });
  });

  // ==================== Computed Signals ====================

  describe("enableRequestPasswordChange", () => {
    it("should be false when there are no at-risk critical ciphers", () => {
      expect(testAccess(component).enableRequestPasswordChange()).toBe(false);
    });

    it("should be true when at least one critical cipher is at-risk", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, { "c-1": true })],
          applications: [createApplication("github.com", true)],
        }),
      );

      expect(testAccess(component).enableRequestPasswordChange()).toBe(true);
    });
  });

  describe("helpMembersOpen", () => {
    it("should be false when the coachmark is not on the helpMembers step", () => {
      expect(testAccess(component).helpMembersOpen()).toBe(false);

      mockActiveStepId.set("someOtherStep");

      expect(testAccess(component).helpMembersOpen()).toBe(false);
    });

    it("should be true when the coachmark active step is helpMembers", () => {
      mockActiveStepId.set("helpMembers");

      expect(testAccess(component).helpMembersOpen()).toBe(true);
    });
  });

  describe("applicationSummary", () => {
    it("should be null when no report is loaded", () => {
      expect(testAccess(component).applicationSummary()).toBeNull();
    });

    it("should map the critical summary counts from the report", () => {
      mockDataService.report$.next(
        createRiskInsights({
          summary: createRiskInsightsSummary({
            totalCriticalAtRiskMemberCount: 4,
            totalCriticalMemberCount: 10,
            totalCriticalAtRiskApplicationCount: 2,
            totalCriticalApplicationCount: 5,
            // Non-critical counts must not leak into the critical summary.
            totalAtRiskMemberCount: 99,
            totalMemberCount: 99,
            totalAtRiskApplicationCount: 99,
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
  });

  // ==================== dataSource population ====================

  describe("dataSource population", () => {
    it("should include only applications marked as critical", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [
            createReport("github.com", {}, {}),
            createReport("gitlab.com", {}, {}),
            createReport("bitbucket.com", {}, {}),
          ],
          applications: [
            createApplication("github.com", true),
            createApplication("gitlab.com", false),
            createApplication("bitbucket.com", true),
          ],
        }),
      );

      const rows: ApplicationTableRowV2[] = testAccess(component).dataSource.data;

      expect(rows.map((r) => r.applicationName)).toEqual(["github.com", "bitbucket.com"]);
    });

    it("should exclude reports with no matching application metadata", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, {}), createReport("orphan.com", {}, {})],
          applications: [createApplication("github.com", true)],
        }),
      );

      const rows: ApplicationTableRowV2[] = testAccess(component).dataSource.data;

      expect(rows.map((r) => r.applicationName)).toEqual(["github.com"]);
    });

    it("should map report counts onto the table row and always flag rows as critical", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [
            createReport(
              "github.com",
              { u1: true, u2: false, u3: false },
              { "c-1": true, "c-2": true, "c-3": false },
            ),
          ],
          applications: [createApplication("github.com", true)],
        }),
      );

      const rows: ApplicationTableRowV2[] = testAccess(component).dataSource.data;

      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          applicationName: "github.com",
          passwordCount: 3,
          atRiskPasswordCount: 2,
          memberCount: 3,
          atRiskMemberCount: 1,
          isMarkedAsCritical: true,
        }),
      );
    });

    it("should resolve the icon cipher from the ciphers stream", () => {
      const iconCipher = createCipher("c-1", ["https://github.com"]);
      mockDataService.ciphers$.next([iconCipher]);

      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, { "c-1": true })],
          applications: [createApplication("github.com", true)],
        }),
      );

      const rows: ApplicationTableRowV2[] = testAccess(component).dataSource.data;

      expect(rows[0].iconCipher).toBe(iconCipher);
    });

    it("should leave iconCipher undefined when the cipher is not in the ciphers stream", () => {
      mockDataService.ciphers$.next([createCipher("some-other-cipher")]);

      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, { "c-1": true })],
          applications: [createApplication("github.com", true)],
        }),
      );

      const rows: ApplicationTableRowV2[] = testAccess(component).dataSource.data;

      expect(rows[0].iconCipher).toBeUndefined();
    });

    it("should re-resolve icon ciphers when the ciphers stream emits after the report", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, { "c-1": true })],
          applications: [createApplication("github.com", true)],
        }),
      );
      expect(testAccess(component).dataSource.data[0].iconCipher).toBeUndefined();

      const iconCipher = createCipher("c-1", ["https://github.com"]);
      mockDataService.ciphers$.next([iconCipher]);

      expect(testAccess(component).dataSource.data[0].iconCipher).toBe(iconCipher);
    });

    it("should clear the dataSource when the report becomes null", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, {})],
          applications: [createApplication("github.com", true)],
        }),
      );
      expect(testAccess(component).dataSource.data).toHaveLength(1);

      mockDataService.report$.next(null);

      expect(testAccess(component).dataSource.data).toEqual([]);
    });
  });

  // ==================== Search ====================

  describe("searchControl", () => {
    it("should apply the search term to the dataSource filter after the debounce window", fakeAsync(() => {
      testAccess(component).searchControl.setValue("github");

      // Debounce has not elapsed, so the default (match-everything) filter is still in place.
      expect(testAccess(component).dataSource.filter).not.toBe("github");

      tick(200);

      expect(testAccess(component).dataSource.filter).toBe("github");
    }));

    it("should narrow the filtered rows to those matching the search term", fakeAsync(() => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})],
          applications: [
            createApplication("github.com", true),
            createApplication("gitlab.com", true),
          ],
        }),
      );

      testAccess(component).searchControl.setValue("github");
      tick(200);

      const filtered: ApplicationTableRowV2[] = testAccess(component).dataSource.filteredData;
      expect(filtered.map((r) => r.applicationName)).toEqual(["github.com"]);
    }));

    it("should only apply the latest value typed within the debounce window", fakeAsync(() => {
      testAccess(component).searchControl.setValue("git");
      tick(100);
      testAccess(component).searchControl.setValue("github");
      tick(200);

      expect(testAccess(component).dataSource.filter).toBe("github");
    }));
  });

  // ==================== Drawers ====================

  describe("Drawers", () => {
    it("openCriticalAtRiskMembersDrawer() should toggle the CriticalAtRiskMembers drawer", () => {
      testAccess(component).openCriticalAtRiskMembersDrawer();

      expect(mockDrawerStateService.toggleDrawer).toHaveBeenCalledWith(
        DrawerType.CriticalAtRiskMembers,
        "criticalAppsAtRiskMembers",
      );
    });

    it("openCriticalAtRiskAppsDrawer() should toggle the CriticalAtRiskApps drawer", () => {
      testAccess(component).openCriticalAtRiskAppsDrawer();

      expect(mockDrawerStateService.toggleDrawer).toHaveBeenCalledWith(
        DrawerType.CriticalAtRiskApps,
        "criticalAppsAtRiskApplications",
      );
    });

    it("showAppAtRiskMembers() should toggle the AppAtRiskMembers drawer for the application", () => {
      component.showAppAtRiskMembers("github.com");

      expect(mockDrawerStateService.toggleDrawer).toHaveBeenCalledWith(
        DrawerType.AppAtRiskMembers,
        "github.com",
      );
    });
  });

  // ==================== removeCriticalApplication ====================

  describe("removeCriticalApplication()", () => {
    it("should unmark the given hostname as critical", () => {
      component.removeCriticalApplication("github.com");

      expect(mockDataService.unmarkApplicationsAsCritical$).toHaveBeenCalledWith(["github.com"]);
    });

    it("should show a success toast when the unmark succeeds", () => {
      component.removeCriticalApplication("github.com");

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        message: "criticalApplicationUnmarkedSuccessfully",
        variant: "success",
      });
    });

    it("should show an error toast when the unmark fails", () => {
      mockDataService.unmarkApplicationsAsCritical$.mockReturnValue(
        throwError(() => new Error("fail")),
      );

      component.removeCriticalApplication("github.com");

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        message: "unexpectedError",
        variant: "error",
        title: "error",
      });
    });
  });

  // ==================== requestPasswordChange ====================

  describe("requestPasswordChange()", () => {
    it("should request password changes for the current at-risk critical cipher IDs", () => {
      mockDataService.report$.next(
        createRiskInsights({
          reports: [
            createReport("github.com", {}, { "c-1": true, "c-2": false }),
            createReport("gitlab.com", {}, { "c-3": true }),
          ],
          applications: [
            createApplication("github.com", true),
            createApplication("gitlab.com", true),
          ],
        }),
      );

      testAccess(component).requestPasswordChange();

      expect(
        mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
      ).toHaveBeenCalledWith(orgId, ["c-1", "c-3"]);
    });

    it("should show a success toast when the request succeeds", () => {
      testAccess(component).requestPasswordChange();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        message: "notifiedMembers",
        variant: "success",
        title: "success",
      });
    });

    it("should show an error toast when the request fails", () => {
      mockSecurityTasksService.requestPasswordChangeForCriticalApplications$.mockReturnValue(
        throwError(() => new Error("fail")),
      );

      testAccess(component).requestPasswordChange();

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        message: "unexpectedError",
        variant: "error",
        title: "error",
      });
    });

    it("should show an error toast and not call the service when there is no organization ID", () => {
      fixture.componentRef.setInput("organizationId", undefined);

      testAccess(component).requestPasswordChange();

      expect(
        mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
      ).not.toHaveBeenCalled();
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        message: "unexpectedError",
        variant: "error",
        title: "error",
      });
    });
  });

  // ==================== goToAllAppsTab ====================

  describe("goToAllAppsTab()", () => {
    it("should navigate to the access intelligence page on the all apps tab", async () => {
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
