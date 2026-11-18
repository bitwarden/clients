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

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessConnectorStatus, TargetSystemKind, TargetSystemStatus } from "../rotation";
import type { AccessConnectorDetail } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  accessConnectorDetail,
  CIPHER_ID,
  configId,
  connectorId,
  id,
  jobId,
  ORGANIZATION_ID,
  rotationConfig,
  rotationJob,
  sysId,
  targetSystem,
  targetSystemSealedFields,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { AccessConnectorDetailComponent } from "./access-connector-detail.component";

const HOUR_MS = 60 * 60 * 1000;
const hoursAgo = (hours: number): string => new Date(Date.now() - hours * HOUR_MS).toISOString();

// The builders hash labels onto 16 ids, so these labels are picked to stay distinct per type.
const LEGACY_REPORTING_DB = targetSystem({
  id: sysId("legacy-reporting"),
  name: "Legacy Reporting DB",
  status: TargetSystemStatus.Disabled,
  sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
});
const DATA_WAREHOUSE = targetSystem({
  id: sysId("warehouse"),
  name: "Data Warehouse",
  sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
});
const OKTA_IDENTITY = targetSystem({
  id: sysId("okta-identity"),
  name: "Okta Identity",
  sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
});
const SIEM_CLUSTER = targetSystem({
  id: sysId("siem"),
  name: "SIEM Cluster",
  sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
});
const NETWORK_FIREWALL = targetSystem({
  id: sysId("firewall"),
  name: "Network Firewall",
  sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
});
const LEGACY_ERP_ADMIN = targetSystem({
  id: sysId("legacy-erp"),
  name: "Legacy ERP admin",
  sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
});
const AWS_PRODUCTION = targetSystem({
  id: sysId("aws-production"),
  name: "AWS Production",
  sealed: targetSystemSealedFields({ kind: TargetSystemKind.CustomScript }),
});
const ENTRA_PRODUCTION = targetSystem({
  id: sysId("entra-production"),
  name: "Entra ID production",
});

const TARGET_SYSTEMS = [
  LEGACY_REPORTING_DB,
  DATA_WAREHOUSE,
  OKTA_IDENTITY,
  SIEM_CLUSTER,
  NETWORK_FIREWALL,
  LEGACY_ERP_ADMIN,
  AWS_PRODUCTION,
  ENTRA_PRODUCTION,
];

/** 1a: connected, four targets, one of them deactivated. */
const CONNECTED_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("east"),
    name: "East datacenter",
    lastHeartbeatAt: new Date().toISOString(),
    assignedTargetSystemIds: [
      LEGACY_REPORTING_DB.id,
      DATA_WAREHOUSE.id,
      OKTA_IDENTITY.id,
      SIEM_CLUSTER.id,
    ],
  }),
});

/** 1b: disconnected after being seen earlier today; Network Firewall has no one else. */
const DISCONNECTED_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("west"),
    name: "West datacenter",
    isConnected: false,
    lastHeartbeatAt: hoursAgo(3),
    assignedTargetSystemIds: [
      NETWORK_FIREWALL.id,
      DATA_WAREHOUSE.id,
      OKTA_IDENTITY.id,
      SIEM_CLUSTER.id,
    ],
  }),
});

/** 1c and B: registered but never connected, with nothing assigned. */
const NEVER_CONNECTED_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("stage"),
    name: "Staging datacenter",
    isConnected: false,
    lastHeartbeatAt: undefined,
    assignedTargetSystemIds: [],
  }),
});

/** 1d: deactivated, its only target left with no connector to serve it. */
const INACTIVE_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("legacy"),
    name: "Legacy datacenter",
    status: AccessConnectorStatus.Disabled,
    lastHeartbeatAt: hoursAgo(24 * 30),
    assignedTargetSystemIds: [LEGACY_ERP_ADMIN.id],
  }),
});

/** C2: connected, with nothing assigned yet. */
const NO_TARGETS_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("aws-vpc"),
    name: "AWS production VPC",
    lastHeartbeatAt: new Date().toISOString(),
    assignedTargetSystemIds: [],
  }),
});

/** C3, C4 and C5: connected, serving Entra ID production, with rotations to show. */
const AZURE_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("azure"),
    name: "Azure production",
    lastHeartbeatAt: new Date().toISOString(),
    assignedTargetSystemIds: [ENTRA_PRODUCTION.id],
  }),
  jobs: [
    rotationJob(),
    rotationJob({ id: jobId("job-2"), rotationConfigId: configId("cfg-2"), status: "failed" }),
  ],
});

const AZURE_NO_HISTORY_DETAIL = accessConnectorDetail({
  connector: { ...AZURE_DETAIL.connector, id: connectorId("azure-quiet") },
  jobs: [],
});

const LONG_NAME_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("long-name"),
    name: "AWS us-east-1 Production On-Prem Access Connector Primary",
  }),
});

const SECOND_CIPHER_ID = id("9") as CipherView["id"];

/** The two configs behind AZURE_DETAIL's jobs, so the history tab can name each credential. */
const ROTATION_CONFIGS = [
  rotationConfig(),
  rotationConfig({ id: configId("cfg-2"), cipherId: SECOND_CIPHER_ID as never }),
];

const CIPHERS = [
  { id: CIPHER_ID, name: "Splunk forwarder account", type: CipherType.Login, isDeleted: false },
  {
    id: SECOND_CIPHER_ID,
    name: "Salesforce integration user",
    type: CipherType.Login,
    isDeleted: false,
  },
] as unknown as CipherView[];

