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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, I18nMockService } from "@bitwarden/components";

import { AllActivityV2Component } from "./all-activity-v2.component";

const orgId = "org-123" as OrganizationId;

/**
 * Mock AccessIntelligenceDataService for Storybook stories
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

  setReport(report: AccessReportView | null) {
    this._report.next(report);
  }

  setLoading(loading: boolean) {
    this._loading.next(loading);
  }
}

/**
 * Mock DrawerStateService for Storybook stories
 */
class MockDrawerStateService {
  openDrawer = action("openDrawer");
  closeDrawer = action("closeDrawer");
}

/**
 * Mock DialogService for Storybook stories
 */
class MockDialogService {
  open = action("DialogService.open");
}

export default {
  title: "Access Intelligence/V2/AllActivityV2",
  component: AllActivityV2Component,
  decorators: [
    moduleMetadata({
      imports: [AllActivityV2Component],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              accessIntelligence: "Access Intelligence",
              allActivity: "All Activity",
              applications: "Applications",
              atRiskMembers: "At-Risk Members",
              atRiskApplications: "At-Risk Applications",
              criticalApplications: "Critical Applications",
              newApplications: "New Applications",
              reviewNewApplications: "Review New Applications",
              allCaughtUp: "You're all caught up!",
              noNewApplications: "No new applications to review",
              needsReview: "Review your applications",
              passwordChangeProgress: "Password Change Progress",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [provideRouter([])],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/ACCESS_INTELLIGENCE_FIGMA_URL",
    },
  },
} as Meta<AllActivityV2Component>;

type Story = StoryObj<AllActivityV2Component>;

/**
 * Default story - Normal state with data showing critical apps, at-risk members, and new applications
 */
export const Default: Story = {
  render: (args) => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false, u3: true }, { c1: true, c2: false }),
        createReport("gitlab.com", { u4: true, u5: false }, { c4: true, c5: false }),
        createReport("bitbucket.org", { u6: true }, { c6: true }),
        createReport("aws.amazon.com", { u7: true, u8: true }, { c7: true, c8: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date()), // Critical, reviewed
        createApplication("gitlab.com", true, new Date()), // Critical, reviewed
        createApplication("bitbucket.org", false, undefined), // New, not reviewed
        createApplication("aws.amazon.com", false, undefined), // New, not reviewed
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
      ]),
    });

    report.recomputeSummary();

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * Loading state - Shows loading spinner while data is being fetched
 */
export const Loading: Story = {
  render: (args) => {
    const mockService = new MockAccessIntelligenceDataService(null, true);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * Empty State - No data has been loaded yet (first time setup)
 */
export const EmptyState: Story = {
  render: (args) => {
    const emptyReport = createRiskInsights({
      organizationId: orgId,
      reports: [],
      applications: [],
      memberRegistry: {},
    });

    const mockService = new MockAccessIntelligenceDataService(emptyReport);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * No Critical Apps - Has applications but none are marked as critical
 */
export const NoCriticalApps: Story = {
  render: (args) => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("bitbucket.org", { u4: false }, { c4: false }),
      ],
      applications: [
        createApplication("github.com", false, new Date()), // Not critical, reviewed
        createApplication("gitlab.com", false, new Date()), // Not critical, reviewed
        createApplication("bitbucket.org", false, new Date()), // Not critical, reviewed
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
        { id: "u4", name: "Diana Wilson", email: "diana@example.com" },
      ]),
    });

    report.recomputeSummary();

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * All Caught Up - All applications reviewed, no new applications
 */
export const AllCaughtUp: Story = {
  render: (args) => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("bitbucket.org", { u4: false }, { c4: false }),
        createReport("aws.amazon.com", { u5: true }, { c5: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date()), // Critical, reviewed
        createApplication("gitlab.com", true, new Date()), // Critical, reviewed
        createApplication("bitbucket.org", false, new Date()), // Not critical, reviewed
        createApplication("aws.amazon.com", true, new Date()), // Critical, reviewed
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
        { id: "u4", name: "Diana Wilson", email: "diana@example.com" },
        { id: "u5", name: "Eve Martinez", email: "eve@example.com" },
      ]),
    });

    report.recomputeSummary();

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * Needs Review - All applications are new (first-time setup state)
 */
