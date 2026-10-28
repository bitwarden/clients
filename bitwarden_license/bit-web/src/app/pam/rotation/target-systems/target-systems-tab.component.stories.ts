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

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import { RotationConfigsService } from "../managed-credentials/rotation-configs.service";
import { AccessConnector, RotationConfigView, TargetSystemView } from "../rotation";
import {
  ORGANIZATION_ID,
  accessConnector,
  connectorId,
  pendingTargetSystem,
  rotationConfig,
  sysId,
  targetSystem,
  targetSystemSealedFields,
  unverifiableTargetSystem,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { TargetSystemsTabComponent } from "./target-systems-tab.component";
import { TargetSystemsService } from "./target-systems.service";

/** Every method, kind, status and seal state the chips and columns can offer. */
const SYSTEMS: TargetSystemView[] = [
  targetSystem({
    id: sysId("1"),
    name: "Prod Entra",
    sealed: targetSystemSealedFields({ kind: "entra" }),
  }),
  targetSystem({
    id: sysId("3"),
    name: "Billing rotation script",
    sealed: targetSystemSealedFields({ kind: "custom_script" }),
  }),
  targetSystem({
    id: sysId("4"),
    name: "Retired Entra sandbox",
    sealed: targetSystemSealedFields({ kind: "entra" }),
    status: "disabled",
  }),
  targetSystem({
    id: sysId("5"),
    name: "Legacy mainframe",
    method: "manual",
    sealed: undefined,
  }),
  pendingTargetSystem({ id: sysId("6"), name: "Staging Entra (setup incomplete)" }),
  unverifiableTargetSystem({ id: sysId("7"), name: "Finance SQL (integrity check failed)" }),
];

/**
 * One connected connector holding the first target, one disconnected holding the billing script,
 * and one holding nothing, so the status column shows Not connected beside Active and the
 * Access connector chip lists a zero-count option.
 */
const CONNECTORS: AccessConnector[] = [
  accessConnector({
    id: connectorId("c"),
    name: "East datacenter",
    assignedTargetSystemIds: [sysId("1")],
  }),
  accessConnector({
    id: connectorId("d"),
    name: "West datacenter",
    isConnected: false,
    assignedTargetSystemIds: [sysId("3")],
  }),
  accessConnector({
    id: connectorId("e"),
    name: "Staging datacenter",
    assignedTargetSystemIds: [],
  }),
];

/** Credentials on the first two targets, so the count column shows numbers and "None". */
const CONFIGS: RotationConfigView[] = [
  rotationConfig({ targetSystemId: sysId("1") }),
  rotationConfig({ targetSystemId: sysId("1") }),
  rotationConfig({ targetSystemId: sysId("1") }),
  rotationConfig({ targetSystemId: sysId("3") }),
];

function rotationServices(
  systems: TargetSystemView[],
  connectors: AccessConnector[] = CONNECTORS,
  configs: RotationConfigView[] = CONFIGS,
) {
  return moduleMetadata({
    imports: [RouterOutlet],
    providers: [
      {
        provide: TargetSystemsService,
        useValue: {
          loading$: of(false),
          loadError$: of(null),
          systems$: of(systems),
          systemById$: of(new Map(systems.map((s) => [s.id, s] as const))),
          automaticSystems$: of(systems.filter((s) => s.status === "active")),
          load: () => Promise.resolve(),
          setEnabled: () => Promise.resolve(),
          delete: () => Promise.resolve(),
        },
      },
      {
        provide: AccessConnectorsService,
        useValue: {
          accessConnectors$: of(connectors),
          loading$: of(false),
          loadError$: of(null),
          load: () => Promise.resolve(),
          forgetTargetSystem: () => {},
          assign: () => Promise.resolve(),
        },
      },
      {
        provide: RotationConfigsService,
        useValue: {
          configs$: of(configs),
          loading$: of(false),
          loadError$: of(null),
        },
      },
    ],
  });
}

/** Mirrors `rotation.routes.ts`, minus its guards, since the component declares no selector. */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [{ path: "target-systems", component: TargetSystemsTabComponent }],
  },
];

export default {
  title: "Web/PAM/Rotation/Target Systems Tab",
  component: TargetSystemsTabComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/target-systems`),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        {
          provide: PlatformUtilsService,
          useValue: { copyToClipboard: (): void => undefined },
        },
        provideRouter(routes, withHashLocation()),
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
      ],
    }),
  ],
} as Meta<TargetSystemsTabComponent>;

type Story = StoryObj<TargetSystemsTabComponent>;

/**
 * The full toolbar, with search and the Status, Rotation method, System type and Access connector
 * chips, each with options and counts.
 */
export const Default: Story = {
  decorators: [rotationServices(SYSTEMS)],
};

/** No row offers "Add managed credential". */
export const AllDisabled: Story = {
  decorators: [
    rotationServices(SYSTEMS.map((system) => targetSystem({ ...system, status: "disabled" }))),
  ],
};

export const Empty: Story = {
  decorators: [rotationServices([])],
};
