import { provideLocationMocks } from "@angular/common/testing";
import { provideRouter } from "@angular/router";
import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";

import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import {
  createApplication,
  createMemberRegistry,
  createReport,
  createRiskInsights,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, OrganizationId, SecurityTaskId } from "@bitwarden/common/types/guid";
import { SecurityTask, SecurityTaskStatus, SecurityTaskType } from "@bitwarden/common/vault/tasks";
import { ToastService } from "@bitwarden/components";

import { AccessSecurityTasksService } from "../../services/abstractions/access-security-tasks.service";
import {
  MockAccessIntelligenceDataService,
  MockSecurityTasksService,
  MockToastService,
  createAccessIntelligenceI18nMock,
} from "../../testing";

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

export default {
  title: "DIRT/Access Intelligence/Activity Tab/Password Change Metric",
  component: PasswordChangeMetricV2Component,
  decorators: [
    moduleMetadata({
      imports: [PasswordChangeMetricV2Component],
      providers: [
        { provide: I18nService, useFactory: createAccessIntelligenceI18nMock },
        { provide: ToastService, useClass: MockToastService },
      ],
    }),
    applicationConfig({
      providers: [provideRouter([]), provideLocationMocks()],
    }),
  ],
} as Meta<PasswordChangeMetricV2Component>;

type Story = StoryObj<PasswordChangeMetricV2Component>;

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
          { provide: AccessSecurityTasksService, useValue: new MockSecurityTasksService() },
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
            provide: AccessSecurityTasksService,
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
            provide: AccessSecurityTasksService,
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
            provide: AccessSecurityTasksService,
            useValue: new MockSecurityTasksService(tasks, []), // all tasks assigned, none unassigned
          },
        ],
      },
    };
  },
};
