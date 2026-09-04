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

import { AccessConnectorStatus } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  accessConnector,
  accessConnectorDetail,
  connectorId,
  jobId,
  ORGANIZATION_ID,
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
  jobs: [rotationJob(), rotationJob({ id: jobId("job-2"), status: "failed" })],
});

const CONNECTORS_BY_ID = new Map(
  [SAMPLE_DETAIL, LONG_NAME_DETAIL, OFFLINE_DETAIL, DISABLED_DETAIL, POPULATED_DETAIL].map(
    (detail) => [detail.connector.id, detail],
  ),
);

const rotationSdk: Partial<RotationSdkService> = {
  listTargetSystems: () => Promise.resolve([TARGET_SYSTEM_A, TARGET_SYSTEM_B]),
  getConnector: (_organizationId, id) => Promise.resolve(CONNECTORS_BY_ID.get(id) ?? SAMPLE_DETAIL),
  enableConnector: () => Promise.resolve(),
  disableConnector: () => Promise.resolve(),
  deleteConnector: () => Promise.resolve(),
  assignTarget: () => Promise.resolve(),
};

/**
 * Mirrors `rotation.routes.ts` (minus its guards) so the page reads `organizationId` /
 * `daemonId` from real route params. A stubbed `ActivatedRoute` can't resolve the page's
 * `['..']` breadcrumb, which then falls back to the current URL and renders as the active page
 * instead of a link back to the tab.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "access-connectors", children: [] },
      { path: "access-connectors/:daemonId", component: DaemonDetailComponent },
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
      ],
    }),
  ],
} as Meta<DaemonDetailComponent>;

type Story = StoryObj<DaemonDetailComponent>;

/**
 * The breadcrumb trail reads "Access connectors > Prod on-prem connector" — the connector's own
 * name. Also doubles as the no-assignments AND no-activity empty-state pair, since both are the
 * builder's defaults.
 */
export const Default: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${SAMPLE_DETAIL.connector.id}`,
    ),
  ],
};

/** A realistic long connector name, to check the breadcrumb truncates rather than crowding the title-suffix status badge. */
export const LongName: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${LONG_NAME_DETAIL.connector.id}`,
    ),
  ],
};

/** Offline connector: the Connection field's badge reads "Offline". */
export const Offline: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${OFFLINE_DETAIL.connector.id}`,
    ),
  ],
};

/** Disabled connector: both status badges read "Disabled", the bottom row shows Enable, and the Assign-targets button is hidden. */
export const Disabled: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${DISABLED_DETAIL.connector.id}`,
    ),
  ],
};

/** Two assigned targets and two rotation jobs: the uncapped badge list and app-rotation-history both render real rows. */
export const Populated: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/access-connectors/${POPULATED_DETAIL.connector.id}`,
    ),
  ],
};
