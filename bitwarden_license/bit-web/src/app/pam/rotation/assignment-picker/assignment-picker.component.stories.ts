import { importProvidersFrom } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { BadgeModule, SelectItemView, TableModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  AssignmentPickerColumn,
  AssignmentPickerComponent,
  AssignmentPickerHints,
  AssignmentPickerRow,
} from "./assignment-picker.component";

/** The connector detail page's rows: a target system, qualified by its integration. */
interface TargetRow extends AssignmentPickerRow {
  readonly kindKey: string;
}

/** The target system page's rows: a connector, with its status and connection as badges. */
interface ConnectorRow extends AssignmentPickerRow {
  readonly enabled: boolean;
  readonly connected: boolean;
  readonly statusKey: string;
  readonly connectionKey: string;
}

const TARGET_COLUMNS: AssignmentPickerColumn[] = [
  { headerKey: "pamAccessConnectorAssignTargetLabel" },
  { headerKey: "pamTargetSystemTypeColumn" },
];

const CONNECTOR_COLUMNS: AssignmentPickerColumn[] = [
  { headerKey: "name" },
  { headerKey: "status" },
  { headerKey: "pamAccessConnectorConnection" },
];

const TARGET_HINTS: AssignmentPickerHints = {
  default: "pamAccessConnectorAssignSelectHint",
  noneEligible: "pamAccessConnectorAssignNoTargetSystems",
  disabled: "pamAccessConnectorAssignTargetDisabled",
  loadError: "pamAccessConnectorTargetSystemsLoadError",
};

const CONNECTOR_HINTS: AssignmentPickerHints = {
  default: "pamTargetSystemAssignConnectorSelectHint",
  noneEligible: "pamTargetSystemAssignConnectorNone",
  disabled: "pamTargetSystemAssignConnectorManual",
  loadError: "pamTargetSystemConnectorAssignmentsLoadError",
};

const TARGET_OPTIONS: SelectItemView[] = [
  { id: "ts-3", listName: "Staging Postgres", labelName: "Staging Postgres" },
  { id: "ts-4", listName: "Sandbox Entra", labelName: "Sandbox Entra" },
];

const TARGET_ROWS: TargetRow[] = [
  { id: "ts-1", label: "Prod Entra (Entra ID)", kindKey: "pamTargetSystemTypeEntra" },
  { id: "ts-2", label: "Prod MSSQL (SQL Server)", kindKey: "pamTargetSystemTypeMssql" },
];

const CONNECTOR_OPTIONS: SelectItemView[] = [
  { id: "c-3", listName: "EU west connector", labelName: "EU west connector" },
];

const CONNECTOR_ROWS: ConnectorRow[] = [
  {
    id: "c-1",
    label: "Prod on-prem connector",
    enabled: true,
    connected: true,
    statusKey: "pamAccessConnectorStatusActive",
    connectionKey: "pamAccessConnectorConnected",
  },
  {
    id: "c-2",
    label: "Backup connector",
    enabled: false,
    connected: false,
    statusKey: "pamAccessConnectorStatusInactive",
    connectionKey: "pamAccessConnectorDisconnected",
  },
];

/** Long enough for `bitAction` to show its spinner. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 600));

const COMMON_BINDINGS = `
  [options]="options"
  [assignments]="assignments"
  [columns]="columns"
  [rowTemplate]="rowTemplate"
  [hints]="hints"
  [disabled]="disabled"
  [disabledTooltipKey]="disabledTooltipKey"
  [assign]="assign"
  [unassign]="unassign"
  [loadError]="loadError"
  [noneEligible]="noneEligible"
  [goToRoute]="goToRoute"
  [goToLabelKey]="goToLabelKey"
`;

/** The connector detail page's flavour: two text columns. */
const targetTemplate = `
  <pam-assignment-picker
    idPrefix="daemon-detail"
    headingKey="pamAccessConnectorAssignments"
    selectLabelKey="pamAccessConnectorAssignSelectLabel"
    assignLabelKey="pamAccessConnectorAssignConfirm"
    unassignLabelKey="pamAccessConnectorUnassign"
    emptyKey="pamAccessConnectorAssignmentsEmpty"
    ${COMMON_BINDINGS}
  />
  <ng-template #rowTemplate let-row>
    <td bitCell>{{ row.label }}</td>
    <td bitCell class="tw-text-muted">{{ row.kindKey | i18n }}</td>
  </ng-template>
`;

