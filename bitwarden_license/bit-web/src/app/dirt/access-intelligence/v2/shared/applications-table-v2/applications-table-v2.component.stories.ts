import { Meta, StoryObj, moduleMetadata, applicationConfig } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { TableDataSource, I18nMockService } from "@bitwarden/components";

import { createApplicationHandlers } from "../test-helpers/story-callbacks";

import {
  ApplicationsTableV2Component,
  ApplicationTableRowV2,
} from "./applications-table-v2.component";

// Test helper to create table row data
const createTableRow = (
  applicationName: string,
  atRiskPasswordCount: number = 0,
  passwordCount: number = 0,
  atRiskMemberCount: number = 0,
  memberCount: number = 0,
  isMarkedAsCritical: boolean = false,
  iconCipher?: CipherView,
): ApplicationTableRowV2 => ({
  applicationName,
  atRiskPasswordCount,
  passwordCount,
  atRiskMemberCount,
  memberCount,
  isMarkedAsCritical,
  iconCipher,
});

// Mock cipher for icon display
const createMockCipher = (name: string): CipherView => {
  const cipher = new CipherView();
  cipher.name = name;
  cipher.id = `cipher-${name}`;
  return cipher;
};

// Sample data for stories
const createSampleData = (): ApplicationTableRowV2[] => [
  createTableRow("github.com", 15, 50, 8, 25, true, createMockCipher("GitHub Login")),
  createTableRow("gitlab.com", 8, 30, 4, 15, true, createMockCipher("GitLab")),
  createTableRow("bitbucket.org", 3, 20, 2, 10, false, createMockCipher("Bitbucket")),
  createTableRow("aws.amazon.com", 25, 100, 15, 40, true, createMockCipher("AWS Console")),
  createTableRow("azure.microsoft.com", 12, 45, 6, 20, false),
  createTableRow("internal-app.company.com", 0, 10, 0, 5, false),
  createTableRow("salesforce.com", 5, 25, 3, 12, false, createMockCipher("Salesforce")),
];

export default {
  title: "Access Intelligence/V2/ApplicationsTableV2",
  component: ApplicationsTableV2Component,
  decorators: [
    moduleMetadata({
      imports: [ApplicationsTableV2Component],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              application: "Application",
              atRiskPasswords: "At-Risk Passwords",
              totalPasswords: "Total Passwords",
              atRiskMembers: "At-Risk Members",
              totalMembers: "Total Members",
              criticalBadge: "Critical",
              selectAll: "Select all",
              deselectAll: "Deselect all",
              select: "Select",
            });
          },
        },
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
} as Meta<ApplicationsTableV2Component>;

type Story = StoryObj<ApplicationsTableV2Component>;

/**
 * Default story showing table with sample data
 */
export const Default: Story = {
  render: (args) => {
    const dataSource = new TableDataSource<ApplicationTableRowV2>();
    dataSource.data = createSampleData();

    const selectedUrls = new Set<string>();
    const { showAppAtRiskMembers, checkboxChange } = createApplicationHandlers();

    return {
      props: {
        dataSource,
        selectedUrls,
        openApplication: "",
        showAppAtRiskMembers,
        checkboxChange,
      },
      template: `
        <app-applications-table-v2
          [dataSource]="dataSource"
          [selectedUrls]="selectedUrls"
          [openApplication]="openApplication"
          (showAppAtRiskMembers)="showAppAtRiskMembers($event)"
          (checkboxChange)="checkboxChange($event)"
        ></app-applications-table-v2>
      `,
    };
  },
};

/**
 * Empty table state
 */
export const Empty: Story = {
  render: (args) => {
    const dataSource = new TableDataSource<ApplicationTableRowV2>();
    dataSource.data = [];

    const selectedUrls = new Set<string>();
    const showAppAtRiskMembers = (appName: string) => {};
    const checkboxChange = (_payload: { applicationName: string; checked: boolean }) => {};

    return {
      props: {
        dataSource,
        selectedUrls,
        openApplication: "",
        showAppAtRiskMembers,
        checkboxChange,
      },
      template: `
        <app-applications-table-v2
          [dataSource]="dataSource"
          [selectedUrls]="selectedUrls"
          [openApplication]="openApplication"
          (showAppAtRiskMembers)="showAppAtRiskMembers($event)"
          (checkboxChange)="checkboxChange($event)"
        ></app-applications-table-v2>
      `,
    };
  },
};

/**
 * Table with selected applications
 */
export const WithSelections: Story = {
  render: (args) => {
    const dataSource = new TableDataSource<ApplicationTableRowV2>();
    dataSource.data = createSampleData();

    const selectedUrls = new Set<string>(["github.com", "gitlab.com"]);
    const { showAppAtRiskMembers, checkboxChange } = createApplicationHandlers();

    return {
      props: {
        dataSource,
        selectedUrls,
        openApplication: "",
        showAppAtRiskMembers,
        checkboxChange,
      },
      template: `
        <app-applications-table-v2
          [dataSource]="dataSource"
          [selectedUrls]="selectedUrls"
          [openApplication]="openApplication"
          (showAppAtRiskMembers)="showAppAtRiskMembers($event)"
          (checkboxChange)="checkboxChange($event)"
        ></app-applications-table-v2>
      `,
    };
  },
};