export const NeedsReview: Story = {
  render: (args) => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("bitbucket.org", { u4: true }, { c4: true }),
        createReport("aws.amazon.com", { u5: true, u6: true }, { c5: true, c6: true }),
        createReport("azure.microsoft.com", { u7: true }, { c7: true }),
      ],
      applications: [
        createApplication("github.com", false, undefined), // New
        createApplication("gitlab.com", false, undefined), // New
        createApplication("bitbucket.org", false, undefined), // New
        createApplication("aws.amazon.com", false, undefined), // New
        createApplication("azure.microsoft.com", false, undefined), // New
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

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * Mixed State - Some critical, some new, some reviewed
 */
export const MixedState: Story = {
  render: (args) => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false, u3: true }, { c1: true, c2: false }),
        createReport("gitlab.com", { u4: true, u5: false }, { c4: true, c5: false }),
        createReport("bitbucket.org", { u6: true }, { c6: true }),
        createReport("aws.amazon.com", { u7: true, u8: true }, { c7: true, c8: true }),
        createReport("azure.microsoft.com", { u9: true }, { c9: true }),
        createReport("salesforce.com", { u10: false }, { c10: false }),
        createReport("slack.com", { u11: true }, { c11: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2024-01-15")), // Critical, reviewed
        createApplication("gitlab.com", true, new Date("2024-01-20")), // Critical, reviewed
        createApplication("bitbucket.org", false, new Date("2024-02-01")), // Not critical, reviewed
        createApplication("aws.amazon.com", true, undefined), // Critical (legacy), no review date
        createApplication("azure.microsoft.com", false, undefined), // New, not reviewed
        createApplication("salesforce.com", false, new Date("2024-02-10")), // Not critical, reviewed
        createApplication("slack.com", false, undefined), // New, not reviewed
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
        { id: "u11", name: "Kate Moore", email: "kate@example.com" },
      ]),
    });

    report.recomputeSummary();

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * Large Dataset - Many applications (50+) for performance testing
 */
export const LargeDataset: Story = {
  render: (args) => {
    const reports = [];
    const applications = [];
    const members: Array<{ id: string; name: string; email: string }> = [];

    // Generate 50 applications
    for (let i = 0; i < 50; i++) {
      const appName = `application-${i}.example.com`;
      const isCritical = i % 3 === 0; // Every 3rd app is critical
      const isReviewed = i % 2 === 0; // Every other app is reviewed
      const reviewedDate = isReviewed ? new Date() : undefined;

      // Generate member refs
      const memberRefs: Record<string, boolean> = {};
      const cipherRefs: Record<string, boolean> = {};

      for (let j = 0; j < 5; j++) {
        const memberId = `u${i * 5 + j}`;
        const cipherId = `c${i * 5 + j}`;
        memberRefs[memberId] = j % 2 === 0; // Half are at-risk
        cipherRefs[cipherId] = j % 2 === 0;

        // Add unique members
        if (i === 0 || j === 0) {
          members.push({
            id: memberId,
            name: `User ${i * 5 + j}`,
            email: `user${i * 5 + j}@example.com`,
          });
        }
      }

      reports.push(createReport(appName, memberRefs, cipherRefs));
      applications.push(createApplication(appName, isCritical, reviewedDate));
    }

    const report = createRiskInsights({
      organizationId: orgId,
      reports,
      applications,
      memberRegistry: createMemberRegistry(members),
    });

    report.recomputeSummary();

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * Critical Apps At Risk - Shows high-risk scenario with many critical applications and at-risk members
 */
export const CriticalAppsAtRisk: Story = {
  render: (args) => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport(
          "github.com",
          { u1: true, u2: true, u3: true, u4: true },
          { c1: true, c2: true, c3: true, c4: true },
        ),
        createReport(
          "gitlab.com",
          { u5: true, u6: true, u7: true },
          { c5: true, c6: true, c7: true },
        ),
        createReport("aws.amazon.com", { u8: true, u9: true }, { c8: true, c9: true }),
        createReport(
          "azure.microsoft.com",
          { u10: true, u11: true, u12: true },
          { c10: true, c11: true, c12: true },
        ),
        createReport("salesforce.com", { u13: true, u14: true }, { c13: true, c14: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date()), // Critical
        createApplication("gitlab.com", true, new Date()), // Critical
        createApplication("aws.amazon.com", true, new Date()), // Critical
        createApplication("azure.microsoft.com", true, new Date()), // Critical
        createApplication("salesforce.com", true, new Date()), // Critical
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
        { id: "u11", name: "Kate Moore", email: "kate@example.com" },
        { id: "u12", name: "Liam Jackson", email: "liam@example.com" },
        { id: "u13", name: "Mia White", email: "mia@example.com" },
        { id: "u14", name: "Noah Harris", email: "noah@example.com" },
      ]),
    });

    report.recomputeSummary();

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};

/**
 * Single New Application - Minimal case for testing
 */
export const SingleNewApplication: Story = {
  render: (args) => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [createReport("github.com", { u1: true }, { c1: true })],
      applications: [createApplication("github.com", false, undefined)], // New
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
      ]),
    });

    report.recomputeSummary();

    const mockService = new MockAccessIntelligenceDataService(report);

    return {
      props: {
        organizationId: orgId,
      },
      moduleMetadata: {
        providers: [
          { provide: AccessIntelligenceDataService, useValue: mockService },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: DialogService, useClass: MockDialogService },
        ],
      },
    };
  },
};
