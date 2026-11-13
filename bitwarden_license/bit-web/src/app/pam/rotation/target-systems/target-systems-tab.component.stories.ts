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
import { userEvent } from "storybook/test";

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
    sealed: targetSystemSealedFields({ kind: undefined, supportsSessionTermination: undefined }),
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

/**
 * The design's table (Figma "A: The Target systems table"): three Not connected, one Inactive and
 * seven Active targets, two of them manual.
 */
const FIGMA_SYSTEMS: TargetSystemView[] = [
  figmaSystem("1", "AWS Production", "custom_script"),
  figmaSystem("2", "Network Firewall", "custom_script"),
  figmaSystem("3", "Legacy ERP admin", "custom_script"),
  figmaSystem("4", "SIEM Cluster", "custom_script", { status: "disabled" }),
  figmaSystem("5", "Entra ID production", "entra"),
  figmaSystem("6", "Legacy Reporting DB", "custom_script"),
  figmaSystem("7", "Data Warehouse", "custom_script"),
  figmaSystem("8", "Okta Identity", "custom_script"),
  figmaSystem("9", "Finance Reporting DB", null),
  figmaSystem("a", "Entra ID staging", "entra"),
  figmaSystem("b", "HR Payroll DB", null),
];

function figmaSystem(
  label: string,
  name: string,
  kind: "entra" | "custom_script" | null,
  overrides: Partial<TargetSystemView> = {},
): TargetSystemView {
  return targetSystem({
    id: sysId(label),
    name,
    method: kind == null ? "manual" : "automatic",
    sealed:
      kind == null
        ? targetSystemSealedFields({ kind: undefined, supportsSessionTermination: undefined })
        : targetSystemSealedFields({ kind }),
    ...overrides,
  } as Partial<TargetSystemView>);
}

/** The disconnected West datacenter alone holds the three Not connected targets. */
const FIGMA_CONNECTORS: AccessConnector[] = [
  accessConnector({
    id: connectorId("1"),
    name: "East datacenter",
    assignedTargetSystemIds: ["5", "6", "7", "8", "a"].map(sysId),
  }),
  accessConnector({
    id: connectorId("2"),
    name: "West datacenter",
    isConnected: false,
    assignedTargetSystemIds: ["1", "2", "3", "4"].map(sysId),
  }),
  accessConnector({
    id: connectorId("3"),
    name: "Azure production",
    assignedTargetSystemIds: [sysId("8")],
  }),
  accessConnector({
    id: connectorId("4"),
    name: "Legacy datacenter",
    isConnected: false,
    assignedTargetSystemIds: [sysId("4")],
  }),
  accessConnector({ id: connectorId("5"), name: "AWS production VPC" }),
  accessConnector({ id: connectorId("6"), name: "Staging datacenter" }),
];

/** Managed credentials per target, as the design's count column shows them. */
const FIGMA_CONFIGS: RotationConfigView[] = Object.entries({
  "1": 3,
  "2": 3,
  "3": 1,
  "4": 4,
  "5": 8,
  "6": 8,
  "7": 6,
  "8": 4,
  "9": 2,
}).flatMap(([label, count]) =>
  Array.from({ length: count }, () => rotationConfig({ targetSystemId: sysId(label) })),
);

const figmaServices = () => rotationServices(FIGMA_SYSTEMS, FIGMA_CONNECTORS, FIGMA_CONFIGS);

/** Opens the row menu of the target with this `sysId` label. */
function openRowMenu(label: string): Story["play"] {
  return async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLButtonElement>(
        `[id="target-systems-tab_button_options-${sysId(label)}"]`,
      )!,
    );
  };
}

/** Opens the filter chip with this key. */
function openFilter(key: string): Story["play"] {
  return async ({ canvasElement }) => {
    await userEvent.click(
      canvasElement.querySelector<HTMLButtonElement>(
        `bit-filter-menu[key="${key}"] button[bit-chip-content]`,
      )!,
    );
  };
}

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

/** Every row offers Activate in place of Deactivate. */
export const AllDisabled: Story = {
  decorators: [
    rotationServices(SYSTEMS.map((system) => targetSystem({ ...system, status: "disabled" }))),
  ],
};

export const Empty: Story = {
  decorators: [rotationServices([])],
};

/** Figma 665:26499, the populated table. */
export const TargetSystemsTable: Story = {
  decorators: [figmaServices()],
};

/** Figma 672:21780, an automatic target's menu; it has managed credentials, so Delete is locked. */
export const RowMenuAutomatic: Story = {
  decorators: [figmaServices()],
  play: openRowMenu("1"),
};

/** Figma 672:21849, an inactive target's menu, offering Activate. */
export const RowMenuInactive: Story = {
  decorators: [figmaServices()],
  play: openRowMenu("4"),
};

/** Figma 672:21900, a manual target's menu: no access connectors to assign. */
export const RowMenuManual: Story = {
  decorators: [figmaServices()],
  play: openRowMenu("9"),
};

/** Figma 672:21951, a target with no managed credentials, so Delete is live. */
export const RowMenuNoManagedCredentials: Story = {
  decorators: [figmaServices()],
  play: openRowMenu("a"),
};

/** Figma 672:22067. */
export const StatusFilter: Story = {
  decorators: [figmaServices()],
  play: openFilter("status"),
};

/** Figma 672:22088. */
export const RotationMethodFilter: Story = {
  decorators: [figmaServices()],
  play: openFilter("method"),
};

/** Figma 672:22081. */
export const SystemTypeFilter: Story = {
  decorators: [figmaServices()],
  play: openFilter("kind"),
};

/** Figma 672:22100. */
export const AccessConnectorFilter: Story = {
  decorators: [figmaServices()],
  play: openFilter("connector"),
};

/** Figma 1081:43729, filters that match no target system. */
export const NoFilterMatches: Story = {
  decorators: [figmaServices()],
  play: async ({ canvasElement }) => {
    await userEvent.type(
      canvasElement.querySelector<HTMLInputElement>("bit-search input")!,
      "No such target system",
    );
  },
};
