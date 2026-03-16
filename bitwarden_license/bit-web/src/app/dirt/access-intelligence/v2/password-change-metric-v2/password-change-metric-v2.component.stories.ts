import { provideRouter } from "@angular/router";
import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";
import { action } from "storybook/actions";

import { AccessReportView } from "@bitwarden/bit-common/dirt/access-intelligence/models";
import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import { TaskMetrics } from "@bitwarden/bit-common/dirt/reports/risk-insights/services";
import {
  createApplication,
  createMemberRegistry,
  createReport,
  createRiskInsights,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId, SecurityTaskId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { I18nMockService, ToastService } from "@bitwarden/components";

import { SecurityTasksService } from "../services/abstractions/security-tasks.service";

import { PasswordChangeMetricV2Component } from "./password-change-metric-v2.component";

const orgId = "org-123" as OrganizationId;

/** Creates a SecurityTask for story/test data (deterministic) */
function createTask(id: string, cipherId: string, status: SecurityTaskStatus): SecurityTask {
  return Object.assign(new SecurityTask({} as any), {
    id: id as SecurityTaskId,
    organizationId: orgId,
    cipherId: cipherId as CipherId,
    type: SecurityTaskType.UpdateAtRiskCredential,
    status,
    creationDate: new Date("2025-01-01"),
    revisionDate: new Date("2025-01-15"),
  });
}

/**
 * Mock AccessIntelligenceDataService for Storybook stories
 */
class MockAccessIntelligenceDataService {
  private _report = new BehaviorSubject<AccessReportView | null>(null);
  readonly report$ = this._report.asObservable();

  private _loading = new BehaviorSubject<boolean>(false);
  readonly loading$ = this._loading.asObservable();

  constructor(initialReport: AccessReportView | null = null) {
    this._report.next(initialReport);
  }
}

/**
 * Mock SecurityTasksService for Storybook stories
 */
class MockSecurityTasksService {
  private _tasks = new BehaviorSubject<SecurityTask[]>([]);
  readonly tasks$ = this._tasks.asObservable();

  private _unassignedCipherIds = new BehaviorSubject<string[]>([]);
  readonly unassignedCriticalCipherIds$ = this._unassignedCipherIds.asObservable();

  constructor(tasks: SecurityTask[] = [], unassignedCipherIds: string[] = []) {
    this._tasks.next(tasks);
    this._unassignedCipherIds.next(unassignedCipherIds);
  }

  loadTasks$ = () => of(undefined as void);
  requestPasswordChangeForCriticalApplications$ = action(
    "requestPasswordChangeForCriticalApplications$",
  );
  getTaskMetrics$ = (_orgId: OrganizationId) =>
    new BehaviorSubject<TaskMetrics>({ completedTasks: 0, totalTasks: 0 }).asObservable();
}

export default {
  title: "Access Intelligence/V2/PasswordChangeMetricV2",
  component: PasswordChangeMetricV2Component,
  decorators: [
    moduleMetadata({
      imports: [PasswordChangeMetricV2Component],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              passwordChangeProgress: "Credential Change Progress",
              assignMembersTasksToMonitorProgress: "Assign members tasks to monitor progress",
              onceYouReviewApplications:
                "Once you review applications and mark them as critical, you can assign tasks to members.",
              countOfAtRiskPasswords: (n: string | undefined) => `${n} password(s) at risk`,
              assignTasks: "Assign Tasks",
              newPasswordsAtRisk: (n: string | undefined) => `${n} new password(s) at risk`,
              percentageCompleted: (n: string | undefined) => `${n}% Completed`,
              securityTasksCompleted: (completed: string | undefined, total: string | undefined) =>
                `${completed} of ${total} tasks completed`,
              passwordChangeProgressBar: "Credential change progress bar",
              success: "Success",
              notifiedMembers: "Members have been notified",
              error: "Error",
              unexpectedError: "An unexpected error occurred",
              mustBeOrganizationOwnerAdmin:
                "You must be an organization owner or admin to perform this action",
            });
          },
        },
        {
          provide: ToastService,
          useValue: { showToast: action("ToastService.showToast") },
        },
      ],
    }),
    applicationConfig({
      providers: [provideRouter([])],
    }),
  ],
} as Meta<PasswordChangeMetricV2Component>;

