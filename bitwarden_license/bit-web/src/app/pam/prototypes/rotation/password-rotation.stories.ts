import { CommonModule } from "@angular/common";
import { importProvidersFrom, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { AdminConsoleLogo } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeComponent,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  defineTable,
  DialogModule,
  FilterMenuModule,
  HeaderComponent,
  I18nMockService,
  IconButtonModule,
  IconModule,
  LayoutComponent,
  MenuModule,
  NavigationModule,
  SearchModule,
  StorybookGlobalStateProvider,
  StorybookStateProvider,
  TabsModule,
  TypographyModule,
} from "@bitwarden/components";
import { GlobalStateProvider, StateProvider } from "@bitwarden/state";
import { enabledFlags } from "@bitwarden/storybook";

type RotationStatus =
  | "Failed"
  | "Not connected"
  | "Rotation due"
  | "Rotating"
  | "Paused"
  | "Manual rotation"
  | "Active";

/**
 * Independent state facts that can be true at the same time for a credential. A manual credential
 * past its due date is `manual: true, rotationDue: true`; a connector that fell off while a prior
 * rotation had already failed is `notConnected: true, failed: true`. Which single label the badge
 * shows is up to {@link resolveStatus}.
 *
 * `Active` isn't a flag — it's the fallthrough when nothing else is true.
 */
interface CredentialStateFlags {
  rotating?: boolean;
  paused?: boolean;
  notConnected?: boolean;
  failed?: boolean;
  rotationDue?: boolean;
  manual?: boolean;
}

/**
 * Precedence (first match wins), per the status spec:
 * 1. Rotating — in-flight work hides every other label until it finishes.
 * 2. Paused — the admin's explicit choice to stop rotations; explains the quiet.
 * 3. Not connected — blocks every rotation; the connector must come back first.
 * 4. Failed — the last rotation failed, actionable once the connector is up.
 * 5. Rotation due — a manual credential is overdue.
 * 6. Manual rotation — the resting state for manual credentials.
 * 7. Active — the resting state for automatic credentials; shown when nothing else is true.
 */
const resolveStatus = (flags: CredentialStateFlags): RotationStatus => {
  if (flags.rotating) {
    return "Rotating";
  }
  if (flags.paused) {
    return "Paused";
  }
  if (flags.notConnected) {
    return "Not connected";
  }
  if (flags.failed) {
    return "Failed";
  }
  if (flags.rotationDue) {
    return "Rotation due";
  }
  if (flags.manual) {
    return "Manual rotation";
  }
  return "Active";
};

interface ManagedCredential {
  item: string;
  group: string;
  account: string;
  lastRotated: string;
  nextRotation: string;
  flags: CredentialStateFlags;
}

interface ManagedCredentialRow extends ManagedCredential {
  /** Derived from {@link ManagedCredential.flags} by {@link resolveStatus}. */
  status: RotationStatus;
}

const CREDENTIALS: ManagedCredential[] = [
  {
    item: "Salesforce integration user",
    group: "Data",
    account: "sf-integration-svc",
    lastRotated: "1mo ago",
    nextRotation: "In 1hr",
    flags: { failed: true },
  },
  {
    // Multi-match: connector dropped off *and* the last run failed. "Not connected" wins so the
    // admin fixes the prerequisite before trying to retry the rotation.
    item: "AWS root rotator",
    group: "Infrastructure",
    account: "root-rotator@meridian-prod",
    lastRotated: "Never",
    nextRotation: "None",
    flags: { notConnected: true, failed: true },
  },
  {
    // Multi-match: a manual credential past its due date — "Rotation due" wins over "Manual rotation".
    item: "Oracle DBA account",
    group: "Finance",
    account: "oracle_dba",
    lastRotated: "3mo ago",
    nextRotation: "Due 3d ago",
    flags: { manual: true, rotationDue: true },
  },
  {
    // Multi-match: in-flight retry of a previously failed rotation. "Rotating" hides every other
    // label until the attempt finishes.
    item: "Snowflake service account",
    group: "Data",
    account: "svc-snowflake-etl",
    lastRotated: "Just now",
    nextRotation: "In progress",
    flags: { rotating: true, failed: true },
  },
  {
    item: "Cisco ASA admin",
    group: "Infrastructure",
    account: "asa-admin",
    lastRotated: "6m ago",
    nextRotation: "None",
    flags: { paused: true },
  },
  {
    item: "svc-analytics-041",
    group: "Data",
    account: "svc-account-041",
    lastRotated: "2w ago",
    nextRotation: "In 2w",
    flags: { manual: true },
  },
  {
    item: "Splunk forwarder account",
    group: "Security",
    account: "splunk-fwd",
    lastRotated: "3w ago",
    nextRotation: "In 1w",
    flags: {},
  },
  {
    item: "Okta super admin",
    group: "Data",
    account: "okta-svc-admin",
    lastRotated: "5d ago",
    nextRotation: "In 3w",
    flags: {},
  },
  {
    item: "Azure Key Vault rotator",
    group: "Infrastructure",
    account: "kv-rotator-svc",
    lastRotated: "Yesterday",
    nextRotation: "In 4w",
    flags: {},
  },
  {
    item: "MySQL replication user",
    group: "Legacy Reporting DB",
    account: "repl_user",
    lastRotated: "1m ago",
    nextRotation: "In 4w",
    flags: {},
  },
];

