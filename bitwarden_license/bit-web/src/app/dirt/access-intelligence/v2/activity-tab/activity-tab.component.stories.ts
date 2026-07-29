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
import { OrganizationId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";

import { AccessIntelligenceCoachmarkService } from "../../onboarding/access-intelligence-coachmark.service";
import {
  buildActivityTabProviders,
  MockAccessIntelligenceCoachmarkService,
  createAccessIntelligenceI18nMock,
  MockToastService,
  populatedTrendData,
  MockAccessIntelligenceDataService,
} from "../testing";

import { ActivityTabComponent } from "./activity-tab.component";

const orgId = "org-123" as OrganizationId;

export default {
  title: "DIRT/Access Intelligence/Activity Tab",
  component: ActivityTabComponent,
  decorators: [
    moduleMetadata({
      imports: [ActivityTabComponent],
      providers: [
        { provide: I18nService, useFactory: createAccessIntelligenceI18nMock },
        { provide: ToastService, useClass: MockToastService },
        { provide: AccessIntelligenceDataService, useClass: MockAccessIntelligenceDataService },
        {
          provide: AccessIntelligenceCoachmarkService,
          useClass: MockAccessIntelligenceCoachmarkService,
        },
      ],
    }),
    applicationConfig({
      providers: [provideRouter([]), provideLocationMocks()],
    }),
  ],
} as Meta<ActivityTabComponent>;

type Story = StoryObj<ActivityTabComponent>;

/**
 * Default story - Normal state with data showing critical apps, at-risk members, and new applications
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
      ],
      applications: [
        createApplication("github.com", true, new Date("2024-01-15")), // Critical, reviewed
        createApplication("gitlab.com", true, new Date("2024-01-20")), // Critical, reviewed
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

    return {
      props: { organizationId: orgId },
      moduleMetadata: { providers: buildActivityTabProviders(report) },
    };
  },
};

/**
 * Loading state - Shows loading spinner while data is being fetched
 */
export const Loading: Story = {
  render: () => ({
    props: { organizationId: orgId },
    moduleMetadata: { providers: buildActivityTabProviders(null, { loading: true }) },
  }),
};

/**
 * Empty State - No data has been loaded yet (first time setup)
 */
export const EmptyState: Story = {
  render: () => {
    const emptyReport = createRiskInsights({
      organizationId: orgId,
      reports: [],
      applications: [],
      memberRegistry: {},
    });

    return {
      props: { organizationId: orgId },
      moduleMetadata: { providers: buildActivityTabProviders(emptyReport) },
    };
  },
};

/**
 * All Caught Up - All applications reviewed, no new applications
 */
export const AllCaughtUp: Story = {
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("bitbucket.org", { u4: false }, { c4: false }),
        createReport("aws.amazon.com", { u5: true }, { c5: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2024-01-15")), // Critical, reviewed
        createApplication("gitlab.com", true, new Date("2024-01-20")), // Critical, reviewed
        createApplication("bitbucket.org", false, new Date("2024-02-01")), // Not critical, reviewed
        createApplication("aws.amazon.com", true, new Date("2024-02-10")), // Critical, reviewed
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

    return {
      props: { organizationId: orgId },
      moduleMetadata: { providers: buildActivityTabProviders(report) },
    };
  },
};

/**
 * Needs Review - All applications are new (first-time setup state)
 */
export const NeedsReview: Story = {
  render: () => {
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

    return {
      props: { organizationId: orgId },
      moduleMetadata: { providers: buildActivityTabProviders(report) },
    };
  },
};

/**
 * Trend Chart - widget visible with populated data
 */
export const TrendChart: Story = {
  // The trend chart derives its x-axis from the current date, so the rendered
  // chart is non-deterministic. Snapshotting will be re-enabled in a follow-up that
  // pins the chart's reference clock. Matches the trend-widget stories
  // until the drifting date issue is resolved.
  parameters: { chromatic: { disableSnapshot: true } },
  render: () => {
    const report = createRiskInsights({
      organizationId: orgId,
      reports: [
        createReport("github.com", { u1: true, u2: false }, { c1: true }),
        createReport("gitlab.com", { u3: true }, { c2: true }),
      ],
      applications: [
        createApplication("github.com", true, new Date("2024-01-15")),
        createApplication("gitlab.com", true, new Date("2024-01-20")),
      ],
      memberRegistry: createMemberRegistry([
        { id: "u1", name: "Alice Smith", email: "alice@example.com" },
        { id: "u2", name: "Bob Johnson", email: "bob@example.com" },
        { id: "u3", name: "Charlie Davis", email: "charlie@example.com" },
      ]),
    });

    report.recomputeSummary();

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: buildActivityTabProviders(report, {
          trend: { data: populatedTrendData },
        }),
      },
    };
  },
};