const DETAILS = [
  CONNECTED_DETAIL,
  DISCONNECTED_DETAIL,
  NEVER_CONNECTED_DETAIL,
  INACTIVE_DETAIL,
  NO_TARGETS_DETAIL,
  AZURE_DETAIL,
  AZURE_NO_HISTORY_DETAIL,
  LONG_NAME_DETAIL,
];

const CONNECTORS_BY_ID = new Map(DETAILS.map((detail) => [detail.connector.id, detail]));

const rotationSdk: Partial<RotationSdkService> = {
  listTargetSystems: () => Promise.resolve(TARGET_SYSTEMS),
  listConnectors: () => Promise.resolve(DETAILS.map((detail) => detail.connector)),
  getConnector: (_organizationId, id) =>
    Promise.resolve(CONNECTORS_BY_ID.get(id) ?? CONNECTED_DETAIL),
  enableConnector: () => Promise.resolve(),
  disableConnector: () => Promise.resolve(),
  deleteConnector: () => Promise.resolve(),
  assignTarget: () => Promise.resolve(),
  unassignTarget: () => Promise.resolve(),
  listConfigs: () => Promise.resolve(ROTATION_CONFIGS),
};

const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "access-connectors", children: [] },
      { path: "target-systems", children: [] },
      {
        path: "access-connectors/:accessConnectorId",
        pathMatch: "full",
        redirectTo: "access-connectors/:accessConnectorId/configuration",
      },
      {
        path: "access-connectors/:accessConnectorId/:tab",
        component: AccessConnectorDetailComponent,
      },
    ],
  },
];

export default {
  title: "Web/PAM/Rotation/Access Connector Detail",
  component: AccessConnectorDetailComponent,
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
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: ORGANIZATION_ID }) } as unknown as AccountService,
        },
        {
          provide: OrganizationService,
          useValue: { organizations$: () => of([]) } as unknown as OrganizationService,
        },
        {
          provide: CipherService,
          useValue: {
            getManyFromApiForOrganization: () => Promise.resolve(CIPHERS),
          } as unknown as CipherService,
        },
      ],
    }),
  ],
} as Meta<AccessConnectorDetailComponent>;

type Story = StoryObj<AccessConnectorDetailComponent>;

const at = (detail: AccessConnectorDetail, tab = "configuration") =>
  atUrl(
    `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${detail.connector.id}/${tab}`,
  );

async function openMoreMenu(canvasElement: HTMLElement): Promise<void> {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: "More options" }));
}

/** Figma 1092:45241 (1a): Connected; the header holds only the More menu. */
export const Connected: Story = {
  decorators: [at(CONNECTED_DETAIL)],
};

/** Figma 1094:51410 (1b): Disconnected after being seen, with the warning callout. */
export const DisconnectedLastSeen: Story = {
  decorators: [at(DISCONNECTED_DETAIL)],
};

/**
 * Figma 1094:51917 (1c) and 1084:58384 (B, the page Close opens after registering): never
 * connected, with the setup callout and an empty picker.
 */
export const NeverConnected: Story = {
  decorators: [at(NEVER_CONNECTED_DETAIL)],
};

/** Figma 1094:52481 (1d): Inactive; Activate beside the More menu. */
export const Inactive: Story = {
  decorators: [at(INACTIVE_DETAIL)],
};

/** Figma 1096:54287 (1e): an active connector's More menu, Deactivate and Delete. */
export const MoreMenuActive: Story = {
  decorators: [at(CONNECTED_DETAIL)],
  play: async ({ canvasElement }) => openMoreMenu(canvasElement),
};

/** Figma 1096:54286 (1e): an inactive connector's More menu, Delete only. */
export const MoreMenuInactive: Story = {
  decorators: [at(INACTIVE_DETAIL)],
  play: async ({ canvasElement }) => openMoreMenu(canvasElement),
};

async function openTargetSystemPicker(canvasElement: HTMLElement): Promise<void> {
  const picker = canvasElement.querySelector<HTMLElement>(
    "#access-connector-detail_multi-select_target-systems input",
  );
  if (picker != null) {
    await userEvent.click(picker);
  }
}

/** Figma 1096:54324 (C2 step 1): a connected connector with no target systems yet, picker open. */
export const ChooseTargetSystems: Story = {
  decorators: [at(NO_TARGETS_DETAIL)],
  play: async ({ canvasElement }) => openTargetSystemPicker(canvasElement),
};

/**
 * Figma 1096:55159 (C2 step 2): AWS Production staged, listed with its status. Save and Cancel
 * pin to the layout's footer, which only renders inside `bit-layout`.
 */
export const TargetSystemStaged: Story = {
  decorators: [at(NO_TARGETS_DETAIL)],
  play: async ({ canvasElement }) => {
    await openTargetSystemPicker(canvasElement);
    await userEvent.click(
      await within(document.body).findByRole("option", { name: /^AWS Production/ }),
    );
    await userEvent.keyboard("{Tab}");
  },
};

/** Figma 1096:56430 (C3 step 1) and 1096:57558 (C4 step 1): Azure production. */
export const AzureProduction: Story = {
  decorators: [at(AZURE_DETAIL)],
};

/** Figma 1096:60098 (5a): Rotation history with no rotations yet; no header actions. */
export const RotationHistoryEmpty: Story = {
  decorators: [at(AZURE_NO_HISTORY_DETAIL, "history")],
};

/** Figma 1096:60429 (5b): Rotation history naming each job's managed credential. */
export const RotationHistory: Story = {
  decorators: [at(AZURE_DETAIL, "history")],
};

export const LongName: Story = {
  decorators: [at(LONG_NAME_DETAIL)],
};
