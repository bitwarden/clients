import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService } from "@bitwarden/components";

import { ActivityTabComponent } from "./activity-tab.component";
import {
  NewApplicationsDialogResultType,
  NewApplicationsDialogV2Component,
} from "./new-applications-dialog-v2/new-applications-dialog-v2.component";

/**
 * Mock type for AccessIntelligenceDataService that uses BehaviorSubjects
 * instead of Observables so we can call .next() in tests
 */
type MockAccessIntelligenceDataService = {
  report$: BehaviorSubject<AccessReportView | null>;
  loading$: BehaviorSubject<boolean>;
  ciphers$: BehaviorSubject<CipherView[]>;
  initializeForOrganization$: jest.Mock;
};

describe("ActivityTabComponent", () => {
  let component: ActivityTabComponent;
  let fixture: ComponentFixture<ActivityTabComponent>;
  let mockAccessIntelligenceService: MockAccessIntelligenceDataService;
  let mockDrawerStateService: jest.Mocked<DrawerStateService>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockI18nService: jest.Mocked<I18nService>;

  /**
   * Helper to access protected/private members for testing.
   * Angular components use protected/private for encapsulation, but tests need access to verify internal state.
   * Using type assertion is the recommended approach per Angular testing best practices.
   */
  const testAccess = (comp: ActivityTabComponent) => comp as any;

  const orgId = "org-123" as OrganizationId;

  beforeEach(async () => {
    // Create mock services
    mockAccessIntelligenceService = {
      report$: new BehaviorSubject<AccessReportView | null>(null),
      loading$: new BehaviorSubject<boolean>(false),
      ciphers$: new BehaviorSubject<CipherView[]>([]),
      initializeForOrganization$: jest.fn().mockReturnValue(of(undefined)),
    };

    mockDrawerStateService = {
      openDrawer: jest.fn(),
      closeDrawer: jest.fn(),
    } as any;

    mockDialogService = {
      open: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string, ...args: any[]) => key),
    } as any;

    await TestBed.configureTestingModule({
      imports: [ActivityTabComponent],
      providers: [
        { provide: AccessIntelligenceDataService, useValue: mockAccessIntelligenceService },
        { provide: DrawerStateService, useValue: mockDrawerStateService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: I18nService, useValue: mockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA], // Ignore child component errors for unit testing
    }).compileComponents();

    fixture = TestBed.createComponent(ActivityTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("organizationId", orgId);
  });

  // ==================== Component Creation ====================

  describe("Initialization", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });

    it("should accept organizationId input", () => {
      expect(component.organizationId()).toBe(orgId);
    });
  });

  // ==================== Service Integration ====================

  describe("Service Integration", () => {
    it("should convert report$ to signal with toSignal()", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [createReport("github.com", { u1: true }, { c1: true })],
      });

      mockAccessIntelligenceService.report$.next(testReport);

      expect(testAccess(component).report()).toBe(testReport);
    });

    it("should convert loading$ to signal with initialValue", () => {
      mockAccessIntelligenceService.loading$.next(true);

      expect(testAccess(component).loading()).toBe(true);

      mockAccessIntelligenceService.loading$.next(false);

      expect(testAccess(component).loading()).toBe(false);
    });
  });

  // ==================== Computed Signals - Metrics ====================

  describe("Computed Signals - Metrics", () => {
    it("should calculate totalCriticalAppsAtRiskMemberCount - counts unique at-risk members", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [
          createReport("github.com", { u1: true, u2: false, u3: true }, { c1: true }),
          createReport("gitlab.com", { u2: true, u3: true }, { c2: true }),
        ],
        applications: [
          createApplication("github.com", true), // Critical
          createApplication("gitlab.com", true), // Critical
        ],
        memberRegistry: createMemberRegistry([
          { id: "u1", name: "Alice", email: "alice@example.com" },
          { id: "u2", name: "Bob", email: "bob@example.com" },
          { id: "u3", name: "Charlie", email: "charlie@example.com" },
        ]),
      });

      testReport.recomputeSummary();
      mockAccessIntelligenceService.report$.next(testReport);

      // u1 (github), u2 (gitlab), u3 (github + gitlab) = 3 unique members
      expect(testAccess(component).totalCriticalAppsAtRiskMemberCount()).toBe(3);
    });

    it("should calculate totalCriticalAppsCount - counts all critical apps", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [
          createReport("github.com", { u1: true }, { c1: true }),
          createReport("gitlab.com", { u2: false }, { c2: false }),
          createReport("bitbucket.com", { u3: true }, { c3: true }),
        ],
        applications: [
          createApplication("github.com", true), // Critical
          createApplication("gitlab.com", false), // Not critical
          createApplication("bitbucket.com", true), // Critical
        ],
      });

      testReport.recomputeSummary();
      mockAccessIntelligenceService.report$.next(testReport);

      expect(testAccess(component).totalCriticalAppsCount()).toBe(2);
    });

    it("should calculate totalCriticalAppsAtRiskCount - counts critical apps with at-risk status", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [
          createReport("github.com", { u1: true }, { c1: true }), // Has at-risk
          createReport("gitlab.com", { u2: false }, { c2: false }), // No at-risk
          createReport("bitbucket.com", { u3: true }, { c3: true }), // Has at-risk
        ],
        applications: [
          createApplication("github.com", true), // Critical
          createApplication("gitlab.com", true), // Critical
          createApplication("bitbucket.com", true), // Critical
        ],
      });

      testReport.recomputeSummary();
      mockAccessIntelligenceService.report$.next(testReport);

      // github (at-risk) + bitbucket (at-risk) = 2
      expect(testAccess(component).totalCriticalAppsAtRiskCount()).toBe(2);
    });

    it("should calculate totalApplicationCount - counts total applications", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [
          createReport("github.com", {}, {}),
          createReport("gitlab.com", {}, {}),
          createReport("bitbucket.com", {}, {}),
        ],
      });

      mockAccessIntelligenceService.report$.next(testReport);

      expect(testAccess(component).totalApplicationCount()).toBe(3);
    });

    it("should calculate newApplicationsCount - counts new applications", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [
          createReport("github.com", {}, {}),
          createReport("gitlab.com", {}, {}),
          createReport("bitbucket.com", {}, {}),
        ],
        applications: [
          createApplication("github.com", false, undefined), // New (no reviewedDate)
          createApplication("gitlab.com", false, new Date()), // Reviewed
          createApplication("bitbucket.com", false, undefined), // New (no reviewedDate)
        ],
      });

      mockAccessIntelligenceService.report$.next(testReport);

      expect(testAccess(component).newApplicationsCount()).toBe(2);
    });

    it("should calculate activityViewState - 'caught-up' when no new apps and all reviewed", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})],
        applications: [
          createApplication("github.com", true, new Date()), // Reviewed
          createApplication("gitlab.com", false, new Date()), // Reviewed
        ],
      });

      mockAccessIntelligenceService.report$.next(testReport);

      expect(testAccess(component).activityViewState()).toBe("caught-up");
    });
  });

  // ==================== Computed Signals - States ====================

  describe("Computed Signals - States", () => {
    it("should calculate activityViewState - 'needs-review' when all apps are new", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})],
        applications: [
          createApplication("github.com", false, undefined), // New (no reviewedDate)
          createApplication("gitlab.com", false, undefined), // New (no reviewedDate)
        ],
      });

      mockAccessIntelligenceService.report$.next(testReport);

      expect(testAccess(component).activityViewState()).toBe("needs-review");
    });
  });

  // ==================== User Actions ====================

  describe("User Actions", () => {
    it("should call onReviewNewApplications - opens dialog with correct data", async () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})],
        applications: [
          createApplication("github.com", false, undefined), // New
          createApplication("gitlab.com", true, new Date()), // Reviewed + Critical
        ],
      });

      mockAccessIntelligenceService.report$.next(testReport);

      const mockDialogRef = {
        closed: of(NewApplicationsDialogResultType.Complete),
      } as Partial<DialogRef<NewApplicationsDialogResultType>>;

      // Spy on the static open method
      const openSpy = jest
        .spyOn(NewApplicationsDialogV2Component, "open")
        .mockReturnValue(mockDialogRef as any);

      await testAccess(component).onReviewNewApplications();

      expect(openSpy).toHaveBeenCalled();
      const callArgs = openSpy.mock.calls[0];
      expect(callArgs[1]).toEqual(
        expect.objectContaining({
          newApplications: expect.arrayContaining([
            expect.objectContaining({ applicationName: "github.com" }),
          ]),
          organizationId: orgId,
          hasExistingCriticalApplications: true, // gitlab is critical
        }),
      );

      openSpy.mockRestore();
    });

    it("should call onViewAtRiskMembers - opens drawer with correct type", async () => {
      await testAccess(component).onViewAtRiskMembers();

      expect(mockDrawerStateService.openDrawer).toHaveBeenCalledWith(
        DrawerType.CriticalAtRiskMembers,
        "activityTabAtRiskMembers",
      );
    });

    it("should call onViewAtRiskApplications - opens drawer with correct type", async () => {
      await testAccess(component).onViewAtRiskApplications();

      expect(mockDrawerStateService.openDrawer).toHaveBeenCalledWith(
        DrawerType.CriticalAtRiskApps,
        "activityTabAtRiskApplications",
      );
    });
  });

  // ==================== Local State ====================

  describe("Local State", () => {
    it("should update extendPasswordChangeWidget signal", () => {
      expect(testAccess(component).extendPasswordChangeWidget()).toBe(false);

      testAccess(component).setExtendPasswordWidget(true);
      expect(testAccess(component).extendPasswordChangeWidget()).toBe(true);

      testAccess(component).setExtendPasswordWidget(false);
      expect(testAccess(component).extendPasswordChangeWidget()).toBe(false);
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle null report gracefully", () => {
      mockAccessIntelligenceService.report$.next(null);

      expect(testAccess(component).totalCriticalAppsAtRiskMemberCount()).toBe(0);
      expect(testAccess(component).totalCriticalAppsCount()).toBe(0);
      expect(testAccess(component).totalCriticalAppsAtRiskCount()).toBe(0);
      expect(testAccess(component).totalApplicationCount()).toBe(0);
      expect(testAccess(component).newApplicationsCount()).toBe(0);
      expect(testAccess(component).activityViewState()).toBe("default");
    });

    it("should handle empty report (no applications)", () => {
      const emptyReport = createRiskInsights({
        reports: [],
        applications: [],
      });

      mockAccessIntelligenceService.report$.next(emptyReport);

      expect(testAccess(component).totalApplicationCount()).toBe(0);
      expect(testAccess(component).newApplicationsCount()).toBe(0);
      expect(testAccess(component).activityViewState()).toBe("default");
    });

    it("should handle report with no critical apps", () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [
          createReport("github.com", { u1: true }, { c1: true }),
          createReport("gitlab.com", { u2: true }, { c2: true }),
        ],
        applications: [
          createApplication("github.com", false), // Not critical
          createApplication("gitlab.com", false), // Not critical
        ],
      });

      testReport.recomputeSummary();
      mockAccessIntelligenceService.report$.next(testReport);

      expect(testAccess(component).totalCriticalAppsCount()).toBe(0);
      expect(testAccess(component).totalCriticalAppsAtRiskCount()).toBe(0);
      expect(testAccess(component).totalCriticalAppsAtRiskMemberCount()).toBe(0);
    });

    it("should handle dialog close without completion", async () => {
      const testReport = createRiskInsights({
        organizationId: orgId,
        reports: [createReport("github.com", {}, {})],
        applications: [createApplication("github.com", false, undefined)],
      });

      mockAccessIntelligenceService.report$.next(testReport);

      const mockDialogRef = {
        closed: of(NewApplicationsDialogResultType.Close),
      } as Partial<DialogRef<NewApplicationsDialogResultType>>;

      // Spy on the static open method
      const openSpy = jest
        .spyOn(NewApplicationsDialogV2Component, "open")
        .mockReturnValue(mockDialogRef as any);

      await testAccess(component).onReviewNewApplications();

      // Dialog closed without completing - no errors should occur
      expect(openSpy).toHaveBeenCalled();

      openSpy.mockRestore();
    });
  });

  // ==================== Change Detection Tests ====================

  describe("OnPush Change Detection", () => {
    it("should update when report$ emits new value", () => {
      const initialReport = createRiskInsights({
        reports: [createReport("github.com", {}, {})],
      });

      mockAccessIntelligenceService.report$.next(initialReport);

      expect(testAccess(component).totalApplicationCount()).toBe(1);

      const updatedReport = createRiskInsights({
        reports: [createReport("github.com", {}, {}), createReport("gitlab.com", {}, {})],
      });

      mockAccessIntelligenceService.report$.next(updatedReport);

      expect(testAccess(component).totalApplicationCount()).toBe(2);
    });

    it("should update when organizationId input changes", () => {
      const newOrgId = "org-456" as OrganizationId;

      fixture.componentRef.setInput("organizationId", newOrgId);

      expect(component.organizationId()).toBe(newOrgId);
    });
  });
});
