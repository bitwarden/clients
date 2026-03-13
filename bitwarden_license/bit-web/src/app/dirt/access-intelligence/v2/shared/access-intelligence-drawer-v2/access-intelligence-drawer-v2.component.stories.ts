import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";
import { action } from "storybook/actions";

import { DrawerType } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import {
  AppAtRiskMembersData,
  CriticalAtRiskAppsData,
  CriticalAtRiskMembersData,
  DrawerMemberData,
  DrawerApplicationData,
  OrgAtRiskAppsData,
  OrgAtRiskMembersData,
} from "../../models/drawer-content-data.types";

import { AccessIntelligenceDrawerV2Component } from "./access-intelligence-drawer-v2.component";

// Sample member data
const sampleMembers: DrawerMemberData[] = [
  {
    email: "alice@example.com",
    userName: "Alice Smith",
    userGuid: "user-1",
    atRiskPasswordCount: 15,
  },
  {
    email: "bob@example.com",
    userName: "Bob Johnson",
    userGuid: "user-2",
    atRiskPasswordCount: 8,
  },
  {
    email: "charlie@example.com",
    userName: "Charlie Davis",
    userGuid: "user-3",
    atRiskPasswordCount: 12,
  },
  {
    email: "diana@example.com",
    userName: "Diana Wilson",
    userGuid: "user-4",
    atRiskPasswordCount: 5,
  },
  {
    email: "eve@example.com",
    userName: "Eve Martinez",
    userGuid: "user-5",
    atRiskPasswordCount: 20,
  },
];

// Sample application data
const sampleApplications: DrawerApplicationData[] = [
  { applicationName: "github.com", atRiskPasswordCount: 25 },
  { applicationName: "gitlab.com", atRiskPasswordCount: 15 },
  { applicationName: "aws.amazon.com", atRiskPasswordCount: 30 },
  { applicationName: "azure.microsoft.com", atRiskPasswordCount: 18 },
  { applicationName: "salesforce.com", atRiskPasswordCount: 10 },
];

// Mock services
const mockFileDownloadService = {
  download: action("FileDownloadService.download"),
};

const mockLogService = {
  error: action("LogService.error"),
  info: action("LogService.info"),
  debug: action("LogService.debug"),
};

export default {
  title: "Access Intelligence/V2/AccessIntelligenceDrawerV2",
  component: AccessIntelligenceDrawerV2Component,
  decorators: [
    moduleMetadata({
      imports: [AccessIntelligenceDrawerV2Component],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              atRiskMembers: "At-Risk Members",
              atRiskMembersForApp: "At-Risk Members for {{app}}",
              criticalAtRiskMembers: "Critical Applications - At-Risk Members",
              atRiskApplications: "At-Risk Applications",
              criticalAtRiskApplications: "Critical Applications - At Risk",
              email: "Email",
              atRiskPasswords: "At-Risk Passwords",
              application: "Application",
              download: "Download",
              noMembersFound: "No at-risk members found",
              noApplicationsFound: "No at-risk applications found",
            });
          },
        },
        { provide: FileDownloadService, useValue: mockFileDownloadService },
        { provide: LogService, useValue: mockLogService },
      ],
    }),
    applicationConfig({
      providers: [],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/ACCESS_INTELLIGENCE_FIGMA_URL",
    },
  },
} as Meta<AccessIntelligenceDrawerV2Component>;

type Story = StoryObj<AccessIntelligenceDrawerV2Component>;

/**
 * Organization-wide At-Risk Members Drawer
 * Shows all members across the organization with at-risk passwords.
 */
