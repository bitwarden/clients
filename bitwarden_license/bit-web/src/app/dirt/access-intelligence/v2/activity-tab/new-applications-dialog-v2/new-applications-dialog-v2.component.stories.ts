import { signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";
import { action } from "storybook/actions";
import { getByRole, userEvent, waitFor } from "storybook/test";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence";
import { createReport } from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
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
  DialogView,
  NewApplicationsDialogV2Component,
  NewApplicationsDialogV2Data,
} from "./new-applications-dialog-v2.component";

const mockDialogRef = {
  close: action("DialogRef.close"),
};

export default {
  title: "DIRT/Access Intelligence/Activity Tab/New Applications Dialog",
  component: NewApplicationsDialogV2Component,
  decorators: [
    moduleMetadata({
      imports: [NewApplicationsDialogV2Component],
      providers: [
        { provide: AccessIntelligenceDataService, useClass: MockAccessIntelligenceDataService },
        { provide: DialogService, useClass: MockDialogService },
        { provide: I18nService, useFactory: createAccessIntelligenceI18nMock },
        { provide: LogService, useClass: MockLogService },
        { provide: AccessSecurityTasksService, useClass: MockSecurityTasksService },
        { provide: ToastService, useClass: MockToastService },
      ],
    }),
    applicationConfig({
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        {
          provide: ThemeStateService,
          useValue: { selectedTheme$: new BehaviorSubject(ThemeTypes.Light) },
        },
        {
          provide: SYSTEM_THEME_OBSERVABLE,
          useValue: new BehaviorSubject(ThemeTypes.Light),
        },
      ],
    }),
  ],
} as Meta<NewApplicationsDialogV2Component>;

type Story = StoryObj<NewApplicationsDialogV2Component>;

/**
 * Large Dataset - Many new applications (20+)
 * Default story: select apps and click "Mark as Critical" to walk through the full flow.
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
 * No At-Risk Passwords - Apps without at-risk passwords
 * Shows workflow when selected apps have no at-risk passwords (skip assign view)
 */
export const NoAtRiskPasswords: Story = {
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
 * AssignTasksView - Second step of the dialog (static snapshot)
 * Uses a props override to show the assign tasks view directly in docs.
 */
export const AssignTasksView: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true, u2: true }, { c1: true, c2: true }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("salesforce.com", { u4: true, u5: true }, { c4: true, c5: true }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true,
    };

    return {
      props: {
        ...args,
        ...{
          currentView: signal(DialogView.AssignTasks),
          selectedApplications: signal(new Set(["github.com", "gitlab.com", "salesforce.com"])),
        },
      },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
    };
  },
};

/**
 * FullFlow - Complete interactive walkthrough
 * Simulates the full user journey: select all apps → mark as critical → navigates to assign tasks view.
 * The play function drives navigation through both dialog views.
 */
export const FullFlow: Story = {
  tags: ["!autodocs"],
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true, u2: true }, { c1: true, c2: true }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("salesforce.com", { u4: true, u5: true }, { c4: true, c5: true }),
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
  play: async ({ canvasElement, step }) => {
    await step("Select all applications", async () => {
      await waitFor(() => getByRole(canvasElement, "button", { name: "Select all" }));
      await userEvent.click(getByRole(canvasElement, "button", { name: "Select all" }));
    });
    await step("Mark as Critical", async () => {
      await waitFor(() => getByRole(canvasElement, "button", { name: "Mark as Critical" }));
      await userEvent.click(getByRole(canvasElement, "button", { name: "Mark as Critical" }));
    });
  },
};