const ROWS: ManagedCredentialRow[] = CREDENTIALS.map((credential) => ({
  ...credential,
  status: resolveStatus(credential.flags),
}));

/**
 * Status sort weight — higher = more urgent. Matches the "Sort order" column of the status spec:
 * Failed > Not connected > Rotation due > Rotating > Paused > Manual rotation > Active.
 * With `defaultSort="desc"` on the Status column, the most urgent rows surface first on page load.
 */
const STATUS_URGENCY: Record<RotationStatus, number> = {
  Failed: 7,
  "Not connected": 6,
  "Rotation due": 5,
  Rotating: 4,
  Paused: 3,
  "Manual rotation": 2,
  Active: 1,
};

const sortByUrgency = (a: ManagedCredentialRow, b: ManagedCredentialRow) =>
  STATUS_URGENCY[a.status] - STATUS_URGENCY[b.status];

const table = defineTable<ManagedCredentialRow, "options">(signal(ROWS));

const template = /* HTML */ `
  <bit-layout>
    <bit-side-nav variant="secondary">
      <bit-nav-logo [openIcon]="adminConsoleLogo" route="/" label="Admin Console"></bit-nav-logo>
      <bit-nav-item text="Acme corporation" icon="bwi-business" route="/org"></bit-nav-item>
      <bit-nav-item
        text="Access intelligence"
        icon="bwi-dashboard"
        route="/access-intelligence"
      ></bit-nav-item>
      <bit-nav-group text="Privileged Controls" icon="bwi-lock-encrypted" [open]="true">
        <bit-nav-item text="Access rules" route="/pam/access-rules"></bit-nav-item>
        <bit-nav-item text="Audit log" route="/pam/audit-log"></bit-nav-item>
        <bit-nav-item
          text="Rotation"
          route="/pam/rotation"
          [forceActiveStyles]="true"
        ></bit-nav-item>
      </bit-nav-group>
      <bit-nav-item text="Members" icon="bwi-user" route="/members"></bit-nav-item>
      <bit-nav-item text="Groups" icon="bwi-users" route="/groups"></bit-nav-item>
      <bit-nav-group text="Reporting" icon="bwi-sliders"></bit-nav-group>
      <bit-nav-group text="Billing" icon="bwi-billing"></bit-nav-group>
      <bit-nav-item text="Integrations" icon="bwi-msp" route="/integrations"></bit-nav-item>
      <bit-nav-group text="Settings" icon="bwi-cog"></bit-nav-group>
      <bit-nav-item
        slot="account"
        text="Will Robinson"
        icon="bwi-user"
        route="/account"
      ></bit-nav-item>
    </bit-side-nav>

    <bit-header title="Rotation">
      <div slot="subtitle">
        Manage credential rotation across target systems, using access connectors running inside
        your network.
      </div>
      <button type="button" bitButton buttonType="primary" startIcon="bwi-plus">Add</button>
    </bit-header>

    <bit-tab-group label="Rotation sections">
      <bit-tab label="Managed credentials" startIcon="bwi-managed-credential">
        <bit-table-v2 [tableDef]="table">
          <bit-table-toolbar>
            <bit-search class="tw-flex-1" placeholder="Search" aria-label="Search"></bit-search>

            <bit-filter-menu key="status" placeholderText="Status" multiple>
              <bit-filter-option
                [value]="'failed'"
                [count]="1"
                [iconTile]="{ icon: 'bwi-error', variant: 'danger' }"
                >Failed</bit-filter-option
              >
              <bit-filter-option
                [value]="'not-connected'"
                [count]="1"
                [iconTile]="{ icon: 'bwi-exclamation-triangle', variant: 'warning' }"
                >Not connected</bit-filter-option
              >
              <bit-filter-option
                [value]="'due'"
                [count]="1"
                [iconTile]="{ icon: 'bwi-calendar', variant: 'warning' }"
                >Rotation due</bit-filter-option
              >
              <bit-filter-option
                [value]="'rotating'"
                [count]="1"
                [iconTile]="{ icon: 'bwi-refresh', variant: 'primary' }"
                >Rotating</bit-filter-option
              >
              <bit-filter-option
                [value]="'paused'"
                [count]="1"
                [iconTile]="{ icon: 'bwi-pause-circle', variant: 'gray' }"
                >Paused</bit-filter-option
              >
              <bit-filter-option
                [value]="'manual'"
                [count]="2"
                [iconTile]="{ icon: 'bwi-user', variant: 'gray' }"
                >Manual rotation</bit-filter-option
              >
              <bit-filter-option
                [value]="'active'"
                [count]="32"
                [iconTile]="{ icon: 'bwi-check-circle', variant: 'success' }"
                >Active</bit-filter-option
              >
            </bit-filter-menu>
            <bit-filter-menu key="target-system" placeholderText="Target system" multiple>
              <bit-filter-option [value]="'data-warehouse'" [count]="6"
                >Data Warehouse</bit-filter-option
              >
              <bit-filter-option [value]="'entra-id-production'" [count]="8"
                >Entra ID production</bit-filter-option
              >
              <bit-filter-option [value]="'legacy-reporting-db'" [count]="8"
                >Legacy Reporting DB</bit-filter-option
              >
              <bit-filter-option [value]="'okta-identity'" [count]="4"
                >Okta Identity</bit-filter-option
              >
              <bit-filter-option [value]="'siem-cluster'" [count]="4"
                >SIEM Cluster</bit-filter-option
              >
              <bit-filter-option [value]="'aws-production'" [count]="3"
                >AWS Production</bit-filter-option
              >
              <bit-filter-option [value]="'network-firewall'" [count]="3"
                >Network Firewall</bit-filter-option
              >
              <bit-filter-option [value]="'finance-reporting-db'" [count]="2"
                >Finance Reporting DB</bit-filter-option
              >
              <bit-filter-option [value]="'legacy-erp-admin'" [count]="1"
                >Legacy ERP admin</bit-filter-option
              >
            </bit-filter-menu>
            <bit-filter-menu key="shared-folders" placeholderText="Shared folders" multiple>
              <bit-filter-option [value]="'data'" [count]="12">Data</bit-filter-option>
              <bit-filter-option [value]="'finance'" [count]="5">Finance</bit-filter-option>
              <bit-filter-option [value]="'infrastructure'" [count]="14"
                >Infrastructure</bit-filter-option
              >
              <bit-filter-option [value]="'security'" [count]="8">Security</bit-filter-option>
            </bit-filter-menu>
            <bit-filter-menu
              key="rotation-method"
              placeholderText="Rotation method"
              unsetLabel="All"
            >
              <bit-filter-option [value]="'automatic'" [count]="5">Automatic</bit-filter-option>
              <bit-filter-option [value]="'manual'" [count]="14">Manual</bit-filter-option>
            </bit-filter-menu>
            <bit-filter-menu key="rotation-trigger" placeholderText="Rotation trigger" multiple>
              <bit-filter-option [value]="'schedule'" [count]="36">On a schedule</bit-filter-option>
              <bit-filter-option [value]="'access-ends'" [count]="27"
                >When access ends</bit-filter-option
              >
              <bit-filter-option [value]="'on-demand'" [count]="2"
                >Only on demand</bit-filter-option
              >
            </bit-filter-menu>
          </bit-table-toolbar>

          <bit-column sortable defaultSort="asc" width="minmax(240px, 1fr)">
            <bit-header-cell>Item</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.item; let row">
              <div class="tw-flex tw-flex-col">
                <span class="tw-font-semibold">{{ row.item }}</span>
                <span class="tw-text-sm tw-text-muted">{{ row.group }}</span>
              </div>
            </bit-cell>
          </bit-column>

          <bit-column
            sortable
            defaultSort="desc"
            [sortFn]="sortByUrgency"
            width="minmax(160px, 200px)"
          >
            <bit-header-cell>Status</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.status; let row">
              @switch (row.status) { @case ("Failed") {
              <span bitBadge variant="danger">Failed</span>
              } @case ("Not connected") {
              <span bitBadge variant="warning">Not connected</span>
              } @case ("Rotation due") {
              <span bitBadge variant="warning" startIcon="bwi-calendar">Rotation due</span>
              } @case ("Rotating") {
              <span bitBadge variant="primary" startIcon="bwi-refresh">Rotating</span>
              } @case ("Paused") {
              <span bitBadge variant="subtle" startIcon="bwi-pause-circle">Paused</span>
              } @case ("Manual rotation") {
              <span bitBadge variant="subtle" startIcon="bwi-user">Manual rotation</span>
              } @case ("Active") {
              <span bitBadge variant="success">Active</span>
              } }
            </bit-cell>
          </bit-column>

          <bit-column width="minmax(200px, 240px)">
            <bit-header-cell>Account</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.account; let row"> {{ row.account }} </bit-cell>
          </bit-column>

          <bit-column sortable width="minmax(140px, 180px)">
            <bit-header-cell>Last rotated</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.lastRotated; let row">
              {{ row.lastRotated }}
            </bit-cell>
          </bit-column>

          <bit-column sortable width="minmax(140px, 180px)">
            <bit-header-cell>Next rotation</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.nextRotation; let row">
              {{ row.nextRotation }}
            </bit-cell>
          </bit-column>

          <bit-column width="112px">
            <bit-header-cell>
              <span class="tw-w-full tw-text-end">Options</span>
            </bit-header-cell>
            <bit-cell *bitCellDef="table.columns.options; let row">
              <div class="tw-flex tw-w-full tw-justify-end">
                <button
                  type="button"
                  bitIconButton="bwi-ellipsis-v"
                  size="small"
                  label="Row options"
                  [bitMenuTriggerFor]="rowMenu"
                ></button>
                <bit-menu #rowMenu>
                  @switch (row.status) { @case ("Manual rotation") {
                  <button type="button" bitMenuItem>
                    <i slot="start" class="bwi bwi-check-circle" aria-hidden="true"></i>
                    Mark as rotated
                  </button>
                  } @case ("Rotation due") {
                  <button type="button" bitMenuItem>
                    <i slot="start" class="bwi bwi-check-circle" aria-hidden="true"></i>
                    Mark as rotated
                  </button>
                  } @case ("Rotating") {
                  <button type="button" bitMenuItem disabled>
                    <i slot="start" class="bwi bwi-refresh" aria-hidden="true"></i>
                    <span class="tw-block tw-whitespace-normal">
                      Rotate now
                      <span class="tw-mt-0.5 tw-block tw-text-xs tw-font-normal tw-text-muted">
                        A rotation is in progress.
                      </span>
                    </span>
                  </button>
                  } @case ("Paused") {
                  <button type="button" bitMenuItem disabled>
                    <i slot="start" class="bwi bwi-refresh" aria-hidden="true"></i>
                    <span class="tw-block tw-whitespace-normal">
                      Rotate now
                      <span class="tw-mt-0.5 tw-block tw-text-xs tw-font-normal tw-text-muted">
                        Resume rotation to rotate now.
                      </span>
                    </span>
                  </button>
                  } @case ("Not connected") {
                  <button type="button" bitMenuItem disabled>
                    <i slot="start" class="bwi bwi-refresh" aria-hidden="true"></i>
                    <span class="tw-block tw-whitespace-normal">
                      Rotate now
                      <span class="tw-mt-0.5 tw-block tw-text-xs tw-font-normal tw-text-muted">
                        No access connector is connected.
                      </span>
                    </span>
                  </button>
                  } @default {
                  <button type="button" bitMenuItem>
                    <i slot="start" class="bwi bwi-refresh" aria-hidden="true"></i>
                    Rotate now
                  </button>
                  } } @if (row.status === "Paused") {
                  <button type="button" bitMenuItem>
                    <i slot="start" class="bwi bwi-resume" aria-hidden="true"></i>
                    Resume rotation
                  </button>
                  } @else {
                  <button type="button" bitMenuItem>
                    <i slot="start" class="bwi bwi-pause-circle" aria-hidden="true"></i>
                    Pause rotation
                  </button>
                  }

                  <button type="button" bitMenuItem>
                    <i slot="start" class="bwi bwi-pencil-square" aria-hidden="true"></i>
                    Edit rotation settings
                  </button>
                  <button type="button" bitMenuItem>
                    <i slot="start" class="bwi bwi-eye" aria-hidden="true"></i>
                    View rotation history
                  </button>

                  <bit-menu-divider></bit-menu-divider>

                  @if (row.status === "Rotating") {
                  <button type="button" bitMenuItem disabled variant="danger">
                    <i slot="start" class="bwi bwi-minus-circle" aria-hidden="true"></i>
                    <span class="tw-block tw-whitespace-normal">
                      Remove from rotation
                      <span class="tw-mt-0.5 tw-block tw-text-xs tw-font-normal tw-text-muted">
                        Available when the rotation finishes.
                      </span>
                    </span>
                  </button>
                  } @else {
                  <button type="button" bitMenuItem variant="danger">
                    <i slot="start" class="bwi bwi-minus-circle" aria-hidden="true"></i>
                    Remove from rotation
                  </button>
                  }
                </bit-menu>
              </div>
            </bit-cell>
          </bit-column>
        </bit-table-v2>
      </bit-tab>

      <bit-tab label="Target systems" startIcon="bwi-target-system">
        <div class="tw-pt-10 tw-text-center tw-text-muted">
          <p bitTypography="body1">Target systems not designed yet.</p>
        </div>
      </bit-tab>

      <bit-tab label="Access connectors" startIcon="bwi-access-connector">
        <div class="tw-pt-10 tw-text-center tw-text-muted">
          <p bitTypography="body1">Access connectors not designed yet.</p>
        </div>
      </bit-tab>
    </bit-tab-group>
  </bit-layout>
`;

