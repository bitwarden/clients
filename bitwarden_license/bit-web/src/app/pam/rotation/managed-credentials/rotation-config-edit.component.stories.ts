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

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import type { AccessConnector, RotationConfigDetailView } from "../rotation";
import { QuartzSchedulePreset } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";
import {
  CIPHER_ID,
  ORGANIZATION_ID,
  TARGET_SYSTEM_ID,
  accessConnector,
  attemptId,
  id,
  jobId,
  rotationAttempt,
  rotationConfig,
  rotationConfigActions,
  rotationConfigDescription,
  rotationConfigDetail,
  rotationJob,
  sysId,
  targetSystem,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { RotationConfigEditComponent } from "./rotation-config-edit.component";

/** The cron each named preset stands for, as the SDK resolves them. */
const PRESET_CRONS: Partial<Record<QuartzSchedulePreset, string>> = {
  [QuartzSchedulePreset.Hourly]: "0 0 * * * ?",
  [QuartzSchedulePreset.Every6Hours]: "0 0 0/6 * * ?",
  [QuartzSchedulePreset.Daily]: "0 0 0 * * ?",
  [QuartzSchedulePreset.Weekly]: "0 0 0 ? * SUN",
  [QuartzSchedulePreset.Monthly]: "0 0 0 1 * ?",
};

const SAMPLE_DETAIL = rotationConfigDetail({
  config: rotationConfig({ scheduleCron: PRESET_CRONS[QuartzSchedulePreset.Daily] }),
  jobs: [rotationJob(), rotationJob({ id: jobId("j-2") })],
});

/** Active targets of each kind and a retired one the create picker leaves out. */
const TARGET_SYSTEMS = [
  targetSystem({ id: sysId("1"), name: "Prod Entra" }),
  targetSystem({ id: sysId("2"), name: "Finance Reporting DB", method: "manual" }),
  targetSystem({ id: sysId("3"), name: "AWS Production" }),
  targetSystem({ id: sysId("4"), name: "Retired Entra sandbox", status: "disabled" }),
];

const CONNECTORS = [
  accessConnector({ name: "East datacenter", assignedTargetSystemIds: [TARGET_SYSTEM_ID] }),
];

function loginCipher(cipherId: string, name: string): CipherView {
  const view = new CipherView();
  view.id = cipherId;
  view.name = name;
  view.type = CipherType.Login;
  view.edit = true;
  view.viewPassword = true;
  return view;
}

const CIPHERS = [
  loginCipher(String(CIPHER_ID), "Splunk forwarder account"),
  loginCipher(id("6"), "svc-rotation@corp"),
  loginCipher(id("7"), "sql-admin@reporting"),
];

function rotationSdkFor(
  systems = TARGET_SYSTEMS,
  detail: RotationConfigDetailView = SAMPLE_DETAIL,
  connectors: AccessConnector[] = CONNECTORS,
  actions = rotationConfigActions(),
): Partial<RotationSdkService> {
  return {
    listTargetSystems: () => Promise.resolve(systems),
    listConfigs: () => Promise.resolve([]),
    listConnectors: () => Promise.resolve(connectors),
    describeConfigs: (configs) =>
      Promise.resolve(new Map(configs.map((c) => [c.id, rotationConfigDescription({ actions })]))),
    pauseConfig: () => Promise.resolve(),
    resumeConfig: () => Promise.resolve(),
    rotateNow: () => Promise.resolve(),
    recordManualRotation: () => Promise.resolve(),
    assignTarget: () => Promise.resolve(),
    getConfig: () => Promise.resolve(detail),
    createConfig: () => Promise.resolve(SAMPLE_DETAIL),
    updateConfig: () => Promise.resolve(SAMPLE_DETAIL),
    deleteConfig: () => Promise.resolve(),
    // The schedule sub-editor resolves its preset table through the SDK as it renders.
    presetForCron: (cron) => {
      if (cron == null || cron.trim() === "") {
        return Promise.resolve(QuartzSchedulePreset.None);
      }
      const named = Object.entries(PRESET_CRONS).find(([, value]) => value === cron);
      return Promise.resolve(
        named ? (named[0] as QuartzSchedulePreset) : QuartzSchedulePreset.Custom,
      );
    },
    cronForPreset: (preset) => Promise.resolve(PRESET_CRONS[preset] ?? null),
    isLikelyQuartzCron: (value) =>
      Promise.resolve([6, 7].includes(value.trim().split(/\s+/).length)),
  };
}

const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "managed-credentials", children: [] },
      { path: "managed-credentials/new", component: RotationConfigEditComponent },
      {
        path: "managed-credentials/:configId",
        pathMatch: "full",
        redirectTo: "managed-credentials/:configId/configuration",
      },
      { path: "managed-credentials/:configId/:tab", component: RotationConfigEditComponent },
    ],
  },
];

