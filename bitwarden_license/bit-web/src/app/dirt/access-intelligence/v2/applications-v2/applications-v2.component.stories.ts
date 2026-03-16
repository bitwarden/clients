import { signal } from "@angular/core";
import { provideRouter } from "@angular/router";
import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";
import { action } from "storybook/actions";

import {
  AccessIntelligenceDataService,
  DrawerStateService,
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
import { I18nMockService, ToastService } from "@bitwarden/components";

import { SecurityTasksService } from "../services/abstractions/security-tasks.service";

import { ApplicationsV2Component } from "./applications-v2.component";

const orgId = "org-123" as OrganizationId;

/**
 * Mock AccessIntelligenceDataService for Storybook stories.
 * Uses private subjects exposed via asObservable() per team standards.
 */
class MockAccessIntelligenceDataService {
  private _report = new BehaviorSubject<AccessReportView | null>(null);
  readonly report$ = this._report.asObservable();

  private _loading = new BehaviorSubject<boolean>(false);
  readonly loading$ = this._loading.asObservable();

  private _ciphers = new BehaviorSubject<CipherView[]>([]);
  readonly ciphers$ = this._ciphers.asObservable();

  constructor(initialReport: AccessReportView | null = null, isLoading = false) {
    this._report.next(initialReport);
    this._loading.next(isLoading);
  }

  markApplicationsAsCritical$ = action("markApplicationsAsCritical$");
  unmarkApplicationsAsCritical$ = action("unmarkApplicationsAsCritical$");
}

/**
 * Mock DrawerStateService for Storybook stories.
 */
class MockDrawerStateService {
  openDrawer = action("openDrawer");
  closeDrawer = action("closeDrawer");
  readonly drawerState = signal(null);
}

/**
 * Mock AccessIntelligenceSecurityTasksService for Storybook stories.
 */
class MockSecurityTasksService {
  private _cipherIds = new BehaviorSubject<CipherId[]>([]);
  readonly unassignedCriticalCipherIds$ = this._cipherIds.asObservable();

  requestPasswordChangeForCriticalApplications$ = action(
    "requestPasswordChangeForCriticalApplications$",
  );

  constructor(cipherIds: CipherId[] = []) {
    this._cipherIds.next(cipherIds);
  }
}

/**
 * Mock FileDownloadService for Storybook stories.
 */
class MockFileDownloadService {
  download = action("FileDownloadService.download");
}

/**
 * Mock LogService for Storybook stories.
 */
class MockLogService {
  error = action("LogService.error");
}

/**
 * Mock ToastService for Storybook stories.
 */
class MockToastService {
  showToast = action("ToastService.showToast");
}

export default {
  title: "Access Intelligence/V2/ApplicationsV2",
  component: ApplicationsV2Component,
  decorators: [
    moduleMetadata({
      imports: [ApplicationsV2Component],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              searchApps: "Search apps",
              filter: "Filter",
              critical: "Critical ({{0}})",
              notCritical: "Not Critical ({{0}})",
              markAppCountAsCritical: "Mark {{0}} as Critical",
              markAppCountAsNotCritical: "Unmark {{0}} as Critical",
              assignTasks: "Assign Tasks",
              allTasksAssigned: "All tasks assigned",
              downloadCSV: "Download CSV",
              noApplicationsMatchTheseFilters: "No applications match these filters",
              application: "Application",
              atRiskPasswords: "At-Risk Credentials",
              totalPasswords: "Total Credentials",
              atRiskMembers: "At-Risk Members",
              totalMembers: "Total Members",
              criticalBadge: "Critical",
              yes: "Yes",
              no: "No",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [provideRouter([])],
    }),
  ],
} as Meta<ApplicationsV2Component>;

type Story = StoryObj<ApplicationsV2Component>;

/**
 * Default story - Applications table with a mix of critical and non-critical apps
 */
export const Default: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false, u3: true }, { c1: true, c2: false }),
        createReport("gitlab.com", { u4: true, u5: false }, { c4: true, c5: false }),
        createReport("bitbucket.org", { u6: true }, { c6: true }),
        createReport("aws.amazon.com", { u7: true, u8: true }, { c7: true, c8: true }),
        createReport("azure.microsoft.com", { u9: true }, { c9: false }),
        createReport("salesforce.com", { u10: false }, { c10: false }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2024-01-15")),
        createApplication("gitlab.com", true, new Date("2024-01-20")),
        createApplication("bitbucket.org", false, new Date("2024-02-01")),
        createApplication("aws.amazon.com", true, new Date("2024-02-10")),
        createApplication("azure.microsoft.com", false, new Date("2024-02-15")),
        createApplication("salesforce.com", false, new Date("2024-02-20")),
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
        { id: "u4", name: "Diana Wilson", email: "diana@example.com" },
        { id: "u5", name: "Eve Martinez", email: "eve@example.com" },
        { id: "u6", name: "Frank Brown", email: "frank@example.com" },
        { id: "u7", name: "Grace Lee", email: "grace@example.com" },
        { id: "u8", name: "Henry Taylor", email: "henry@example.com" },
        { id: "u9", name: "Ivy Anderson", email: "ivy@example.com" },
        { id: "u10", name: "Jack Thomas", email: "jack@example.com" },
      ]),
    });

    report.recomputeSummary();

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: SecurityTasksService, useClass: MockSecurityTasksService },
          { provide: FileDownloadService, useClass: MockFileDownloadService },
          { provide: LogService, useClass: MockLogService },
          { provide: ToastService, useClass: MockToastService },
        ],
      },
    };
  },
};

/**
 * Loading state - Shows loading spinner while data is being fetched
 */
