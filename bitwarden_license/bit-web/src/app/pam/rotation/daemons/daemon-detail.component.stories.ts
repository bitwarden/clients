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

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AccessConnectorStatus } from "../rotation";
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
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { DaemonDetailComponent } from "./daemon-detail.component";

const SAMPLE_DETAIL = accessConnectorDetail({
  connector: accessConnector({ name: "Prod on-prem connector" }),
});

const LONG_NAME_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("long-name"),
    name: "AWS us-east-1 Production On-Prem Access Connector Primary",
  }),
});

const OFFLINE_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("offline"),
    name: "Offline connector",
    isConnected: false,
  }),
});

const NEVER_SEEN_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("never-seen"),
    name: "Never seen connector",
    isConnected: false,
    lastHeartbeatAt: undefined,
  }),
});

const DISABLED_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("disabled"),
    name: "Disabled connector",
    status: AccessConnectorStatus.Disabled,
  }),
});

const TARGET_SYSTEM_A = targetSystem({ id: sysId("a"), name: "Prod Entra" });
const TARGET_SYSTEM_B = targetSystem({ id: sysId("b"), name: "Staging Postgres" });

const POPULATED_DETAIL = accessConnectorDetail({
  connector: accessConnector({
    id: connectorId("populated"),
    name: "Populated connector",
    assignedTargetSystemIds: [TARGET_SYSTEM_A.id, TARGET_SYSTEM_B.id],
  }),
  jobs: [
    rotationJob(),
    rotationJob({ id: jobId("job-2"), rotationConfigId: configId("cfg-2"), status: "failed" }),
  ],
});

const SECOND_CIPHER_ID = id("9") as CipherView["id"];

/** The two configs behind POPULATED_DETAIL's jobs, so the History tab can name each credential. */
const ROTATION_CONFIGS = [
  rotationConfig(),
  rotationConfig({ id: configId("cfg-2"), cipherId: SECOND_CIPHER_ID as never }),
];

const CIPHERS = [
  { id: CIPHER_ID, name: "svc-entra-admin", type: CipherType.Login, isDeleted: false },
  { id: SECOND_CIPHER_ID, name: "svc-postgres-owner", type: CipherType.Login, isDeleted: false },
] as unknown as CipherView[];

const CONNECTORS_BY_ID = new Map(
  [
    SAMPLE_DETAIL,
    LONG_NAME_DETAIL,
    OFFLINE_DETAIL,
    NEVER_SEEN_DETAIL,
    DISABLED_DETAIL,
    POPULATED_DETAIL,
  ].map((detail) => [detail.connector.id, detail]),
);

const rotationSdk: Partial<RotationSdkService> = {
  listTargetSystems: () => Promise.resolve([TARGET_SYSTEM_A, TARGET_SYSTEM_B]),
  getConnector: (_organizationId, id) => Promise.resolve(CONNECTORS_BY_ID.get(id) ?? SAMPLE_DETAIL),
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
        path: "access-connectors/:daemonId",
        pathMatch: "full",
        redirectTo: "access-connectors/:daemonId/configuration",
      },
      { path: "access-connectors/:daemonId/:tab", component: DaemonDetailComponent },
    ],
  },
];

export default {
  title: "Web/PAM/Rotation/Access Connector Detail",
  component: DaemonDetailComponent,
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
} as Meta<DaemonDetailComponent>;

type Story = StoryObj<DaemonDetailComponent>;

/** The breadcrumb trail reads "Access connectors > Prod on-prem connector" — the connector's own name. */
export const Default: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${SAMPLE_DETAIL.connector.id}`,
    ),
  ],
};

export const LongName: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${LONG_NAME_DETAIL.connector.id}`,
    ),
  ],
};

/** Disconnected connector: the Connection field's badge reads "Disconnected". */
export const Offline: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${OFFLINE_DETAIL.connector.id}`,
    ),
  ],
};

export const NeverSeen: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${NEVER_SEEN_DETAIL.connector.id}`,
    ),
  ],
};

/**
 * Inactive connector: the header's status badge reads "Inactive" and the Active checkbox is
 * cleared, while the target picker and its Assign button stay visible but disabled, with a
 * tooltip saying why.
 */
export const Disabled: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${DISABLED_DETAIL.connector.id}`,
    ),
  ],
};

/**
 * Two assigned targets, on the Configuration tab: the assignments table lists both targets with
 * their own Remove buttons and the picker has nothing left to offer.
 */
export const Populated: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${POPULATED_DETAIL.connector.id}/configuration`,
    ),
  ],
};

export const History: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${POPULATED_DETAIL.connector.id}/history`,
    ),
  ],
};
