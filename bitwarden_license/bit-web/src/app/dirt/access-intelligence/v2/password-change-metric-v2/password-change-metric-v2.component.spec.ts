import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject, of, throwError } from "rxjs";

import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence";
import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import {
  createApplication,
  createMemberRegistry,
  createReport,
  createRiskInsights,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId, SecurityTaskId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { ToastService } from "@bitwarden/components";

import { SecurityTasksService } from "../services/abstractions/security-tasks.service";

import {
  PasswordChangeMetricV2Component,
  PasswordChangeView,
} from "./password-change-metric-v2.component";

/**
 * Mock type for AccessIntelligenceDataService that uses BehaviorSubject
 * instead of Observable so we can call .next() in tests
 */
type MockAccessIntelligenceDataService = {
  report$: BehaviorSubject<AccessReportView | null>;
};

/**
 * Mock type for SecurityTasksService that uses BehaviorSubjects
 * so we can call .next() in tests
 */
type MockSecurityTasksService = {
  tasks$: BehaviorSubject<SecurityTask[]>;
  unassignedCriticalCipherIds$: BehaviorSubject<string[]>;
  loadTasks$: jest.Mock;
  requestPasswordChangeForCriticalApplications$: jest.Mock;
  getTaskMetrics$: jest.Mock;
};

describe("PasswordChangeMetricV2Component", () => {
  let component: PasswordChangeMetricV2Component;
  let fixture: ComponentFixture<PasswordChangeMetricV2Component>;
  let mockDataService: MockAccessIntelligenceDataService;
  let mockSecurityTasksService: MockSecurityTasksService;
  let mockToastService: jest.Mocked<ToastService>;
  let mockI18nService: jest.Mocked<I18nService>;

  const orgId = "org-123" as OrganizationId;

  /** Creates a SecurityTask for testing with deterministic dates */
  function createTask(
    id: string,
    cipherId: string,
    status: SecurityTaskStatus,
    revisionDate = new Date("2025-01-15"),
  ): SecurityTask {
    return Object.assign(new SecurityTask({} as any), {
      id: id as SecurityTaskId,
      organizationId: orgId,
      cipherId: cipherId as CipherId,
      type: SecurityTaskType.UpdateAtRiskCredential,
      status,
      creationDate: new Date("2025-01-01"),
      revisionDate,
    });
  }

  /** Creates a report with critical apps having at-risk ciphers */
  function createReportWithCriticalApps(): AccessReportView {
    const report = createRiskInsights({
      organizationId: orgId,
      creationDate: new Date("2025-01-01"),
      reports: [
        createReport("github.com", { u1: true }, { c1: true, c2: true }),
        createReport("gitlab.com", { u2: true }, { c3: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2025-01-01")),
        createApplication("gitlab.com", true, new Date("2025-01-01")),
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
      ]),
    });
    return report;
  }

  beforeEach(async () => {
    mockDataService = {
      report$: new BehaviorSubject<AccessReportView | null>(null),
    };

    mockSecurityTasksService = {
      tasks$: new BehaviorSubject<SecurityTask[]>([]),
      unassignedCriticalCipherIds$: new BehaviorSubject<string[]>([]),
      loadTasks$: jest.fn().mockReturnValue(of(undefined)),
      requestPasswordChangeForCriticalApplications$: jest.fn().mockReturnValue(of(undefined)),
      getTaskMetrics$: jest.fn().mockReturnValue(of({ completedTasks: 0, totalTasks: 0 })),
    };

    mockToastService = {
      showToast: jest.fn(),
    } as any;

    mockI18nService = {
      t: jest.fn((key: string, ..._args: any[]) => key),
    } as any;

    await TestBed.configureTestingModule({
      imports: [PasswordChangeMetricV2Component],
      providers: [
        { provide: AccessIntelligenceDataService, useValue: mockDataService },
        { provide: SecurityTasksService, useValue: mockSecurityTasksService },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      // NO_ERRORS_SCHEMA on the TestBed module does not apply to standalone component
      // templates — standalone components compile with their own imports. This override
      // suppresses unknown-property errors (e.g. ariaLabel on bit-progress) in the
      // component's own template without requiring real child component implementations.
      .overrideComponent(PasswordChangeMetricV2Component, { set: { schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    fixture = TestBed.createComponent(PasswordChangeMetricV2Component);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("organizationId", orgId);
    fixture.detectChanges();
  });

  describe("Initialization", () => {
    it("should create the component", () => {
      expect(component).toBeTruthy();
    });

    it("should call loadTasks$ with the organizationId on init", () => {
      expect(mockSecurityTasksService.loadTasks$).toHaveBeenCalledWith(orgId);
    });
  });

  describe("currentView States", () => {
    it("returns EMPTY when no report is loaded", () => {
      mockDataService.report$.next(null);
      fixture.detectChanges();

      expect(component.currentView()).toBe(PasswordChangeView.EMPTY);
    });

    it("returns EMPTY when report has no critical applications", () => {
      const report = createRiskInsights({
        reports: [createReport("github.com", {}, { c1: true })],
        applications: [createApplication("github.com", false)],
      });
      mockDataService.report$.next(report);
      fixture.detectChanges();

      expect(component.currentView()).toBe(PasswordChangeView.EMPTY);
    });

    it("returns NO_TASKS_ASSIGNED when critical apps exist but no tasks are loaded", () => {
      mockDataService.report$.next(createReportWithCriticalApps());
      mockSecurityTasksService.tasks$.next([]);
      fixture.detectChanges();

      expect(component.currentView()).toBe(PasswordChangeView.NO_TASKS_ASSIGNED);
    });

    it("returns NEW_TASKS_AVAILABLE when unassigned cipher IDs exist", () => {
      mockDataService.report$.next(createReportWithCriticalApps());
      mockSecurityTasksService.tasks$.next([createTask("t1", "c1", SecurityTaskStatus.Pending)]);
      mockSecurityTasksService.unassignedCriticalCipherIds$.next(["c2", "c3"]);
      fixture.detectChanges();

      expect(component.currentView()).toBe(PasswordChangeView.NEW_TASKS_AVAILABLE);
    });

    it("returns PROGRESS when all tasks are assigned and none are unassigned", () => {
      mockDataService.report$.next(createReportWithCriticalApps());
      mockSecurityTasksService.tasks$.next([
        createTask("t1", "c1", SecurityTaskStatus.Pending),
        createTask("t2", "c2", SecurityTaskStatus.Pending),
      ]);
      mockSecurityTasksService.unassignedCriticalCipherIds$.next([]);
      fixture.detectChanges();

      expect(component.currentView()).toBe(PasswordChangeView.PROGRESS);
    });
  });

  describe("Computed Signals", () => {
    beforeEach(() => {
      mockDataService.report$.next(createReportWithCriticalApps());
      fixture.detectChanges();
    });

    it("tasksCount returns the number of tasks", () => {
      mockSecurityTasksService.tasks$.next([
        createTask("t1", "c1", SecurityTaskStatus.Pending),
        createTask("t2", "c2", SecurityTaskStatus.Completed),
      ]);
      fixture.detectChanges();

      expect(component.tasksCount()).toBe(2);
    });

    it("completedTasksCount returns only completed tasks", () => {
      mockSecurityTasksService.tasks$.next([
        createTask("t1", "c1", SecurityTaskStatus.Pending),
        createTask("t2", "c2", SecurityTaskStatus.Completed),
        createTask("t3", "c3", SecurityTaskStatus.Completed),
      ]);
      fixture.detectChanges();

      expect(component.completedTasksCount()).toBe(2);
    });

    it("completedTasksPercent returns 0 when no tasks", () => {
      mockSecurityTasksService.tasks$.next([]);
      fixture.detectChanges();

      expect(component.completedTasksPercent()).toBe(0);
    });

    it("completedTasksPercent calculates correct percentage", () => {
      mockSecurityTasksService.tasks$.next([
        createTask("t1", "c1", SecurityTaskStatus.Completed),
        createTask("t2", "c2", SecurityTaskStatus.Pending),
        createTask("t3", "c3", SecurityTaskStatus.Pending),
        createTask("t4", "c4", SecurityTaskStatus.Pending),
      ]);
      fixture.detectChanges();

      expect(component.completedTasksPercent()).toBe(25);
    });

    it("atRiskPasswordCount deduplicates cipher IDs", () => {
      // Report has c1, c2 as at-risk in github.com (critical) and c3 as at-risk in gitlab.com (critical)
      // The count should be 3 (deduplicated unique cipher IDs)
      expect(component.atRiskPasswordCount()).toBe(3);
    });

    it("unassignedCipherIds returns count of unassigned cipher IDs", () => {
      mockSecurityTasksService.unassignedCriticalCipherIds$.next(["c1", "c2"]);
      fixture.detectChanges();

      expect(component.unassignedCipherIds()).toBe(2);
    });
  });

  describe("extendWidget Output", () => {
    it("emits false when currentView transitions to EMPTY", () => {
      // First transition to PROGRESS so there is a state to leave.
      // The initial effect() fires during beforeEach.detectChanges() before any subscription
      // exists — so we must trigger a real state change after subscribing.
      mockDataService.report$.next(createReportWithCriticalApps());
      mockSecurityTasksService.tasks$.next([createTask("t1", "c1", SecurityTaskStatus.Pending)]);
      mockSecurityTasksService.unassignedCriticalCipherIds$.next([]);
      fixture.detectChanges();

      const emittedValues: boolean[] = [];
      const subscription = component.extendWidget.subscribe((v) => emittedValues.push(v));

      // Transition to EMPTY — effect fires and emits false
      mockDataService.report$.next(null);
      fixture.detectChanges();

      expect(emittedValues[emittedValues.length - 1]).toBe(false);
      subscription.unsubscribe();
    });

    it("emits true when currentView transitions to PROGRESS", () => {
      const emittedValues: boolean[] = [];
      const subscription = component.extendWidget.subscribe((v) => emittedValues.push(v));

      mockDataService.report$.next(createReportWithCriticalApps());
      mockSecurityTasksService.tasks$.next([createTask("t1", "c1", SecurityTaskStatus.Pending)]);
      mockSecurityTasksService.unassignedCriticalCipherIds$.next([]);
      fixture.detectChanges();

      expect(emittedValues[emittedValues.length - 1]).toBe(true);
      subscription.unsubscribe();
    });

    it("emits false when currentView is NO_TASKS_ASSIGNED", () => {
      const emittedValues: boolean[] = [];
      const subscription = component.extendWidget.subscribe((v) => emittedValues.push(v));

      mockDataService.report$.next(createReportWithCriticalApps());
      mockSecurityTasksService.tasks$.next([]);
      fixture.detectChanges();

      expect(emittedValues[emittedValues.length - 1]).toBe(false);
      subscription.unsubscribe();
    });
  });

  describe("assignTasks", () => {
    beforeEach(() => {
      mockDataService.report$.next(createReportWithCriticalApps());
      mockSecurityTasksService.unassignedCriticalCipherIds$.next(["c1", "c2"]);
      fixture.detectChanges();
    });

    it("calls requestPasswordChangeForCriticalApplications$ with unassigned cipher IDs", () => {
      mockSecurityTasksService.requestPasswordChangeForCriticalApplications$.mockReturnValue(
        of(undefined),
      );

      component.assignTasks();

      expect(
        mockSecurityTasksService.requestPasswordChangeForCriticalApplications$,
      ).toHaveBeenCalledWith(orgId, ["c1", "c2"]);
    });

    it("shows success toast when tasks are assigned successfully", () => {
      mockSecurityTasksService.requestPasswordChangeForCriticalApplications$.mockReturnValue(
        of(undefined),
      );

      component.assignTasks();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("shows 404 error toast when user lacks admin permissions", () => {
      const error = new ErrorResponse({ StatusCode: 404 } as any, 404);
      mockSecurityTasksService.requestPasswordChangeForCriticalApplications$.mockReturnValue(
        throwError(() => error),
      );

      component.assignTasks();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          message: "mustBeOrganizationOwnerAdmin",
        }),
      );
    });

    it("shows generic error toast for unexpected errors", () => {
      mockSecurityTasksService.requestPasswordChangeForCriticalApplications$.mockReturnValue(
        throwError(() => new Error("unexpected")),
      );

      component.assignTasks();

      expect(mockToastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "error",
          message: "unexpectedError",
        }),
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles null report gracefully — atRiskPasswordCount is 0", () => {
      mockDataService.report$.next(null);
      fixture.detectChanges();

      expect(component.atRiskPasswordCount()).toBe(0);
    });

    it("handles empty task list — tasksCount is 0 and completedTasksPercent is 0", () => {
      mockSecurityTasksService.tasks$.next([]);
      fixture.detectChanges();

      expect(component.tasksCount()).toBe(0);
      expect(component.completedTasksPercent()).toBe(0);
    });

    it("handles report with no at-risk ciphers in critical apps — atRiskPasswordCount is 0", () => {
      const report = createRiskInsights({
        reports: [createReport("github.com", {}, { c1: false })],
        applications: [createApplication("github.com", true)],
      });
      mockDataService.report$.next(report);
      fixture.detectChanges();

      expect(component.atRiskPasswordCount()).toBe(0);
    });
  });
});