export const OrgAtRiskMembers: Story = {
  render: (args) => {
    const data: OrgAtRiskMembersData = {
      type: DrawerType.OrgAtRiskMembers,
      members: sampleMembers,
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; border: 1px solid #ccc; padding: 20px;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};

/**
 * Application-Specific At-Risk Members Drawer
 * Shows members with at-risk passwords for a specific application.
 */
export const AppAtRiskMembers: Story = {
  render: (args) => {
    const data: AppAtRiskMembersData = {
      type: DrawerType.AppAtRiskMembers,
      applicationName: "github.com",
      members: sampleMembers.slice(0, 3), // Subset of members
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; border: 1px solid #ccc; padding: 20px;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};

/**
 * Organization-wide At-Risk Applications Drawer
 * Shows all applications with at-risk passwords.
 */
export const OrgAtRiskApps: Story = {
  render: (args) => {
    const data: OrgAtRiskAppsData = {
      type: DrawerType.OrgAtRiskApps,
      applications: sampleApplications,
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; border: 1px solid #ccc; padding: 20px;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};

/**
 * Critical Applications' At-Risk Members Drawer
 * Shows members with at-risk passwords across all critical applications.
 */
export const CriticalAtRiskMembers: Story = {
  render: (args) => {
    const data: CriticalAtRiskMembersData = {
      type: DrawerType.CriticalAtRiskMembers,
      members: sampleMembers,
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; border: 1px solid #ccc; padding: 20px;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};

/**
 * Critical Applications' At-Risk Apps Drawer
 * Shows critical applications that have at-risk passwords.
 */
export const CriticalAtRiskApps: Story = {
  render: (args) => {
    const data: CriticalAtRiskAppsData = {
      type: DrawerType.CriticalAtRiskApps,
      applications: sampleApplications.slice(0, 3), // Subset of critical apps
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; border: 1px solid #ccc; padding: 20px;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};

/**
 * Kitchen Sink - All Drawer Types
 * Shows all 5 drawer types side-by-side for comparison.
 */
export const AllDrawerTypes: Story = {
  render: (args) => {
    const orgAtRiskMembersData: OrgAtRiskMembersData = {
      type: DrawerType.OrgAtRiskMembers,
      members: sampleMembers,
    };

    const appAtRiskMembersData: AppAtRiskMembersData = {
      type: DrawerType.AppAtRiskMembers,
      applicationName: "github.com",
      members: sampleMembers.slice(0, 3),
    };

    const orgAtRiskAppsData: OrgAtRiskAppsData = {
      type: DrawerType.OrgAtRiskApps,
      applications: sampleApplications,
    };

    const criticalAtRiskMembersData: CriticalAtRiskMembersData = {
      type: DrawerType.CriticalAtRiskMembers,
      members: sampleMembers.slice(0, 4),
    };

    const criticalAtRiskAppsData: CriticalAtRiskAppsData = {
      type: DrawerType.CriticalAtRiskApps,
      applications: sampleApplications.slice(0, 3),
    };

    return {
      props: {
        orgAtRiskMembersData,
        appAtRiskMembersData,
        orgAtRiskAppsData,
        criticalAtRiskMembersData,
        criticalAtRiskAppsData,
      },
      template: `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; padding: 20px;">
          <div style="border: 1px solid #ccc; padding: 15px;">
            <h3 style="margin-top: 0;">1. Org At-Risk Members</h3>
            <dirt-access-intelligence-drawer-v2 [data]="orgAtRiskMembersData"></dirt-access-intelligence-drawer-v2>
          </div>

          <div style="border: 1px solid #ccc; padding: 15px;">
            <h3 style="margin-top: 0;">2. App At-Risk Members</h3>
            <dirt-access-intelligence-drawer-v2 [data]="appAtRiskMembersData"></dirt-access-intelligence-drawer-v2>
          </div>

          <div style="border: 1px solid #ccc; padding: 15px;">
            <h3 style="margin-top: 0;">3. Org At-Risk Apps</h3>
            <dirt-access-intelligence-drawer-v2 [data]="orgAtRiskAppsData"></dirt-access-intelligence-drawer-v2>
          </div>

          <div style="border: 1px solid #ccc; padding: 15px;">
            <h3 style="margin-top: 0;">4. Critical At-Risk Members</h3>
            <dirt-access-intelligence-drawer-v2 [data]="criticalAtRiskMembersData"></dirt-access-intelligence-drawer-v2>
          </div>

          <div style="border: 1px solid #ccc; padding: 15px;">
            <h3 style="margin-top: 0;">5. Critical At-Risk Apps</h3>
            <dirt-access-intelligence-drawer-v2 [data]="criticalAtRiskAppsData"></dirt-access-intelligence-drawer-v2>
          </div>
        </div>
      `,
    };
  },
};

/**
 * Empty Members State
 */
export const EmptyMembers: Story = {
  render: (args) => {
    const data: OrgAtRiskMembersData = {
      type: DrawerType.OrgAtRiskMembers,
      members: [],
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; border: 1px solid #ccc; padding: 20px;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};

/**
 * Empty Applications State
 */
export const EmptyApplications: Story = {
  render: (args) => {
    const data: OrgAtRiskAppsData = {
      type: DrawerType.OrgAtRiskApps,
      applications: [],
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; border: 1px solid #ccc; padding: 20px;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};

/**
 * Large Dataset - Many Members
 */
export const LargeDataset: Story = {
  render: (args) => {
    const largeMembers: DrawerMemberData[] = [];
    for (let i = 0; i < 50; i++) {
      largeMembers.push({
        email: `user${i}@example.com`,
        userName: `User ${i}`,
        userGuid: `user-${i}`,
        // Deterministic pattern for Chromatic: cycles 1-25
        atRiskPasswordCount: (i % 25) + 1,
      });
    }

    const data: OrgAtRiskMembersData = {
      type: DrawerType.OrgAtRiskMembers,
      members: largeMembers,
    };

    return {
      props: {
        data,
      },
      template: `
        <div style="max-width: 400px; max-height: 600px; border: 1px solid #ccc; padding: 20px; overflow-y: auto;">
          <dirt-access-intelligence-drawer-v2 [data]="data"></dirt-access-intelligence-drawer-v2>
        </div>
      `,
    };
  },
};