/** The target system page's flavour: a name and two badge columns. */
const connectorTemplate = `
  <pam-assignment-picker
    idPrefix="target-system-edit"
    headingKey="pamTargetSystemConnectorAssignments"
    selectLabelKey="pamTargetSystemAssignConnectors"
    assignLabelKey="assign"
    unassignLabelKey="pamAccessConnectorUnassign"
    emptyKey="pamTargetSystemConnectorAssignmentsEmpty"
    ${COMMON_BINDINGS}
  />
  <ng-template #rowTemplate let-row>
    <td bitCell>{{ row.label }}</td>
    <td bitCell>
      <span bitBadge [variant]="row.enabled ? 'success' : 'secondary'">
        {{ row.statusKey | i18n }}
      </span>
    </td>
    <td bitCell>
      <span bitBadge [variant]="row.connected ? 'success' : 'secondary'">
        {{ row.connectionKey | i18n }}
      </span>
    </td>
  </ng-template>
`;

export default {
  title: "Web/PAM/Rotation/Assignment Picker",
  component: AssignmentPickerComponent,
  decorators: [
    moduleMetadata({
      imports: [AssignmentPickerComponent, TableModule, BadgeModule, I18nPipe],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(RouterModule.forRoot([{ path: "**", children: [] }])),
      ],
    }),
  ],
  args: {
    options: TARGET_OPTIONS,
    assignments: TARGET_ROWS,
    columns: TARGET_COLUMNS,
    hints: TARGET_HINTS,
    disabled: false,
    disabledTooltipKey: null,
    loadError: false,
    noneEligible: false,
    goToRoute: null,
    goToLabelKey: null,
    assign: settle,
    unassign: settle,
  },
  render: (args) => ({ props: args, template: targetTemplate }),
} as Meta<AssignmentPickerComponent<TargetRow>>;

type Story = StoryObj<AssignmentPickerComponent<TargetRow>>;

/** The resting state: something assigned, something left to assign. */
export const Default: Story = {};

/** Nothing assigned yet. */
export const NoAssignments: Story = {
  args: { assignments: [] },
};

/** Everything eligible is already assigned. */
export const AllAssigned: Story = {
  args: { options: [] },
};

/** The record cannot take assignments at all. */
export const Blocked: Story = {
  args: {
    disabled: true,
    disabledTooltipKey: "pamAccessConnectorAssignTargetDisabled",
  },
};

/** The organization has nothing eligible at all. */
export const NothingEligible: Story = {
  args: {
    options: [],
    assignments: [],
    noneEligible: true,
    goToRoute: ["/organizations", "org-1", "pam", "rotation", "target-systems"],
    goToLabelKey: "pamAccessConnectorAssignGoToTargetSystems",
  },
};

/** The eligible list could not be read. */
export const LoadFailed: Story = {
  args: { options: [], loadError: true },
};

/** The other call site: the same card, with the target system page's three columns and badges. */
export const ConnectorColumns: Story = {
  args: {
    options: CONNECTOR_OPTIONS,
    assignments: CONNECTOR_ROWS as unknown as TargetRow[],
    columns: CONNECTOR_COLUMNS,
    hints: CONNECTOR_HINTS,
  },
  render: (args) => ({ props: args, template: connectorTemplate }),
};

/** The badge columns with nothing assigned. */
export const ConnectorColumnsEmpty: Story = {
  args: {
    options: CONNECTOR_OPTIONS,
    assignments: [],
    columns: CONNECTOR_COLUMNS,
    hints: CONNECTOR_HINTS,
  },
  render: (args) => ({ props: args, template: connectorTemplate }),
};
