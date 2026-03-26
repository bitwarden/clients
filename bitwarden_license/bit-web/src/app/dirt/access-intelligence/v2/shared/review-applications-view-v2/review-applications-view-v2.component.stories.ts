import { signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";
import { action } from "storybook/actions";

import { createReport } from "@bitwarden/bit-common/dirt/reports/risk-insights/testing/test-helpers";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { I18nMockService } from "@bitwarden/components";

import { ReviewApplicationsViewV2Component } from "./review-applications-view-v2.component";

// Mock cipher for icon display
const createMockCipher = (name: string, id: string): CipherView => {
  const cipher = new CipherView();
  cipher.name = name;
  cipher.id = id;
  return cipher;
};

// Sample applications data
const sampleApplications = [
  createReport("github.com", { u1: true, u2: false, u3: true }, { c1: true, c2: false, c3: true }),
  createReport("gitlab.com", { u4: true, u5: false }, { c4: true, c5: false }),
  createReport("bitbucket.org", { u6: true }, { c6: true, c7: true }),
  createReport(
    "aws.amazon.com",
    { u7: true, u8: true, u9: true, u10: true },
    { c8: true, c9: true, c10: true },
  ),
  createReport("azure.microsoft.com", { u11: true, u12: false }, { c11: true, c12: false }),
  createReport("salesforce.com", { u13: false }, { c13: false }),
  createReport("internal-app.company.com", {}, { c14: false }),
];

// Update the sample applications to include iconCipherId
sampleApplications[0].iconCipherId = "cipher-github";
sampleApplications[1].iconCipherId = "cipher-gitlab";
sampleApplications[2].iconCipherId = "cipher-bitbucket";
sampleApplications[3].iconCipherId = "cipher-aws";
sampleApplications[4].iconCipherId = "cipher-azure";
sampleApplications[5].iconCipherId = "cipher-salesforce";

// Mock ciphers
const mockCiphers = [
  createMockCipher("GitHub Login", "cipher-github"),
  createMockCipher("GitLab", "cipher-gitlab"),
  createMockCipher("Bitbucket", "cipher-bitbucket"),
  createMockCipher("AWS Console", "cipher-aws"),
  createMockCipher("Azure Portal", "cipher-azure"),
  createMockCipher("Salesforce", "cipher-salesforce"),
];

export default {
  title: "DIRT/Access Intelligence/Review Applications",
  component: ReviewApplicationsViewV2Component,
  decorators: [
    moduleMetadata({
      imports: [ReviewApplicationsViewV2Component],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              application: "Application",
              atRiskPasswords: "At-Risk Passwords",
              totalPasswords: "Total Passwords",
              atRiskMembers: "At-Risk Members",
              search: "Search",
              resetSearch: "Reset search",
              searchApps: "Search applications",
              selectAll: "Select all",
              unselectAll: "Unselect all",
              selectApplication: "Select application",
              unselectApplication: "Unselect application",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
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
} as Meta<ReviewApplicationsViewV2Component>;

type Story = StoryObj<ReviewApplicationsViewV2Component>;

/**
 * Default story showing applications review with no selections
 */
export const Default: Story = {
  render: (args) => {
    const selectedApplications = signal(new Set<string>());

    return {
      props: {
        applications: sampleApplications,
        ciphers: mockCiphers,
        selectedApplications: selectedApplications(),
        onToggleSelection: (appName: string) => {
          const current = selectedApplications();
          const next = new Set(current);
          if (next.has(appName)) {
            next.delete(appName);
          } else {
            next.add(appName);
          }
          selectedApplications.set(next);
          action("onToggleSelection")(appName);
        },
        onToggleAll: () => {
          const current = selectedApplications();
          if (current.size === sampleApplications.length) {
            selectedApplications.set(new Set());
          } else {
            selectedApplications.set(new Set(sampleApplications.map((app) => app.applicationName)));
          }
          action("onToggleAll")();
        },
      },
      template: `
        <dirt-review-applications-view-v2
          [applications]="applications"
          [ciphers]="ciphers"
          [selectedApplications]="selectedApplications"
          (onToggleSelection)="onToggleSelection($event)"
          (onToggleAll)="onToggleAll()"
        ></dirt-review-applications-view-v2>
      `,
    };
  },
};

/**
 * Story with some applications pre-selected
 */
export const WithSelections: Story = {
  render: (args) => {
    const selectedApplications = signal(
      new Set<string>(["github.com", "gitlab.com", "aws.amazon.com"]),
    );

    return {
      props: {
        applications: sampleApplications,
        ciphers: mockCiphers,
        selectedApplications: selectedApplications(),
        onToggleSelection: (appName: string) => {
          const current = selectedApplications();
          const next = new Set(current);
          if (next.has(appName)) {
            next.delete(appName);
          } else {
            next.add(appName);
          }
          selectedApplications.set(next);
          action("onToggleSelection")(appName);
        },
        onToggleAll: () => {
          const current = selectedApplications();
          if (current.size === sampleApplications.length) {
            selectedApplications.set(new Set());
          } else {
            selectedApplications.set(new Set(sampleApplications.map((app) => app.applicationName)));
          }
          action("onToggleAll")();
        },
      },
      template: `
        <dirt-review-applications-view-v2
          [applications]="applications"
          [ciphers]="ciphers"
          [selectedApplications]="selectedApplications"
          (onToggleSelection)="onToggleSelection($event)"
          (onToggleAll)="onToggleAll()"
        ></dirt-review-applications-view-v2>
      `,
    };
  },
};

/**
 * Story with all applications selected
 */
export const AllSelected: Story = {
  render: (args) => {
    const selectedApplications = signal(
      new Set<string>(sampleApplications.map((app) => app.applicationName)),
    );

    return {
      props: {
        applications: sampleApplications,
        ciphers: mockCiphers,
        selectedApplications: selectedApplications(),
        onToggleSelection: (appName: string) => {
          const current = selectedApplications();
          const next = new Set(current);
          if (next.has(appName)) {
            next.delete(appName);
          } else {
            next.add(appName);
          }
          selectedApplications.set(next);
          action("onToggleSelection")(appName);
        },
        onToggleAll: () => {
          const current = selectedApplications();
          if (current.size === sampleApplications.length) {
            selectedApplications.set(new Set());
          } else {
            selectedApplications.set(new Set(sampleApplications.map((app) => app.applicationName)));
          }
          action("onToggleAll")();
        },
      },
      template: `
        <dirt-review-applications-view-v2
          [applications]="applications"
          [ciphers]="ciphers"
          [selectedApplications]="selectedApplications"
          (onToggleSelection)="onToggleSelection($event)"
          (onToggleAll)="onToggleAll()"
        ></dirt-review-applications-view-v2>
      `,
    };
  },
};

/**
 * Story with applications missing icons (shows globe fallback)
 */
export const WithoutIcons: Story = {
  render: (args) => {
    const selectedApplications = signal(new Set<string>());

    return {
      props: {
        applications: sampleApplications,
        ciphers: [], // No ciphers = no icons
        selectedApplications: selectedApplications(),
        onToggleSelection: (appName: string) => {
          const current = selectedApplications();
          const next = new Set(current);
          if (next.has(appName)) {
            next.delete(appName);
          } else {
            next.add(appName);
          }
          selectedApplications.set(next);
          action("onToggleSelection")(appName);
        },
        onToggleAll: () => {
          const current = selectedApplications();
          if (current.size === sampleApplications.length) {
            selectedApplications.set(new Set());
          } else {
            selectedApplications.set(new Set(sampleApplications.map((app) => app.applicationName)));
          }
          action("onToggleAll")();
        },
      },
      template: `
        <dirt-review-applications-view-v2
          [applications]="applications"
          [ciphers]="ciphers"
          [selectedApplications]="selectedApplications"
          (onToggleSelection)="onToggleSelection($event)"
          (onToggleAll)="onToggleAll()"
        ></dirt-review-applications-view-v2>
      `,
    };
  },
};

/**
 * Story with single application
 */
export const SingleApplication: Story = {
  render: (args) => {
    const singleApp = [sampleApplications[0]];
    const selectedApplications = signal(new Set<string>());

    return {
      props: {
        applications: singleApp,
        ciphers: mockCiphers,
        selectedApplications: selectedApplications(),
        onToggleSelection: (appName: string) => {
          const current = selectedApplications();
          const next = new Set(current);
          if (next.has(appName)) {
            next.delete(appName);
          } else {
            next.add(appName);
          }
          selectedApplications.set(next);
          action("onToggleSelection")(appName);
        },
        onToggleAll: () => {
          const current = selectedApplications();
          if (current.size === singleApp.length) {
            selectedApplications.set(new Set());
          } else {
            selectedApplications.set(new Set(singleApp.map((app) => app.applicationName)));
          }
          action("onToggleAll")();
        },
      },
      template: `
        <dirt-review-applications-view-v2
          [applications]="applications"
          [ciphers]="ciphers"
          [selectedApplications]="selectedApplications"
          (onToggleSelection)="onToggleSelection($event)"
          (onToggleAll)="onToggleAll()"
        ></dirt-review-applications-view-v2>
      `,
    };
  },
};

/**
 * Story with many applications (20+) for scrolling behavior
 */
export const LargeList: Story = {
  render: (args) => {
    const largeList = [...sampleApplications];
    for (let i = 0; i < 15; i++) {
      largeList.push(
        createReport(
          `application-${i}.example.com`,
          // Deterministic patterns for Chromatic
          { [`u${i}`]: i % 2 === 0 }, // Every other user at-risk
          { [`c${i}`]: i % 3 !== 0 }, // ~67% ciphers at-risk
        ),
      );
    }

    const selectedApplications = signal(new Set<string>());

    return {
      props: {
        applications: largeList,
        ciphers: mockCiphers,
        selectedApplications: selectedApplications(),
        onToggleSelection: (appName: string) => {
          const current = selectedApplications();
          const next = new Set(current);
          if (next.has(appName)) {
            next.delete(appName);
          } else {
            next.add(appName);
          }
          selectedApplications.set(next);
          action("onToggleSelection")(appName);
        },
        onToggleAll: () => {
          const current = selectedApplications();
          if (current.size === largeList.length) {
            selectedApplications.set(new Set());
          } else {
            selectedApplications.set(new Set(largeList.map((app) => app.applicationName)));
          }
          action("onToggleAll")();
        },
      },
      template: `
        <div class="tw-max-h-[600px] tw-overflow-y-auto">
          <dirt-review-applications-view-v2
            [applications]="applications"
            [ciphers]="ciphers"
            [selectedApplications]="selectedApplications"
            (onToggleSelection)="onToggleSelection($event)"
            (onToggleAll)="onToggleAll()"
          ></dirt-review-applications-view-v2>
        </div>
      `,
    };
  },
};

/**
 * Story with empty list
 */
export const Empty: Story = {
  render: (args) => {
    const selectedApplications = signal(new Set<string>());

    return {
      props: {
        applications: [],
        ciphers: [],
        selectedApplications: selectedApplications(),
        onToggleSelection: (appName: string) => {
          action("onToggleSelection")(appName);
        },
        onToggleAll: () => {
          action("onToggleAll")();
        },
      },
      template: `
        <dirt-review-applications-view-v2
          [applications]="applications"
          [ciphers]="ciphers"
          [selectedApplications]="selectedApplications"
          (onToggleSelection)="onToggleSelection($event)"
          (onToggleAll)="onToggleAll()"
        ></dirt-review-applications-view-v2>
      `,
    };
  },
};