type Story = StoryObj<PasswordChangeMetricV2Component>;

/**
 * Default (Empty) — no report data loaded, no critical applications
 * Shows the initial EMPTY state prompt
 */
export const Default: Story = {
  render: () => {
    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(null),
          },
          { provide: SecurityTasksService, useValue: new MockSecurityTasksService() },
        ],
      },
    };
  },
};

/**
 * NoCriticalApplications — report loaded but no apps marked critical
 * Shows EMPTY state with prompt to review and mark applications as critical
 */
export const NoCriticalApplications: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      creationDate: new Date("2025-01-01"),
      reports: [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u2: false }, { c2: false }),
      ],
      applications: [
        createApplication("github.com", false, new Date("2025-01-01")),
        createApplication("gitlab.com", false, new Date("2025-01-01")),
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
      ]),
    });

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          { provide: SecurityTasksService, useValue: new MockSecurityTasksService() },
        ],
      },
    };
  },
};

/**
 * NoTasksAssigned — critical apps with at-risk ciphers, but no tasks sent yet
 * Shows NO_TASKS_ASSIGNED state with at-risk password count and "Assign Tasks" button
 */
export const NoTasksAssigned: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      creationDate: new Date("2025-01-01"),
      reports: [
        createReport("github.com", { u1: true, u2: true }, { c1: true, c2: true, c3: false }),
        createReport("gitlab.com", { u3: true }, { c4: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2025-01-01")), // critical
        createApplication("gitlab.com", true, new Date("2025-01-01")), // critical
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
      ]),
    });

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          {
            provide: SecurityTasksService,
            useValue: new MockSecurityTasksService([], []), // no tasks, no unassigned (derived from report)
          },
        ],
      },
    };
  },
};

/**
 * NewTasksAvailable — some tasks assigned but new at-risk ciphers detected
 * Shows NEW_TASKS_AVAILABLE state with count of new unassigned ciphers
 */
export const NewTasksAvailable: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      creationDate: new Date("2025-01-01"),
      reports: [
        createReport("github.com", { u1: true, u2: true }, { c1: true, c2: true, c3: true }),
      ],
      applications: [createApplication("github.com", true, new Date("2025-01-01"))],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
      ]),
    });

    const existingTasks = [
      createTask("task-1", "c1", SecurityTaskStatus.Pending),
      createTask("task-2", "c2", SecurityTaskStatus.Pending),
    ];

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          {
            provide: SecurityTasksService,
            // c3 is unassigned (new at-risk cipher without a task)
            useValue: new MockSecurityTasksService(existingTasks, ["c3"]),
          },
        ],
      },
    };
  },
};

/**
 * Progress — all tasks assigned, showing completion progress
 * Shows PROGRESS state with progress bar (component spans 2 columns in parent)
 */
export const Progress: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      creationDate: new Date("2025-01-01"),
      reports: [
        createReport(
          "github.com",
          { u1: true, u2: true, u3: true },
          { c1: true, c2: true, c3: true, c4: true },
        ),
      ],
      applications: [createApplication("github.com", true, new Date("2025-01-01"))],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
      ]),
    });

    const tasks = [
      createTask("task-1", "c1", SecurityTaskStatus.Completed),
      createTask("task-2", "c2", SecurityTaskStatus.Completed),
      createTask("task-3", "c3", SecurityTaskStatus.Pending),
      createTask("task-4", "c4", SecurityTaskStatus.Pending),
    ];

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          {
            provide: SecurityTasksService,
            useValue: new MockSecurityTasksService(tasks, []), // all tasks assigned, none unassigned
          },
        ],
      },
    };
  },
};
