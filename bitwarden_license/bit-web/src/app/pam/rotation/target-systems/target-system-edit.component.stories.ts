import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { TargetSystemId } from "../rotation";
import { AccessConnectorStatus, TargetSystemMethod } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  connectorId,
  ORGANIZATION_ID,
  pendingTargetSystem,
  rotationConfig,
  sysId,
  targetSystem,
  unverifiableTargetSystem,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { TargetSystemEditComponent } from "./target-system-edit.component";

const SAMPLE_SYSTEM = targetSystem({ name: "Prod Entra" });

/** An automatic target with connectors assigned to it, and one still free to assign. */
const ASSIGNED_SYSTEM = targetSystem({ id: sysId("assigned"), name: "Prod SQL" });

/** An automatic target every enabled connector is already assigned to. */
const SATURATED_SYSTEM = targetSystem({ id: sysId("saturated"), name: "Staging SQL" });

const MANUAL_SYSTEM = targetSystem({
  id: sysId("manual"),
  name: "Legacy mainframe",
  method: TargetSystemMethod.Manual,
  sealed: undefined,
});

/** A target `TargetSystemsClient.create` registered but never finished sealing. */
const PENDING_SYSTEM = pendingTargetSystem({ id: sysId("pending"), name: "Staging Entra" });

/** A target whose blob exists but failed to verify. */
const UNVERIFIABLE_SYSTEM = unverifiableTargetSystem({
  id: sysId("unverifiable"),
  name: "Finance SQL",
});

const SYSTEMS = [
  SAMPLE_SYSTEM,
  ASSIGNED_SYSTEM,
  SATURATED_SYSTEM,
  MANUAL_SYSTEM,
  PENDING_SYSTEM,
  UNVERIFIABLE_SYSTEM,
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
    assignedTargetSystemIds: [ASSIGNED_SYSTEM.id, SATURATED_SYSTEM.id],
  }),
  accessConnector({
    id: connectorId("c-3"),
    name: "Retired connector",
    status: AccessConnectorStatus.Disabled,
    isConnected: false,
    assignedTargetSystemIds: [SATURATED_SYSTEM.id],
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
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      ],
    }),
  ],
} as Meta<TargetSystemEditComponent>;

type Story = StoryObj<TargetSystemEditComponent>;

const at = (targetSystemId: TargetSystemId): ReturnType<typeof atUrl> =>
  atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems/${targetSystemId}`);

/** The connectors card is empty and neither setup step is done. */
export const Edit: Story = {
  decorators: [at(SAMPLE_SYSTEM.id)],
};

/** One connected and one disconnected connector, a spare to assign, and rotation set up. */
export const AssignedConnectors: Story = {
  decorators: [at(ASSIGNED_SYSTEM.id)],
};

/** The disabled connector still shows as assigned, and only the credential step is left. */
export const AllConnectorsAssigned: Story = {
  decorators: [at(SATURATED_SYSTEM.id)],
};

/** No integration or connector card, and no connector setup step. */
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
