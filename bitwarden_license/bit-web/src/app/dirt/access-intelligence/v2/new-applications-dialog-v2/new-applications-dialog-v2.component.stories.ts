import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";
import { action } from "storybook/actions";

import { AccessIntelligenceDataService } from "@bitwarden/bit-common/dirt/access-intelligence";
import { createReport } from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  DialogRef,
  DialogService,
  DIALOG_DATA,
  ToastService,
  I18nMockService,
} from "@bitwarden/components";

import { SecurityTasksService } from "../services/abstractions/security-tasks.service";

import {
  NewApplicationsDialogV2Component,
  NewApplicationsDialogV2Data,
} from "./new-applications-dialog-v2.component";

// Mock service class using BehaviorSubjects for reactive state
class MockAccessIntelligenceDataService {
  private _ciphers = new BehaviorSubject<CipherView[]>([]);
  readonly ciphers$ = this._ciphers.asObservable();

  markApplicationsAsCritical$ = jest.fn().mockReturnValue(new BehaviorSubject(undefined));
  markApplicationsAsReviewed$ = jest.fn().mockReturnValue(new BehaviorSubject(undefined));
}

// Mock services
const mockDialogRef = {
  close: action("DialogRef.close"),
};

const mockDialogService = {
  open: jest.fn(),
  openSimpleDialog: jest.fn().mockResolvedValue(true),
};

const mockLogService = {
  error: action("LogService.error"),
  info: action("LogService.info"),
  debug: action("LogService.debug"),
};

const mockSecurityTasksService = {
  requestPasswordChangeForCriticalApplications$: action(
    "requestPasswordChangeForCriticalApplications$",
  ),
};

const mockToastService = {
  showToast: action("ToastService.showToast"),
};

export default {
  title: "Access Intelligence/V2/NewApplicationsDialogV2",
  component: NewApplicationsDialogV2Component,
  decorators: [
    moduleMetadata({
      imports: [NewApplicationsDialogV2Component],
      providers: [
        { provide: AccessIntelligenceDataService, useClass: MockAccessIntelligenceDataService },
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: DialogService, useValue: mockDialogService },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              prioritizeCriticalApplications: "Prioritize Critical Applications",
              reviewNewApplications: "Review New Applications",
              assignSecurityTasksToMembers: "Assign Security Tasks to Members",
              selectCriticalAppsDescription:
                "Select which applications are critical to your organization.",
              reviewNewAppsDescription: "Review new applications and mark which ones are critical.",
              clickIconToMarkAppAsCritical: "Click the star icon to mark an app as critical",
              markAsCritical: "Mark as Critical",
              assignTasks: "Assign Tasks",
              cancel: "Cancel",
              back: "Back",
              application: "Application",
              atRiskPasswords: "At-Risk Passwords",
              totalPasswords: "Total Passwords",
              atRiskMembers: "At-Risk Members",
              totalMembers: "Total Members",
              selectAll: "Select all",
              deselectAll: "Deselect all",
              select: "Select",
            });
          },
        },
        { provide: LogService, useValue: mockLogService },
        { provide: SecurityTasksService, useValue: mockSecurityTasksService },
        { provide: ToastService, useValue: mockToastService },
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
 * With Selections - Some applications selected
 * Shows state when user has selected some (but not all) applications
 */
export const WithSelections: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true, u2: false }, { c1: true, c2: false }),
        createReport("gitlab.com", { u3: true }, { c3: true }),
        createReport("bitbucket.org", { u4: false }, { c4: false }),
        createReport("aws.amazon.com", { u5: true, u6: true }, { c5: true, c6: true }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true,
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
      // Note: Story can't manipulate component state directly for selections
      // This story shows the component in its initial state
    };
  },
};

/**
 * All Selected - All applications selected
 * Shows state when user has selected all applications
 */
export const AllSelected: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u2: true }, { c2: true }),
        createReport("bitbucket.org", { u3: true }, { c3: true }),
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
 * No Selections - None selected (initial state)
 * Shows empty selection state
 */
export const NoSelections: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u2: true }, { c2: true }),
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
 * Has Existing Critical Apps - Standard workflow
 * Shows messaging when organization already has critical applications
 */
export const HasExistingCriticalApps: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("new-app-1.com", { u1: true }, { c1: true }),
        createReport("new-app-2.com", { u2: true }, { c2: true }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true, // Organization has critical apps
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
 * Assign Tasks View - After marking as critical
 * Shows the second view where tasks are assigned to members
 * Note: This would normally be reached after clicking "Mark as Critical" button
 */
export const AssignTasksView: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true, u2: true, u3: true }, { c1: true, c2: true }),
        createReport("gitlab.com", { u4: true, u5: true }, { c3: true, c4: true }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true,
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
      // Note: In actual component, navigate to AssignTasks view by clicking "Mark as Critical"
      // This story shows the component structure
    };
  },
};

/**
 * Saving State - Loading spinner while saving
 * Shows the dialog in a saving/loading state (buttons disabled)
 */
export const SavingState: Story = {
  render: (args) => {
    const data: NewApplicationsDialogV2Data = {
      newApplications: [
        createReport("github.com", { u1: true }, { c1: true }),
        createReport("gitlab.com", { u2: true }, { c2: true }),
      ],
      organizationId: "org-123" as OrganizationId,
      hasExistingCriticalApplications: true,
    };

    return {
      props: { ...args },
      moduleMetadata: {
        providers: [{ provide: DIALOG_DATA, useValue: data }],
      },
      // Note: In actual component, saving state is set when clicking action buttons
      // This story shows the visual state
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