export const Loading: Story = {
  render: () => ({
    props: { organizationId: orgId },
    moduleMetadata: {
      providers: [
        {
          provide: AccessIntelligenceDataService,
          useValue: new MockAccessIntelligenceDataService(null, true),
        },
        { provide: DrawerStateService, useClass: MockDrawerStateService },
        { provide: SecurityTasksService, useClass: MockSecurityTasksService },
        { provide: FileDownloadService, useClass: MockFileDownloadService },
        { provide: LogService, useClass: MockLogService },
        { provide: ToastService, useClass: MockToastService },
      ],
    },
  }),
};

/**
 * Empty state - No report data loaded yet
 */
export const Empty: Story = {
  render: () => {
    const emptyReport = createRiskInsights({
      organizationId: orgId,
      reports: [],
      applications: [],
      memberRegistry: {},
    });

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(emptyReport),
          },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: SecurityTasksService, useClass: MockSecurityTasksService },
          { provide: FileDownloadService, useClass: MockFileDownloadService },
          { provide: LogService, useClass: MockLogService },
          { provide: ToastService, useClass: MockToastService },
        ],
      },
    };
  },
};

/**
 * All Critical - All applications are marked as critical
 */
export const AllCritical: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: true }, { c1: true, c2: true }),
        createReport("gitlab.com", { u3: true, u4: true }, { c3: true, c4: true }),
        createReport("aws.amazon.com", { u5: true }, { c5: true }),
        createReport("azure.microsoft.com", { u6: true, u7: true }, { c6: true, c7: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2024-01-15")),
        createApplication("gitlab.com", true, new Date("2024-01-20")),
        createApplication("aws.amazon.com", true, new Date("2024-02-01")),
        createApplication("azure.microsoft.com", true, new Date("2024-02-10")),
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
        { id: "u4", name: "Diana Wilson", email: "diana@example.com" },
        { id: "u5", name: "Eve Martinez", email: "eve@example.com" },
        { id: "u6", name: "Frank Brown", email: "frank@example.com" },
        { id: "u7", name: "Grace Lee", email: "grace@example.com" },
      ]),
    });

    report.recomputeSummary();

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: SecurityTasksService, useClass: MockSecurityTasksService },
          { provide: FileDownloadService, useClass: MockFileDownloadService },
          { provide: LogService, useClass: MockLogService },
          { provide: ToastService, useClass: MockToastService },
        ],
      },
    };
  },
};

/**
 * With Unassigned Tasks - Request password change button is enabled
 */
export const WithUnassignedTasks: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u2: true }, { c2: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2024-01-15")),
        createApplication("gitlab.com", true, new Date("2024-01-20")),
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
      ]),
    });

    report.recomputeSummary();

    // Non-empty cipher IDs means the "Assign Tasks" button is enabled
    const securityTasksService = new MockSecurityTasksService([
      "cipher-1" as CipherId,
      "cipher-2" as CipherId,
    ]);

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: SecurityTasksService, useValue: securityTasksService },
          { provide: FileDownloadService, useClass: MockFileDownloadService },
          { provide: LogService, useClass: MockLogService },
          { provide: ToastService, useClass: MockToastService },
        ],
      },
    };
  },
};

/**
 * Large Dataset - 50 applications for performance testing (deterministic data)
 */
export const LargeDataset: Story = {
  render: () => {
    const reportData = [];
    const applications = [];
    const members: Array<{ id: string; name: string; email: string }> = [];

    // Generate 50 deterministic applications
    for (let i = 0; i < 50; i++) {
      const appName = `application-${i + 1}.example.com`;
      const isCritical = i % 3 === 0; // Every 3rd app is critical (deterministic)
      const reviewedDate = new Date("2024-01-01");
      reviewedDate.setDate(reviewedDate.getDate() + i); // Deterministic date progression

      const memberRefs: Record<string, boolean> = {};
      const cipherRefs: Record<string, boolean> = {};

      // 3 members per app, alternating at-risk pattern
      for (let j = 0; j < 3; j++) {
        const memberId = `u${i * 3 + j}`;
        const cipherId = `c${i * 3 + j}`;
        memberRefs[memberId] = j % 2 === 0;
        cipherRefs[cipherId] = j % 2 === 0;
        members.push({
          id: memberId,
          name: `User ${i * 3 + j + 1}`,
          email: `user${i * 3 + j + 1}@example.com`,
        });
      }

      reportData.push(createReport(appName, memberRefs, cipherRefs));
      applications.push(createApplication(appName, isCritical, reviewedDate));
    }

    const report = createRiskInsights({
      organizationId: orgId,
      reports: reportData,
      applications,
      memberRegistry: createMemberRegistry(members),
    });

    report.recomputeSummary();

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: SecurityTasksService, useClass: MockSecurityTasksService },
          { provide: FileDownloadService, useClass: MockFileDownloadService },
          { provide: LogService, useClass: MockLogService },
          { provide: ToastService, useClass: MockToastService },
        ],
      },
    };
  },
};

/**
 * No Critical Apps - All applications are non-critical
 */
export const NoCriticalApps: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false }, { c1: true }),
        createReport("gitlab.com", { u3: true }, { c2: true }),
        createReport("bitbucket.org", { u4: false }, { c3: false }),
      ],
      applications: [
        createApplication("github.com", false, new Date("2024-01-15")),
        createApplication("gitlab.com", false, new Date("2024-01-20")),
        createApplication("bitbucket.org", false, new Date("2024-02-01")),
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
        { id: "u4", name: "Diana Wilson", email: "diana@example.com" },
      ]),
    });

    report.recomputeSummary();

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: SecurityTasksService, useClass: MockSecurityTasksService },
          { provide: FileDownloadService, useClass: MockFileDownloadService },
          { provide: LogService, useClass: MockLogService },
          { provide: ToastService, useClass: MockToastService },
        ],
      },
    };
  },
};
