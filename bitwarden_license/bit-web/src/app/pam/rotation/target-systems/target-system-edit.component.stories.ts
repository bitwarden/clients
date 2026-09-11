import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";

import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessConnectorStatus, TargetSystemMethod } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  connectorId,
  ORGANIZATION_ID,
  rotationConfig,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { TargetSystemEditComponent } from "./target-system-edit.component";

const SAMPLE_SYSTEM = targetSystem({ name: "Prod Entra" });

/** An automatic target with connectors assigned to it, and one still free to assign. */
const ASSIGNED_SYSTEM = targetSystem({ id: sysId("assigned"), name: "Prod SQL" });

/** An automatic target every enabled connector is already assigned to. */
const SATURATED_SYSTEM = targetSystem({ id: sysId("saturated"), name: "Staging SQL" });

/** A manual target: rotated by hand. */
const MANUAL_SYSTEM = targetSystem({
  id: sysId("manual"),
  name: "Legacy mainframe",
  method: TargetSystemMethod.Manual,
  kind: undefined,
});

const SYSTEMS = [SAMPLE_SYSTEM, ASSIGNED_SYSTEM, SATURATED_SYSTEM, MANUAL_SYSTEM];

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
    assignedTargetSystemIds: [ASSIGNED_SYSTEM.id],
  }),
  accessConnector({
    id: connectorId("c-3"),
    name: "Retired connector",
    status: AccessConnectorStatus.Disabled,
    isConnected: false,
    assignedTargetSystemIds: [SATURATED_SYSTEM.id],
  }),
  accessConnector({ id: connectorId("c-4"), name: "Spare connector" }),
];

/**
 * The org's managed credentials.
 */
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

/**
 * Mirrors `rotation.routes.ts` (minus its guards).
 */
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
        provideRouter(routes, withHashLocation()),
        { provide: RotationSdkService, useValue: rotationSdk },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      ],
    }),
  ],
} as Meta<TargetSystemEditComponent>;

type Story = StoryObj<TargetSystemEditComponent>;

const at = (targetSystemId: string): ReturnType<typeof atUrl> =>
  atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/${targetSystemId}`);

/**
 * Edit mode: the breadcrumb trail reads "Target systems > Edit target system", and the
 * assigned-access-connectors card sits in its empty state. The footer's only right-hand action is
 * Delete. Neither setup step is done.
 */
export const Edit: Story = {
  decorators: [at(SAMPLE_SYSTEM.id)],
};

/**
 * Two assigned connectors, one connected and one not, with a spare left to assign: the card's
 * table renders both status and connection badges and a remove control per row. Rotation is fully
 * set up here.
 */
export const AssignedConnectors: Story = {
  decorators: [at(ASSIGNED_SYSTEM.id)],
};

/**
 * Every enabled connector is already assigned here. The disabled connector still shows as an
 * assigned row. Only the credential is outstanding.
 */
export const AllConnectorsAssigned: Story = {
  decorators: [at(SATURATED_SYSTEM.id)],
};

/**
 * A manual target: no integration, no connector. The connector step does not apply to it.
 */
export const ManualTarget: Story = {
  decorators: [at(MANUAL_SYSTEM.id)],
};
