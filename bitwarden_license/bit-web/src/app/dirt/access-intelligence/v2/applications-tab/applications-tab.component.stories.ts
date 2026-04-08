import { provideLocationMocks } from "@angular/common/testing";
import { provideRouter } from "@angular/router";
import {
  Meta,
  StoryObj,
  moduleMetadata,
  applicationConfig,
  componentWrapperDecorator,
} from "@storybook/angular";
import { BehaviorSubject } from "rxjs";

import {
  AccessIntelligenceDataService,
  DrawerStateService,
} from "@bitwarden/bit-common/dirt/access-intelligence";
import {
  createApplication,
  createMemberRegistry,
  createReport,
  createRiskInsights,
} from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, CipherId } from "@bitwarden/common/types/guid";
import { ScrollLayoutHostDirective, ToastService } from "@bitwarden/components";

import { AccessSecurityTasksService } from "../services/abstractions/access-security-tasks.service";
import {
  MockAccessIntelligenceDataService,
  MockDrawerStateService,
  MockFileDownloadService,
  MockLogService,
  MockSecurityTasksService,
  MockToastService,
  createAccessIntelligenceI18nMock,
} from "../testing";

import { ApplicationsTabComponent } from "./applications-tab.component";

const orgId = "org-123" as OrganizationId;

export default {
  title: "DIRT/Access Intelligence/Applications Tab",
  component: ApplicationsTabComponent,
  decorators: [
    componentWrapperDecorator(
      (story) =>
        `<div bitScrollLayoutHost class="tw-flex tw-flex-col tw-h-[600px] tw-w-full tw-min-w-[1100px] tw-px-4">${story}</div>`,
    ),
    moduleMetadata({
      imports: [ApplicationsTabComponent, ScrollLayoutHostDirective],
      providers: [{ provide: I18nService, useFactory: createAccessIntelligenceI18nMock }],
    }),
    applicationConfig({
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: EnvironmentService,
          useValue: {
            environment$: new BehaviorSubject({
              getIconsUrl: () => "",
            } as Environment).asObservable(),
          } as Partial<EnvironmentService>,
        },
        {
          provide: DomainSettingsService,
          useValue: {
            showFavicons$: new BehaviorSubject(true).asObservable(),
            getShowFavicon: () => true,
          } as Partial<DomainSettingsService>,
        },
      ],
    }),
  ],
  parameters: {
    layout: "fullscreen",
  },
} as Meta<ApplicationsTabComponent>;

type Story = StoryObj<ApplicationsTabComponent>;

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
          { provide: AccessSecurityTasksService, useClass: MockSecurityTasksService },
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
        { provide: AccessSecurityTasksService, useClass: MockSecurityTasksService },
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
          { provide: AccessSecurityTasksService, useClass: MockSecurityTasksService },
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
    const securityTasksService = new MockSecurityTasksService(
      [],
      ["cipher-1" as CipherId, "cipher-2" as CipherId],
    );

    return {
      props: { organizationId: orgId },
      moduleMetadata: {
        providers: [
          {
            provide: AccessIntelligenceDataService,
            useValue: new MockAccessIntelligenceDataService(report),
          },
          { provide: DrawerStateService, useClass: MockDrawerStateService },
          { provide: AccessSecurityTasksService, useValue: securityTasksService },
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
          { provide: AccessSecurityTasksService, useClass: MockSecurityTasksService },
          { provide: FileDownloadService, useClass: MockFileDownloadService },
          { provide: LogService, useClass: MockLogService },
          { provide: ToastService, useClass: MockToastService },
        ],
      },
    };
  },
};
