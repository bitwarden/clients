import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { BehaviorSubject, of, throwError } from "rxjs";

import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence";
import { createReport } from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogRef, DialogService, DIALOG_DATA, ToastService } from "@bitwarden/components";

import { SecurityTasksService } from "../services/abstractions/security-tasks.service";

import {
  DialogView,
  NewApplicationsDialogResultType,
  NewApplicationsDialogV2Component,
  NewApplicationsDialogV2Data,
} from "./new-applications-dialog-v2.component";

describe("NewApplicationsDialogV2Component", () => {
  let component: NewApplicationsDialogV2Component;
  let fixture: ComponentFixture<NewApplicationsDialogV2Component>;
  let mockAccessIntelligenceService: jest.Mocked<AccessIntelligenceDataService>;
  let mockDialogRef: jest.Mocked<DialogRef<NewApplicationsDialogResultType>>;
  let mockDialogService: jest.Mocked<DialogService>;
  let mockI18nService: jest.Mocked<I18nService>;
  let mockLogService: jest.Mocked<LogService>;
  let mockSecurityTasksService: jest.Mocked<SecurityTasksService>;
  let mockToastService: jest.Mocked<ToastService>;
  let mockEnvironmentService: jest.Mocked<EnvironmentService>;
  let mockDomainSettingsService: jest.Mocked<DomainSettingsService>;

  /**
   * Helper to access protected/private members for testing.
   * Angular components use protected/private for encapsulation, but tests need access to verify internal state.
   * Using type assertion is the recommended approach per Angular testing best practices.
   */
  const testAccess = (comp: NewApplicationsDialogV2Component) => comp as any;

  const orgId = "org-123" as OrganizationId;

  const createMockDialogData = (
    hasExistingCriticalApplications = false,
  ): NewApplicationsDialogV2Data => ({
    newApplications: [
      createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
      createReport("gitlab.com", { u3: true }, { c3: true }),
      createReport("bitbucket.org", { u4: false }, { c4: false }),
    ],
    organizationId: orgId,
    hasExistingCriticalApplications,
  });

  const createMockCipher = (name: string, id: string): CipherView => {
    const cipher = new CipherView();
    cipher.name = name;
    cipher.id = id;
    return cipher;
  };

  beforeEach(async () => {
    // Mock IntersectionObserver for the test environment
    global.IntersectionObserver = class IntersectionObserver {
      constructor() {}
      disconnect() {}
      observe() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      unobserve() {}
    } as any;

    // Create mock services
    mockAccessIntelligenceService = {
      markApplicationsAsCritical$: jest.fn().mockReturnValue(of(undefined)),
      markApplicationsAsReviewed$: jest.fn().mockReturnValue(of(undefined)),
      ciphers$: of([
        createMockCipher("GitHub Login", "c1"),
        createMockCipher("GitLab", "c3"),
        createMockCipher("Bitbucket", "c4"),
      ]),
    } as any;

    mockDialogRef = {
      close: jest.fn(),
    } as any;

    mockDialogService = {
      open: jest.fn(),
      openSimpleDialog: jest.fn().mockResolvedValue(true),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string, ...args: any[]) => key),
    } as any;

    mockLogService = {
      error: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockSecurityTasksService = {
      requestPasswordChangeForCriticalApplications$: jest.fn().mockReturnValue(of(undefined)),
    } as any;

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockEnvironmentService = {
      environment$: of({
        getIconsUrl: () => "https://icons.bitwarden.net",
      }),
    } as any;

    mockDomainSettingsService = {
      neverDomains: {},
      equivalentDomains: [],
      showFavicons$: new BehaviorSubject<boolean>(true),
      equivalentDomains$: new BehaviorSubject<string[][]>([]),
    } as any;

    const mockDialogData = createMockDialogData();

    TestBed.configureTestingModule({
      imports: [NewApplicationsDialogV2Component],
      providers: [
        provideNoopAnimations(),
        { provide: AccessIntelligenceDataService, useValue: mockAccessIntelligenceService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogService, useValue: mockLogService },
        {
          provide: SecurityTasksService,
          useValue: mockSecurityTasksService,
        },
        { provide: ToastService, useValue: mockToastService },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
        { provide: DomainSettingsService, useValue: mockDomainSettingsService },
        { provide: DIALOG_DATA, useValue: mockDialogData },
      ],
      schemas: [NO_ERRORS_SCHEMA], // Ignore child component errors for unit testing
    });

    // DialogModule (imported by NewApplicationsDialogV2Component) creates a component environment
    // injector containing its own DialogService. Because this injector is closer to the component
    // than the root test injector, it shadows both configureTestingModule providers and
    // overrideProvider(). Adding the mock to the component's own providers gives it the highest
    // precedence in the injector hierarchy, guaranteeing the mock is resolved by inject().
    TestBed.overrideComponent(NewApplicationsDialogV2Component, {
      add: { providers: [{ provide: DialogService, useValue: mockDialogService }] },
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(NewApplicationsDialogV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ==================== Component Creation ====================

  describe("Component Creation", () => {
    it("should create component", () => {
      expect(component).toBeTruthy();
    });
  });

  // ==================== Static Method ====================

  describe("Static Method", () => {
    it("should open dialog with correct data", () => {
      const mockData: NewApplicationsDialogV2Data = createMockDialogData(true);
      const mockDialogRefStatic = { closed: of(NewApplicationsDialogResultType.Complete) } as any;

      mockDialogService.open.mockReturnValue(mockDialogRefStatic);

      const result = NewApplicationsDialogV2Component.open(mockDialogService, mockData);

      expect(mockDialogService.open).toHaveBeenCalledWith(NewApplicationsDialogV2Component, {
        data: mockData,
      });
      expect(result).toBe(mockDialogRefStatic);
    });
  });

  // ==================== Dialog Data ====================

  describe("Dialog Data", () => {
    it("should inject DIALOG_DATA correctly", () => {
      expect(testAccess(component).dialogParams).toBeDefined();
      expect(testAccess(component).dialogParams.newApplications.length).toBe(3);
      expect(testAccess(component).dialogParams.organizationId).toBe(orgId);
    });
  });

  // ==================== View State Management ====================

  describe("View State Management", () => {
    it("should start in SelectApplications view", () => {
      expect(testAccess(component).currentView()).toBe(DialogView.SelectApplications);
    });

    it("should navigate between views", () => {
      // Start in SelectApplications
      expect(testAccess(component).currentView()).toBe(DialogView.SelectApplications);

      // Navigate to AssignTasks
      testAccess(component).navigateToAssignTasks();
      expect(testAccess(component).currentView()).toBe(DialogView.AssignTasks);

      // Navigate back to SelectApplications
      testAccess(component).navigateToSelectApplications();
      expect(testAccess(component).currentView()).toBe(DialogView.SelectApplications);
    });
  });

  // ==================== Selection Logic ====================

  describe("Selection Logic", () => {
    it("should toggle selection for a single application", () => {
      expect(testAccess(component).selectedApplications().has("github.com")).toBe(false);

      // Select
      testAccess(component).toggleSelection("github.com");
      expect(testAccess(component).selectedApplications().has("github.com")).toBe(true);

      // Deselect
      testAccess(component).toggleSelection("github.com");
      expect(testAccess(component).selectedApplications().has("github.com")).toBe(false);
    });

    it("should toggle all applications", () => {
      expect(testAccess(component).selectedApplications().size).toBe(0);

      // Select all
      testAccess(component).toggleAll();
      expect(testAccess(component).selectedApplications().size).toBe(3);
      expect(testAccess(component).selectedApplications().has("github.com")).toBe(true);
      expect(testAccess(component).selectedApplications().has("gitlab.com")).toBe(true);
      expect(testAccess(component).selectedApplications().has("bitbucket.org")).toBe(true);

      // Deselect all
      testAccess(component).toggleAll();
      expect(testAccess(component).selectedApplications().size).toBe(0);
    });

    it("should return correct isAllSelected state", () => {
      expect(testAccess(component).isAllSelected()).toBe(false);

      // Select all manually
      testAccess(component).toggleSelection("github.com");
      testAccess(component).toggleSelection("gitlab.com");
      testAccess(component).toggleSelection("bitbucket.org");

      expect(testAccess(component).isAllSelected()).toBe(true);
    });

    it("should update selectedApplications signal when toggling", () => {
      const initialSize = testAccess(component).selectedApplications().size;
      expect(initialSize).toBe(0);

      testAccess(component).toggleSelection("github.com");
      expect(testAccess(component).selectedApplications().size).toBe(1);

      testAccess(component).toggleSelection("gitlab.com");
      expect(testAccess(component).selectedApplications().size).toBe(2);
    });
  });

  // ==================== Computed Signals ====================

  describe("Computed Signals", () => {
    it("should compute newCriticalApplications - filters selected apps", () => {
      testAccess(component).toggleSelection("github.com");
      testAccess(component).toggleSelection("gitlab.com");

      expect(testAccess(component).newCriticalApplications().length).toBe(2);
      expect(
        testAccess(component)
          .newCriticalApplications()
          .map((app: any) => app.applicationName),
      ).toEqual(["github.com", "gitlab.com"]);
    });

    it("should compute newAtRiskCriticalApplications - filters by isAtRisk()", () => {
      testAccess(component).toggleSelection("github.com"); // Has at-risk (u1: true, c1: true)
      testAccess(component).toggleSelection("gitlab.com"); // Has at-risk (u3: true, c3: true)
      testAccess(component).toggleSelection("bitbucket.org"); // No at-risk (u4: false, c4: false)

      const atRiskApps = testAccess(component).newAtRiskCriticalApplications();

      // github and gitlab have at-risk, bitbucket does not
      expect(atRiskApps.length).toBe(2);
      expect(atRiskApps.map((app: any) => app.applicationName)).toEqual([
        "github.com",
        "gitlab.com",
      ]);
    });

    it("should compute atRiskCriticalMembersCount - counts unique members", () => {
      testAccess(component).toggleSelection("github.com"); // u1: true, u2: false
      testAccess(component).toggleSelection("gitlab.com"); // u3: true

      const memberCount = testAccess(component).atRiskCriticalMembersCount();

      // u1 (github) + u3 (gitlab) = 2 unique at-risk members
      expect(memberCount).toBe(2);
    });

    it("should compute newUnassignedAtRiskCipherIds - collects cipher IDs", () => {
      testAccess(component).toggleSelection("github.com"); // c1: true, c2: false
      testAccess(component).toggleSelection("gitlab.com"); // c3: true

      const cipherIds = testAccess(component).newUnassignedAtRiskCipherIds();

      // Should include c1 (github at-risk) and c3 (gitlab at-risk)
      expect(cipherIds).toContain("c1");
      expect(cipherIds).toContain("c3");
      expect(cipherIds).not.toContain("c2"); // Not at-risk
      expect(cipherIds).not.toContain("c4"); // Not selected
    });
  });

  // ==================== Dialog Actions ====================

  describe("Dialog Actions", () => {
    it("should handle handleMarkAsCritical with selections", async () => {
      testAccess(component).toggleSelection("github.com");

      await testAccess(component).handleMarkAsCritical();

      // Should navigate to AssignTasks view (since there are at-risk cipher IDs)
      expect(testAccess(component).currentView()).toBe(DialogView.AssignTasks);
    });

    it("should handle handleMarkAsCritical without selections (shows confirmation)", async () => {
      // No selections
      expect(testAccess(component).selectedApplications().size).toBe(0);

      // User declines confirmation in dialog (returns early, doesn't proceed with save)
      mockDialogService.openSimpleDialog.mockResolvedValueOnce(false);

      await testAccess(component).handleMarkAsCritical();

      expect(mockDialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "confirmNoSelectedCriticalApplicationsTitle" },
        content: { key: "confirmNoSelectedCriticalApplicationsDesc" },
        type: "warning",
      });

      // Should not proceed with saving since user declined
      expect(mockAccessIntelligenceService.markApplicationsAsReviewed$).not.toHaveBeenCalled();
    }); // 10 second timeout

    it("should handle handleMarkAsCritical - skips assign view if no unassigned ciphers", async () => {
      // Select app with no at-risk ciphers
      testAccess(component).toggleSelection("bitbucket.org"); // u4: false, c4: false

      const handleAssignTasksSpy = jest.spyOn(testAccess(component), "handleAssignTasks");

      await testAccess(component).handleMarkAsCritical();

      // Should call handleAssignTasks directly (skip assign view)
      expect(handleAssignTasksSpy).toHaveBeenCalled();

      handleAssignTasksSpy.mockRestore();
    });

    it("should handle handleAssignTasks - marks apps and assigns tasks", (done) => {
      testAccess(component).toggleSelection("github.com");
      testAccess(component).toggleSelection("gitlab.com");

      testAccess(component).handleAssignTasks();

      // Wait for async operations
      setTimeout(() => {
        expect(mockAccessIntelligenceService.markApplicationsAsCritical$).toHaveBeenCalledWith(
          expect.arrayContaining(["github.com", "gitlab.com"]),
        );

        // All apps should be marked as reviewed in a single bulk call
        expect(mockAccessIntelligenceService.markApplicationsAsReviewed$).toHaveBeenCalledTimes(1);

        // Security tasks should be assigned
        expect(
          mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
        ).toHaveBeenCalledWith(orgId, expect.any(Array));

        // Success toast
        expect(mockToastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "success",
          }),
        );

        // Dialog closed
        expect(mockDialogRef.close).toHaveBeenCalledWith(NewApplicationsDialogResultType.Complete);

        done();
      }, 100);
    });

    it("should handle handleCancel - closes dialog without saving", () => {
      testAccess(component).handleCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(NewApplicationsDialogResultType.Close);
    });
  });

  // ==================== Service Integration ====================

  describe("Service Integration", () => {
    it("should call markApplicationsAsCritical$ for selected apps", (done) => {
      testAccess(component).toggleSelection("github.com");

      testAccess(component).handleAssignTasks();

      setTimeout(() => {
        expect(mockAccessIntelligenceService.markApplicationsAsCritical$).toHaveBeenCalledWith(
          expect.arrayContaining(["github.com"]),
        );
        done();
      }, 100);
    });

    it("should call markApplicationsAsReviewed$ once with all apps", (done) => {
      testAccess(component).toggleSelection("github.com"); // Select only one

      testAccess(component).handleAssignTasks();

      setTimeout(() => {
        // All apps should be marked as reviewed in a single bulk call
        expect(mockAccessIntelligenceService.markApplicationsAsReviewed$).toHaveBeenCalledTimes(1);
        done();
      }, 100);
    });

    it("should call requestPasswordChangeForCriticalApplications with cipher IDs", (done) => {
      testAccess(component).toggleSelection("github.com");

      testAccess(component).handleAssignTasks();

      setTimeout(() => {
        expect(
          mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
        ).toHaveBeenCalledWith(orgId, expect.arrayContaining(["c1"]));
        done();
      }, 100);
    });
  });

  // ==================== Error Handling ====================

  describe("Error Handling", () => {
    it("should handle 404 error (permissions)", (done) => {
      const errorResponse = new ErrorResponse(null, 404);

      mockAccessIntelligenceService.markApplicationsAsCritical$.mockReturnValue(
        throwError(() => errorResponse),
      );

      testAccess(component).toggleSelection("github.com");

      testAccess(component).handleAssignTasks();

      setTimeout(() => {
        expect(mockToastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "mustBeOrganizationOwnerAdmin",
            variant: "error",
          }),
        );

        expect(testAccess(component).saving()).toBe(false);
        done();
      }, 100);
    });

    it("should handle generic errors", (done) => {
      const genericError = new Error("Network error");

      mockAccessIntelligenceService.markApplicationsAsCritical$.mockReturnValue(
        throwError(() => genericError),
      );

      testAccess(component).toggleSelection("github.com");

      testAccess(component).handleAssignTasks();

      setTimeout(() => {
        expect(mockLogService.error).toHaveBeenCalledWith(
          expect.stringContaining("[NewApplicationsDialogV2]"),
          genericError,
        );

        expect(mockToastService.showToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "error",
            title: "errorSavingReviewStatus",
          }),
        );

        expect(testAccess(component).saving()).toBe(false);
        done();
      }, 100);
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle empty newApplications array", async () => {
      const emptyDialogData: NewApplicationsDialogV2Data = {
        newApplications: [],
        organizationId: orgId,
        hasExistingCriticalApplications: false,
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [NewApplicationsDialogV2Component],
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockAccessIntelligenceService },
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DialogService, useValue: mockDialogService },
          { provide: I18nService, useValue: mockI18nService },
          { provide: LogService, useValue: mockLogService },
          {
            provide: SecurityTasksService,
            useValue: mockSecurityTasksService,
          },
          { provide: ToastService, useValue: mockToastService },
          { provide: DIALOG_DATA, useValue: emptyDialogData },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const emptyFixture = TestBed.createComponent(NewApplicationsDialogV2Component);
      const emptyComponent = emptyFixture.componentInstance;

      expect(testAccess(emptyComponent).isAllSelected()).toBe(false);
      expect(testAccess(emptyComponent).newCriticalApplications().length).toBe(0);
    });

    it("should handle hasNoCriticalApplications flag", async () => {
      expect(testAccess(component).hasNoCriticalApplications()).toBe(true);

      // Create new component with hasExistingCriticalApplications = true
      const dialogDataWithCritical = createMockDialogData(true);

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [NewApplicationsDialogV2Component],
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockAccessIntelligenceService },
          { provide: DialogRef, useValue: mockDialogRef },
          { provide: DialogService, useValue: mockDialogService },
          { provide: I18nService, useValue: mockI18nService },
          { provide: LogService, useValue: mockLogService },
          {
            provide: SecurityTasksService,
            useValue: mockSecurityTasksService,
          },
          { provide: ToastService, useValue: mockToastService },
          { provide: DIALOG_DATA, useValue: dialogDataWithCritical },
        ],
        schemas: [NO_ERRORS_SCHEMA],
      }).compileComponents();

      const newFixture = TestBed.createComponent(NewApplicationsDialogV2Component);
      const newComponent = newFixture.componentInstance;

      expect(testAccess(newComponent).hasNoCriticalApplications()).toBe(false);
    });

    it("should prevent double-click on handleAssignTasks", () => {
      testAccess(component).saving.set(true);

      testAccess(component).handleAssignTasks();

      // Should return early and not call service
      expect(mockAccessIntelligenceService.markApplicationsAsReviewed$).not.toHaveBeenCalled();
    });

    it("should handle onBack navigation", () => {
      testAccess(component).navigateToAssignTasks();
      expect(testAccess(component).currentView()).toBe(DialogView.AssignTasks);

      testAccess(component).onBack();
      expect(testAccess(component).currentView()).toBe(DialogView.SelectApplications);
    });
  });
});