export default {
  title: "Prototypes/PAM/Rotation",
  decorators: [
    moduleMetadata({
      imports: [
        CommonModule,
        FormsModule,
        LayoutComponent,
        NavigationModule,
        HeaderComponent,
        TabsModule,
        BitTableV2Component,
        BitTableToolbarComponent,
        BitColumnComponent,
        BitHeaderCellComponent,
        BitCellComponent,
        BitCellDefDirective,
        ButtonModule,
        IconButtonModule,
        IconModule,
        BadgeComponent,
        TypographyModule,
        FilterMenuModule,
        MenuModule,
        SearchModule,
        DialogModule,
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
        {
          provide: StateProvider,
          useClass: StorybookStateProvider,
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              loading: "Loading",
              more: "More",
              moreBreadcrumbs: "More breadcrumbs",
              breadcrumbs: "Breadcrumbs",
              close: "Close",
              skipToContent: "Skip to content",
              skipLink: "Skip link",
              submenu: "Submenu",
              toggleCollapse: "Toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              resizeSideNavigation: "Resize side navigation",
              sideNavigation: "Side navigation",
              callout: "Callout",
              search: "Search",
              resetSearch: "Reset search",
              clearSearchTooltip: "Clear by clicking here or pressing Esc.",
              all: "All",
              removeItem: (name) => `Remove ${name}`,
              noMatchingItems: "No matching items",
              noFiltersMatchTerm: (term) => `No filters match “${term}”`,
              clearSearch: "Clear search",
              oneFilterResult: "1 result",
              filterResults: (count) => `${count} results`,
              clear: "Clear",
              clearAll: "Clear all",
              clearFilters: "Clear all filters",
              filter: "Filter",
              filters: "Filters",
              filtersApplied: (count) => `${count} filters applied`,
              filtersSelected: (count) => `${count} selected`,
              nothingToShow: "Nothing to show",
              customize: "Customize",
              customizeYourView: "Customize your view",
              showColumns: "Show columns",
              resetToDefault: "Reset to default",
              done: "Done",
              showMore: "Show more",
              showMoreCount: (count) => `Show ${count} more`,
              itemCount: (count) => `${count} items`,
              selected: "selected",
              selectAllRows: "Select all rows",
              selectRow: "Select row",
            }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj;

export const ManagedCredentials: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { table, adminConsoleLogo: AdminConsoleLogo, sortByUrgency },
    template,
  }),
};