/**
 * Table with highlighted open application
 */
export const WithOpenApplication: Story = {
  render: (args) => {
    const dataSource = new TableDataSource<ApplicationTableRowV2>();
    dataSource.data = createSampleData();

    const selectedUrls = new Set<string>();
    const { showAppAtRiskMembers, checkboxChange } = createApplicationHandlers();

    return {
      props: {
        dataSource,
        selectedUrls,
        openApplication: "github.com", // Highlights this row
        showAppAtRiskMembers,
        checkboxChange,
      },
      template: `
        <app-applications-table-v2
          [dataSource]="dataSource"
          [selectedUrls]="selectedUrls"
          [openApplication]="openApplication"
          (showAppAtRiskMembers)="showAppAtRiskMembers($event)"
          (checkboxChange)="checkboxChange($event)"
        ></app-applications-table-v2>
      `,
    };
  },
};

/**
 * Table with only critical applications
 */
export const CriticalOnly: Story = {
  render: (args) => {
    const dataSource = new TableDataSource<ApplicationTableRowV2>();
    const criticalData = createSampleData().filter((row) => row.isMarkedAsCritical);
    dataSource.data = criticalData;

    const selectedUrls = new Set<string>();
    const { showAppAtRiskMembers, checkboxChange } = createApplicationHandlers();

    return {
      props: {
        dataSource,
        selectedUrls,
        openApplication: "",
        showAppAtRiskMembers,
        checkboxChange,
      },
      template: `
        <app-applications-table-v2
          [dataSource]="dataSource"
          [selectedUrls]="selectedUrls"
          [openApplication]="openApplication"
          (showAppAtRiskMembers)="showAppAtRiskMembers($event)"
          (checkboxChange)="checkboxChange($event)"
        ></app-applications-table-v2>
      `,
    };
  },
};

/**
 * Table with applications missing icons (shows globe fallback)
 */
export const WithoutIcons: Story = {
  render: (args) => {
    const dataSource = new TableDataSource<ApplicationTableRowV2>();
    // Create data without iconCipher (undefined)
    const dataWithoutIcons = createSampleData().map((row) => ({
      ...row,
      iconCipher: undefined as CipherView | undefined,
    }));
    dataSource.data = dataWithoutIcons;

    const selectedUrls = new Set<string>();
    const { showAppAtRiskMembers, checkboxChange } = createApplicationHandlers();

    return {
      props: {
        dataSource,
        selectedUrls,
        openApplication: "",
        showAppAtRiskMembers,
        checkboxChange,
      },
      template: `
        <app-applications-table-v2
          [dataSource]="dataSource"
          [selectedUrls]="selectedUrls"
          [openApplication]="openApplication"
          (showAppAtRiskMembers)="showAppAtRiskMembers($event)"
          (checkboxChange)="checkboxChange($event)"
        ></app-applications-table-v2>
      `,
    };
  },
};

/**
 * Large dataset (100 applications) for performance testing
 */
export const LargeDataset: Story = {
  render: (args) => {
    const dataSource = new TableDataSource<ApplicationTableRowV2>();
    const largeData: ApplicationTableRowV2[] = [];

    for (let i = 0; i < 100; i++) {
      largeData.push(
        createTableRow(
          `app-${i}.example.com`,
          // Deterministic patterns for Chromatic
          (i % 50) + 1, // atRiskPasswordCount: 1-50
          (i % 100) + 50, // passwordCount: 50-149
          (i % 20) + 1, // atRiskMemberCount: 1-20
          (i % 50) + 10, // memberCount: 10-59
          i % 3 === 0, // isMarkedAsCritical: every 3rd app (~33%)
          i % 2 === 0 ? createMockCipher(`App ${i}`) : undefined, // iconCipher: every other app
        ),
      );
    }

    dataSource.data = largeData;

    const selectedUrls = new Set<string>();
    const { showAppAtRiskMembers, checkboxChange } = createApplicationHandlers();

    return {
      props: {
        dataSource,
        selectedUrls,
        openApplication: "",
        showAppAtRiskMembers,
        checkboxChange,
      },
      template: `
        <div style="height: 600px;">
          <app-applications-table-v2
            [dataSource]="dataSource"
            [selectedUrls]="selectedUrls"
            [openApplication]="openApplication"
            (showAppAtRiskMembers)="showAppAtRiskMembers($event)"
            (checkboxChange)="checkboxChange($event)"
          ></app-applications-table-v2>
        </div>
      `,
    };
  },
};
