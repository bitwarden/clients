import { importProvidersFrom } from "@angular/core";
import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { NEVER, of } from "rxjs";
import { userEvent } from "storybook/test";

import { DialogService, ToastService } from "@bitwarden/components";
import { DAY, fromNow, startClockAtStoryNow } from "@bitwarden/storybook";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessConnector, TargetSystemView } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  ORGANIZATION_ID,
  accessConnector,
  connectorId,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { AccessConnectorsTabComponent } from "./access-connectors-tab.component";
import { AccessConnectorRow, AccessConnectorsService } from "./access-connectors.service";

// The builders hash labels onto 16 ids, so these labels are picked to stay distinct per type.
const TARGET_SYSTEMS: TargetSystemView[] = [
  targetSystem({ id: sysId("aws"), name: "AWS Production" }),
  targetSystem({ id: sysId("warehouse"), name: "Data Warehouse" }),
  targetSystem({ id: sysId("entra"), name: "Entra ID production" }),
  targetSystem({ id: sysId("entra-staging"), name: "Entra ID staging" }),
  targetSystem({ id: sysId("okta"), name: "Okta" }),
  targetSystem({ id: sysId("sql"), name: "Reporting SQL" }),
];

const nameById = new Map(TARGET_SYSTEMS.map((s) => [s.id, s.name]));

function row(connector: AccessConnector): AccessConnectorRow {
  return {
    id: connector.id,
    name: connector.name,
    statusLabelKey: connector.status === "enabled" ? "active" : "inactive",
    isConnected: connector.isConnected,
    assignmentNames: connector.assignedTargetSystemIds.map((id) => nameById.get(id) ?? String(id)),
    enabled: connector.status === "enabled",
    canAssign: connector.status === "enabled",
    lastSeenAtMs: connector.lastHeartbeatAt ? Date.parse(connector.lastHeartbeatAt) : null,
    accessConnector: connector,
  };
}

const ago = (ms: number) => fromNow(-ms);
const assigned = (...labels: string[]) => labels.map((label) => sysId(label));

/** The six connectors of the Figma table, one per status and assignment shape. */
const CONNECTORS: AccessConnector[] = [
  accessConnector({
    id: connectorId("west"),
    name: "West datacenter",
    isConnected: false,
    lastHeartbeatAt: ago(400 * DAY),
    assignedTargetSystemIds: assigned("aws", "warehouse", "okta", "sql"),
  }),
  accessConnector({
    id: connectorId("stage"),
    name: "Staging datacenter",
    isConnected: false,
    lastHeartbeatAt: undefined,
    assignedTargetSystemIds: [],
  }),
  accessConnector({
    id: connectorId("legacy"),
    name: "Legacy datacenter",
    status: "disabled",
    isConnected: true,
    lastHeartbeatAt: ago(420 * DAY),
    assignedTargetSystemIds: assigned("warehouse"),
  }),
  accessConnector({
    id: connectorId("east"),
    name: "East datacenter",
    lastHeartbeatAt: ago(10_000),
    assignedTargetSystemIds: assigned("aws", "warehouse", "entra-staging", "okta", "sql"),
  }),
  accessConnector({
    id: connectorId("azure"),
    name: "Azure production",
    lastHeartbeatAt: ago(10_000),
    assignedTargetSystemIds: assigned("entra-staging"),
  }),
  accessConnector({
    id: connectorId("aws-vpc"),
    name: "AWS production VPC",
    lastHeartbeatAt: ago(10_000),
    assignedTargetSystemIds: [],
  }),
] as AccessConnector[];

const ROWS = CONNECTORS.map(row);

function rotationServices(rows: AccessConnectorRow[], loading = false) {
  return moduleMetadata({
    providers: [
      {
        provide: AccessConnectorsService,
        useValue: {
          loading$: of(loading),
          loadError$: of(null),
          rows$: loading ? NEVER : of(rows),
          accessConnectors$: of(rows.map((r) => r.accessConnector)),
          load: () => Promise.resolve(),
          registerCompleted: () => Promise.resolve(),
          assign: () => Promise.resolve(),
          setEnabled: () => Promise.resolve(),
          delete: () => Promise.resolve(),
        },
      },
      {
        provide: TargetSystemsService,
        useValue: {
          automaticSystems$: of(TARGET_SYSTEMS),
          loading$: of(false),
          loadError$: of(null),
          load: () => Promise.resolve(),
        },
      },
    ],
  });
}

async function openRowMenu(canvasElement: HTMLElement, label: string): Promise<void> {
  await userEvent.click(
    canvasElement.querySelector<HTMLButtonElement>(
      `#access-connectors-tab_button_menu-${connectorId(label)}`,
    )!,
  );
}

/** Mirrors `rotation.routes.ts`, minus its guards, since the component declares no selector. */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [{ path: "access-connectors", component: AccessConnectorsTabComponent }],
  },
];

export default {
  title: "Web/PAM/Rotation/Access Connectors Tab",
  component: AccessConnectorsTabComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  // The last-seen labels are relative to `Date.now()`, so the clock starts where the dates do.
  beforeEach: startClockAtStoryNow,
  decorators: [
    moduleMetadata({ imports: [RouterOutlet] }),
    atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors`),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        provideNoopAnimations(),
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
      ],
    }),
  ],
} as Meta<AccessConnectorsTabComponent>;

type Story = StoryObj<AccessConnectorsTabComponent>;

/** A1: opens sorted by urgency, Disconnected, Inactive, Connected, most target systems first. */
export const Table: Story = {
  decorators: [rotationServices(ROWS)],
};

/** A4: a connected or disconnected connector's row menu. */
export const RowMenuActive: Story = {
  ...Table,
  play: async ({ canvasElement }) => openRowMenu(canvasElement, "east"),
};

/** A4: an inactive connector's row menu, with Assign target systems disabled and the reason. */
export const RowMenuInactive: Story = {
  ...Table,
  play: async ({ canvasElement }) => openRowMenu(canvasElement, "legacy"),
};

/** A5: the status filter, one option per badge, in urgency order. */
export const StatusFilter: Story = {
  ...Table,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLButtonElement>(
        'bit-filter-menu[key="status"] button[bit-chip-content]',
      )!,
    );
  },
};

/** A5: the target system filter, every automatic target system with its connector count. */
export const TargetSystemFilter: Story = {
  ...Table,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLButtonElement>(
        'bit-filter-menu[key="targetSystem"] button[bit-chip-content]',
      )!,
    );
  },
};

/** D3: no connectors registered yet. */
export const Empty: Story = {
  decorators: [rotationServices([])],
};

export const Loading: Story = {
  decorators: [rotationServices([], true)],
};
