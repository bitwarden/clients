import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";

import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence";
import { createReport } from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogRef, DialogService, DIALOG_DATA, ToastService } from "@bitwarden/components";

import { AccessSecurityTasksService } from "../../services/abstractions/access-security-tasks.service";
import {
  MockAccessIntelligenceDataService,
  MockDialogService,
  MockLogService,
  MockSecurityTasksService,
  MockToastService,
  createAccessIntelligenceI18nMock,
} from "../../testing";

import {
  NewApplicationsDialogV2Component,
  NewApplicationsDialogV2Data,
} from "./new-applications-dialog-v2.component";

const mockDialogRef = {
  close: () => {},
};

export default {
  title: "DIRT/Access Intelligence/Activity Tab/New Applications Dialog",
  component: NewApplicationsDialogV2Component,
  decorators: [
    moduleMetadata({
      imports: [NewApplicationsDialogV2Component],
      providers: [
        { provide: AccessIntelligenceDataService, useClass: MockAccessIntelligenceDataService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useClass: MockDialogService },
        { provide: I18nService, useFactory: createAccessIntelligenceI18nMock },
        { provide: LogService, useClass: MockLogService },
        { provide: AccessSecurityTasksService, useClass: MockSecurityTasksService },
        { provide: ToastService, useClass: MockToastService },
      ],
    }),
    applicationConfig({
      providers: [],
    }),
  ],
} as Meta<NewApplicationsDialogV2Component>;

type Story = StoryObj<NewApplicationsDialogV2Component>;

/**
 * Default - Select Applications View (default state)
 * Shows the application selection view with sample data
 */
export const Default: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true, u2: false, u3: true }, { c1: true, c2: false }),
        createReport("gitlab.com", { u4: true, u5: false }, { c4: true, c5: false }),
        createReport("bitbucket.org", { u6: true }, { c6: true, c7: true }),
        createReport("aws.amazon.com", { u7: true, u8: true, u9: true }, { c8: true, c9: true }),
        createReport("azure.microsoft.com", { u10: true }, { c10: true }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true,
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
    };
  },
};

/**
 * No Critical Apps Yet - First-time setup
 * Shows different messaging when organization has no existing critical applications
 */
export const NoCriticalAppsYet: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true, u2: true }, { c1: true, c2: true }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("salesforce.com", { u4: true, u5: true }, { c4: true, c5: true }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: false, // First-time setup
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
    };
  },
};

/**
 * No At-Risk Ciphers - Apps without at-risk passwords
 * Shows workflow when selected apps have no at-risk passwords (skip assign view)
 */
export const NoAtRiskCiphers: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("safe-app-1.com", { u1: false, u2: false }, { c1: false, c2: false }),
        createReport("safe-app-2.com", { u3: false }, { c3: false }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true,
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
    };
  },
};

/**
 * Large Dataset - Many new applications (20+)
 * Shows performance with a large number of new applications
 * ⚠️ Uses deterministic data for Chromatic visual regression testing
 */
export const LargeDataset: Story = {
  render: (args) => {
    // Generate 25 deterministic applications
    const newApplications = Array.from({ length: 25 }, (_, i) => {
      // Deterministic pattern for member/cipher data
      const memberCount = (i % 5) + 1; // 1-5 members
      const cipherCount = (i % 4) + 1; // 1-4 ciphers

      const members: Record<string, boolean> = {};
      for (let j = 0; j < memberCount; j++) {
        members[`u${i * 5 + j}`] = j % 2 === 0; // Alternate at-risk status
      }

      const ciphers: Record<string, boolean> = {};
      for (let k = 0; k < cipherCount; k++) {
        ciphers[`c${i * 4 + k}`] = k % 2 === 0; // Alternate at-risk status
      }

      return createReport(`app-${i}.example.com`, members, ciphers);
    });

    const data: NewApplicationsDialogV2Data = {
      newApplications,
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true,
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
    };
  },
};

/**
 * Single New Application - Minimal dataset
 * Shows dialog with only one new application
 */
export const SingleNewApplication: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport(
          "new-critical-app.com",
          { u1: true, u2: true, u3: true },
          { c1: true, c2: true },
        ),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: false,
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
    };
  },
};
