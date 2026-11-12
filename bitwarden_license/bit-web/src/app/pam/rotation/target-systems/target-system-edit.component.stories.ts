import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { of } from "rxjs";
import { userEvent, within } from "storybook/test";

import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { TargetSystemId } from "../rotation";
import { AccessConnectorStatus, TargetSystemMethod, TargetSystemStatus } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  connectorId,
  ORGANIZATION_ID,
  pendingTargetSystem,
  rotationConfig,
  sysId,
  targetSystem,
  targetSystemSealedFields,
  unverifiableTargetSystem,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { TargetSystemEditComponent } from "./target-system-edit.component";

const SAMPLE_SYSTEM = targetSystem({ name: "Prod Entra" });

/** An automatic target with connectors assigned to it, and one still free to assign. */
const ASSIGNED_SYSTEM = targetSystem({ id: sysId("assigned"), name: "Prod SQL" });

/** An automatic target every enabled connector is already assigned to. */
const SATURATED_SYSTEM = targetSystem({ id: sysId("saturated"), name: "Staging SQL" });

/** A deactivated target; the page shows the inactive notice and Activate in place of Deactivate. */
const INACTIVE_SYSTEM = targetSystem({
  id: sysId("inactive"),
  name: "Legacy Reporting DB",
  status: TargetSystemStatus.Disabled,
});

const MANUAL_SYSTEM = targetSystem({
  id: sysId("manual"),
  name: "Legacy mainframe",
  method: TargetSystemMethod.Manual,
  sealed: targetSystemSealedFields({ kind: undefined, supportsSessionTermination: undefined }),
});

/** A target `TargetSystemsClient.create` registered but never finished sealing. */
const PENDING_SYSTEM = pendingTargetSystem({ id: sysId("pending"), name: "Staging Entra" });

/** A target whose blob exists but failed to verify. */
const UNVERIFIABLE_SYSTEM = unverifiableTargetSystem({
  id: sysId("unverifiable"),
  name: "Finance SQL",
});

// Single hex digits: `sysId` hashes longer labels into 16 ids, and these would collide.
/** Active, but its only access connector is disconnected, so it reads Not connected. */
const DISCONNECTED_SYSTEM = targetSystem({ id: sysId("7"), name: "AWS Production" });

/** Active, but its only access connector is inactive, so it reads Not connected. */
const RETIRED_CONNECTOR_SYSTEM = targetSystem({
  id: sysId("8"),
  name: "Legacy ERP admin",
});

const SYSTEMS = [
  SAMPLE_SYSTEM,
  ASSIGNED_SYSTEM,
  SATURATED_SYSTEM,
  INACTIVE_SYSTEM,
  MANUAL_SYSTEM,
  PENDING_SYSTEM,
  UNVERIFIABLE_SYSTEM,
  DISCONNECTED_SYSTEM,
  RETIRED_CONNECTOR_SYSTEM,
];

const CONNECTORS = [
  accessConnector({
    id: connectorId("c-1"),
    name: "Prod on-prem connector",
    assignedTargetSystemIds: [ASSIGNED_SYSTEM.id, SATURATED_SYSTEM.id],
  }),
  accessConnector({
    id: connectorId("c-2"),
    name: "Disconnected connector",
    isConnected: false,
    assignedTargetSystemIds: [ASSIGNED_SYSTEM.id, SATURATED_SYSTEM.id, DISCONNECTED_SYSTEM.id],
  }),
  accessConnector({
    id: connectorId("c-3"),
    name: "Retired connector",
    status: AccessConnectorStatus.Disabled,
    isConnected: false,
    assignedTargetSystemIds: [SATURATED_SYSTEM.id, INACTIVE_SYSTEM.id, RETIRED_CONNECTOR_SYSTEM.id],
  }),
  accessConnector({
    id: connectorId("c-4"),
    name: "Spare connector",
    assignedTargetSystemIds: [SATURATED_SYSTEM.id],
  }),
];

