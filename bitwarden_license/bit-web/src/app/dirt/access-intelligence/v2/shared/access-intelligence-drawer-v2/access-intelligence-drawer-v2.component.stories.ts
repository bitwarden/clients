import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";
import { action } from "storybook/actions";

import { DrawerType } from "@bitwarden/bit-common/dirt/access-intelligence/services";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, I18nMockService } from "@bitwarden/components";
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
  title: "DIRT/Access Intelligence/Access Intelligence Drawer",
  component: AccessIntelligenceDrawerV2Component,
  decorators: [
    moduleMetadata({
      imports: [AccessIntelligenceDrawerV2Component],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              atRiskMembersWithCount: "At-Risk Members (__$1__)",
              atRiskMemberDescription: "Members with at-risk passwords across the organization.",
              atRiskMembersDescriptionNone: "No at-risk members found.",
              atRiskMembersDescriptionWithApp: "Members with at-risk passwords for __$1__.",
              atRiskMembersDescriptionWithAppNone: "No at-risk members found for __$1__.",
              atRiskApplicationsWithCount: "At-Risk Applications (__$1__)",
              atRiskApplicationsDescription: "Applications with at-risk passwords.",
              atRiskApplicationsDescriptionNone: "No at-risk applications found.",
              criticalAtRiskMembersWithCount: "Critical At-Risk Members (__$1__)",
              criticalAtRiskMembersDescription:
                "Members with at-risk passwords in critical applications.",
              criticalAtRiskMembersDescriptionNone:
                "No at-risk members found in critical applications.",
              criticalAtRiskApplicationsWithCount: "Critical At-Risk Applications (__$1__)",
              criticalAtRiskApplicationsDescription:
                "Critical applications with at-risk passwords.",
              criticalAtRiskApplicationsDescriptionNone: "No at-risk critical applications found.",
              downloadCSV: "Download CSV",
              email: "Email",
              atRiskPasswords: "At-Risk Passwords",
              application: "Application",
              close: "Close",
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
} as Meta<AccessIntelligenceDrawerV2Component>;

type Story = StoryObj<AccessIntelligenceDrawerV2Component>;

const drawerTemplate = `
  <div class="tw-max-w-[400px] tw-border tw-border-secondary-300 tw-p-5">
    <dirt-access-intelligence-drawer-v2></dirt-access-intelligence-drawer-v2>
  </div>
`;

/**
 * Organization-wide At-Risk Members Drawer
 * Shows all members across the organization with at-risk passwords.
 */
export const OrgAtRiskMembers: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.OrgAtRiskMembers,
            members: sampleMembers,
          } as OrgAtRiskMembersData,
        },
      ],
    }),
  ],
  render: () => ({ template: drawerTemplate }),
};

/**
 * Application-Specific At-Risk Members Drawer
 * Shows members with at-risk passwords for a specific application.
 */
export const AppAtRiskMembers: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.AppAtRiskMembers,
            applicationName: "github.com",
            members: sampleMembers.slice(0, 3),
          } as AppAtRiskMembersData,
        },
      ],
    }),
  ],
  render: () => ({ template: drawerTemplate }),
};

/**
 * Organization-wide At-Risk Applications Drawer
 * Shows all applications with at-risk passwords.
 */
export const OrgAtRiskApps: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.OrgAtRiskApps,
            applications: sampleApplications,
          } as OrgAtRiskAppsData,
        },
      ],
    }),
  ],
  render: () => ({ template: drawerTemplate }),
};

/**
 * Critical Applications' At-Risk Members Drawer
 * Shows members with at-risk passwords across all critical applications.
 */
export const CriticalAtRiskMembers: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.CriticalAtRiskMembers,
            members: sampleMembers,
          } as CriticalAtRiskMembersData,
        },
      ],
    }),
  ],
  render: () => ({ template: drawerTemplate }),
};

/**
 * Critical Applications' At-Risk Apps Drawer
 * Shows critical applications that have at-risk passwords.
 */
export const CriticalAtRiskApps: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.CriticalAtRiskApps,
            applications: sampleApplications.slice(0, 3),
          } as CriticalAtRiskAppsData,
        },
      ],
    }),
  ],
  render: () => ({ template: drawerTemplate }),
};

/**
 * Empty Members State
 */
export const EmptyMembers: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.OrgAtRiskMembers,
            members: [],
          } as OrgAtRiskMembersData,
        },
      ],
    }),
  ],
  render: () => ({ template: drawerTemplate }),
};

/**
 * Empty Applications State
 */
export const EmptyApplications: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.OrgAtRiskApps,
            applications: [],
          } as OrgAtRiskAppsData,
        },
      ],
    }),
  ],
  render: () => ({ template: drawerTemplate }),
};

/**
 * Large Dataset - Many Members
 */
export const LargeDataset: Story = {
  decorators: [
    applicationConfig({
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            type: DrawerType.OrgAtRiskMembers,
            members: Array.from({ length: 50 }, (_, i) => ({
              email: `user${i}@example.com`,
              userName: `User ${i}`,
              userGuid: `user-${i}`,
              atRiskPasswordCount: (i % 25) + 1,
            })),
          } as OrgAtRiskMembersData,
        },
      ],
    }),
  ],
  render: () => ({
    template: /*html*/ `
      <div class="tw-max-w-[400px] tw-max-h-[600px] tw-border tw-border-secondary-300 tw-p-5 tw-overflow-y-auto" tabindex="0">
        <dirt-access-intelligence-drawer-v2></dirt-access-intelligence-drawer-v2>
      </div>
    `,
  }),
};