export default {
  title: "Web/PAM/Rotation/Config Edit",
  component: RotationConfigEditComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    componentWrapperDecorator((story) => `<div class="tw-p-6">${story}</div>`),
    moduleMetadata({ imports: [RouterOutlet] }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: RotationSdkService, useValue: rotationSdkFor() },
        { provide: ToastService, useValue: { showToast: () => {} } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of([]) },
        },
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
} as Meta<RotationConfigEditComponent>;

type Story = StoryObj<RotationConfigEditComponent>;

/** The Configuration tab of an active credential; the title is the vault item's name. */
export const Edit: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/${SAMPLE_DETAIL.config.id}/configuration`,
    ),
  ],
};

/** The job table takes the full page width rather than the form's column. */
export const EditHistory: Story = {
  decorators: [
    atUrl(
      `/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/${SAMPLE_DETAIL.config.id}/history`,
    ),
  ],
};

export const Create: Story = {
  decorators: [atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/new`)],
};

export const CreateWithNoActiveTargetSystems: Story = {
  decorators: [
    atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/new`),
    applicationConfig({
      providers: [
        {
          provide: RotationSdkService,
          useValue: rotationSdkFor([targetSystem({ status: "disabled" })]),
        },
      ],
    }),
  ],
};

const EDIT_URL = `/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials/${SAMPLE_DETAIL.config.id}/configuration`;

function editStory(
  detail: RotationConfigDetailView,
  connectors: AccessConnector[] = CONNECTORS,
  actions = rotationConfigActions(),
  url = EDIT_URL,
): Story {
  return {
    decorators: [
      atUrl(url),
      applicationConfig({
        providers: [
          {
            provide: RotationSdkService,
            useValue: rotationSdkFor(TARGET_SYSTEMS, detail, connectors, actions),
          },
        ],
      }),
    ],
  };
}

const withConfig = (overrides: Parameters<typeof rotationConfig>[0], jobs = SAMPLE_DETAIL.jobs) =>
  rotationConfigDetail({
    config: rotationConfig({
      scheduleCron: PRESET_CRONS[QuartzSchedulePreset.Weekly],
      lastRotationAt: "2026-09-19T19:00:00Z",
      nextRotationAt: "2026-10-10T19:00:00Z",
      ...overrides,
    }),
    jobs,
  });

export const Paused: Story = editStory(
  withConfig({ enabled: false }),
  CONNECTORS,
  rotationConfigActions({ canRotateNow: false, canPause: false, canResume: true }),
);

export const RotatingAfterAFailedAttempt: Story = editStory(
  withConfig({ hasActiveJob: true }, [
    rotationJob({
      status: "claimed",
      attempts: [
        rotationAttempt({ status: "errored", failureReason: "target_unreachable" }),
        rotationAttempt({ id: attemptId("a-2"), status: "executing" }),
      ],
    }),
  ]),
  CONNECTORS,
  rotationConfigActions({ canRotateNow: false }),
);

export const ManualRotationDue: Story = editStory(
  withConfig({
    targetSystemMethod: "manual",
    awaitingManualRotation: true,
    nextRotationAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  }),
  [],
  rotationConfigActions({ canRotateNow: false, canRecordManual: true, canPause: false }),
);

export const FailedTimedOut: Story = editStory(
  withConfig({}, [rotationJob({ status: "timed_out", attempts: [] })]),
);

export const NotConnectedNoConnector: Story = editStory(withConfig({}), []);

export const NotConnectedDisconnected: Story = editStory(withConfig({}), [
  accessConnector({
    name: "East datacenter",
    isConnected: false,
    assignedTargetSystemIds: [TARGET_SYSTEM_ID],
  }),
]);