/** Only `ASSIGNED_SYSTEM` has a managed credential. */
const CONFIGS = [
  rotationConfig({ targetSystemId: ASSIGNED_SYSTEM.id, targetSystemName: ASSIGNED_SYSTEM.name }),
];

const rotationSdk: Partial<RotationSdkService> = {
  listTargetSystems: () => Promise.resolve(SYSTEMS),
  listConnectors: () => Promise.resolve(CONNECTORS),
  listConfigs: () => Promise.resolve(CONFIGS),
  updateTargetSystem: () => Promise.resolve(),
  enableTargetSystem: () => Promise.resolve(),
  disableTargetSystem: () => Promise.resolve(),
  deleteTargetSystem: () => Promise.resolve(),
  assignTarget: () => Promise.resolve(),
  unassignTarget: () => Promise.resolve(),
};

/** Mirrors `rotation.routes.ts`, minus its guards. */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "target-systems", children: [] },
      { path: "target-systems/new", component: TargetSystemEditComponent },
      { path: "target-systems/:targetSystemId", component: TargetSystemEditComponent },
    ],
  },
];

export default {
  title: "Web/PAM/Rotation/Target System Edit",
  component: TargetSystemEditComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        {
          provide: PlatformUtilsService,
          useValue: { copyToClipboard: (): void => undefined },
        },
        provideRouter(routes, withHashLocation()),
        { provide: RotationSdkService, useValue: rotationSdk },
        // Turns on VFO1Foundation, so bit-header renders its current layout.
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      ],
    }),
  ],
} as Meta<TargetSystemEditComponent>;

type Story = StoryObj<TargetSystemEditComponent>;

const at = (targetSystemId: TargetSystemId): ReturnType<typeof atUrl> =>
  atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/${targetSystemId}`);

/**
 * No access connector is assigned, so the field warns right away; Deactivate and Delete are in the
 * header's More menu.
 */
export const Edit: Story = {
  decorators: [at(SAMPLE_SYSTEM.id)],
};

/** One connected and one disconnected connector in the list, and rotation set up. */
export const AssignedConnectors: Story = {
  decorators: [at(ASSIGNED_SYSTEM.id)],
};

/** The retired connector still shows in the list, badged Inactive. */
export const AllConnectorsAssigned: Story = {
  decorators: [at(SATURATED_SYSTEM.id)],
};

/** Deactivated: the inactive notice, Activate in the header, and a retired connector. */
export const InactiveTarget: Story = {
  decorators: [at(INACTIVE_SYSTEM.id)],
};

/**
 * Inactive with an unsaved name: Activate and the More menu stay in the header. Save and
 * Cancel pin to the layout's footer, which only renders inside `bit-layout`.
 */
export const InactiveTargetEditing: Story = {
  decorators: [at(INACTIVE_SYSTEM.id)],
  play: async ({ canvasElement }) => {
    const name = await within(canvasElement).findByDisplayValue(INACTIVE_SYSTEM.name);
    await userEvent.type(name, " (EU)");
  },
};

/** Not connected: the only access connector is disconnected, so the field warns under it. */
export const NotConnectedDisconnectedConnector: Story = {
  decorators: [at(DISCONNECTED_SYSTEM.id)],
};

/** Not connected: the only access connector is inactive, so the field warns under it. */
export const NotConnectedInactiveConnector: Story = {
  decorators: [at(RETIRED_CONNECTOR_SYSTEM.id)],
};

/** No Automatic rotation section, and no connector setup step. */
export const ManualTarget: Story = {
  decorators: [at(MANUAL_SYSTEM.id)],
};

/** "Setup incomplete" callout, a kind picker in place of the read-only integration text. */
export const PendingSeal: Story = {
  decorators: [at(PENDING_SYSTEM.id)],
};

/** "Integrity check failed" callout; re-saving (with a chosen kind) re-secures the target. */
export const Unverifiable: Story = {
  decorators: [at(UNVERIFIABLE_SYSTEM.id)],
};

/** The add form, with the system type, ending sessions and access connectors inside General information. */
export const Create: Story = {
  decorators: [atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/new`)],
};

/** Reached from Add target system on the add managed credential form; the breadcrumb has three crumbs. */
export const CreateFromManagedCredential: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/new?then=managed-credential`,
    ),
  ],
};

/**
 * Reached from a managed credential's Assign access connector; lands on Access connectors, and
 * Save or Cancel returns to the credential. The middle crumb names the vault item once read.
 */
export const EditFromManagedCredential: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/${SAMPLE_SYSTEM.id}?then=credential&configId=cfg-1`,
    ),
  ],
};

const CREATE_URL = `/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/new`;

/** The organization's connectors as the Figma add flow draws them. */
// Single hex digits: `connectorId` hashes longer labels into 16 ids, which can collide.
const CREATE_CONNECTORS = [
  accessConnector({ id: connectorId("a"), name: "East datacenter" }),
  accessConnector({ id: connectorId("b"), name: "West datacenter", isConnected: false }),
  accessConnector({ id: connectorId("c"), name: "AWS production VPC" }),
  accessConnector({
    id: connectorId("d"),
    name: "Legacy datacenter",
    status: AccessConnectorStatus.Disabled,
    isConnected: false,
  }),
];

const withConnectors = (connectors: typeof CREATE_CONNECTORS) =>
  applicationConfig({
    providers: [
      {
        provide: RotationSdkService,
        useValue: { ...rotationSdk, listConnectors: () => Promise.resolve(connectors) },
      },
    ],
  });

/** Names the target and picks the connectors, the way the "Select Save" frames show the form. */
async function fillCreateForm(
  canvasElement: HTMLElement,
  name: string,
  connectorNames: string[],
): Promise<void> {
  const canvas = within(canvasElement);
  await userEvent.type(await canvas.findByRole("textbox", { name: /^Name/ }), name);
  for (const connectorName of connectorNames) {
    await userEvent.click(await canvas.findByRole("combobox", { name: /Access connectors/ }));
    await userEvent.click(
      await within(document.body).findByRole("option", { name: new RegExp(connectorName) }),
    );
    // Close by clicking away: Escape clears bit-multi-select's chips without changing its value.
    await userEvent.click(canvas.getByRole("textbox", { name: /^Name/ }));
  }
}

/** Figma "Choosing access connectors": Entra, its Supported badge, and the connector menu. */
export const CreateEntra: Story = {
  decorators: [atUrl(`${CREATE_URL}?template=entra`), withConnectors(CREATE_CONNECTORS)],
};

/** Figma 3a "Select Save": Entra with East datacenter chosen and connected. */
export const CreateEntraConnected: Story = {
  decorators: [atUrl(`${CREATE_URL}?template=entra`), withConnectors(CREATE_CONNECTORS)],
  play: ({ canvasElement }) =>
    fillCreateForm(canvasElement, "Entra ID staging", ["East datacenter"]),
};

/**
 * Figma 3b "Select Save": a custom script, which can't end sessions, with only a disconnected
 * connector chosen. The warning shows, but Save still works.
 */
export const CreateCustomScriptNoneConnected: Story = {
  decorators: [atUrl(`${CREATE_URL}?template=custom-script`), withConnectors(CREATE_CONNECTORS)],
  play: ({ canvasElement }) => fillCreateForm(canvasElement, "Payroll API", ["West datacenter"]),
};

/** Figma "Automatic, no access connectors in the organization yet": the picker is disabled. */
export const CreateNoConnectorsInOrg: Story = {
  decorators: [atUrl(CREATE_URL), withConnectors([])],
};

/** Figma "Manual selected": no system type, ending sessions or access connectors. */
export const CreateManual: Story = {
  decorators: [atUrl(`${CREATE_URL}?template=manual`)],
};
