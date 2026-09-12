import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { OrgCiphersService } from "../org-ciphers.service";
import { QuartzSchedulePreset } from "../rotation";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  id,
  sysId,
  ORGANIZATION_ID,
  rotationConfig,
  rotationConfigActions,
  rotationConfigDescription,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { ManagedCredentialsTabComponent } from "./managed-credentials-tab.component";
import { buildRotationConfigRow, RotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

/**
 * Single hex digits, not descriptive labels: `id()` folds a multi-character label onto one digit,
 * so two labels can share a UUID. These ids key the collection lookup and must stay distinct.
 * `1` and `2` are the story's target systems and `a` its organization.
 */
const CIPHER_PROD = asUuid<CipherId>(id("4"));
const CIPHER_STAGING = asUuid<CipherId>(id("5"));
const CIPHER_CI = asUuid<CipherId>(id("6"));
const CIPHER_MAINFRAME = asUuid<CipherId>(id("7"));

function cipher(cipherId: CipherId, name: string, collectionIds: string[]): CipherView {
  const c = new CipherView();
  c.id = uuidAsString(cipherId);
  c.name = name;
  c.collectionIds = collectionIds;
  return c;
}

const CIPHERS: CipherView[] = [
  cipher(CIPHER_PROD, "Prod DB service account", ["col-1"]),
  cipher(CIPHER_STAGING, "Staging admin login", ["col-2"]),
  cipher(CIPHER_CI, "CI pipeline token", ["col-1", "col-2"]),
  cipher(CIPHER_MAINFRAME, "Mainframe operator", ["col-2"]),
];

const COLLECTIONS: CollectionAdminView[] = [
  { id: "col-1", name: "Production" } as CollectionAdminView,
  { id: "col-2", name: "Engineering" } as CollectionAdminView,
];

const ROWS: RotationConfigRow[] = [
  buildRotationConfigRow(
    rotationConfig({
      cipherId: CIPHER_PROD,
      targetSystemId: sysId("1"),
      targetSystemName: "Prod Entra",
      enabled: true,
      scheduleCron: "0 0 0 * * ?",
    }),
    undefined,
    "Prod DB service account",
    rotationConfigDescription({ schedulePreset: QuartzSchedulePreset.Daily }),
  ),
  buildRotationConfigRow(
    rotationConfig({
      cipherId: CIPHER_STAGING,
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      enabled: false,
      scheduleCron: "0 0 3 1/7 * ?",
    }),
    undefined,
    "Staging admin login",
    rotationConfigDescription({
      schedulePreset: QuartzSchedulePreset.Custom,
      actions: rotationConfigActions({
        canRotateNow: false,
        canPause: false,
        canResume: true,
      }),
    }),
  ),
  buildRotationConfigRow(
    rotationConfig({
      cipherId: CIPHER_CI,
      targetSystemId: sysId("1"),
      targetSystemName: "Prod Entra",
      enabled: true,
      hasActiveJob: true,
      scheduleCron: "0 0 9 ? * MON-FRI",
    }),
    undefined,
    "CI pipeline token",
    rotationConfigDescription({
      schedulePreset: QuartzSchedulePreset.Custom,
      actions: rotationConfigActions({ canRotateNow: false, mutationsLocked: true }),
    }),
  ),
  buildRotationConfigRow(
    rotationConfig({
      cipherId: CIPHER_MAINFRAME,
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      targetSystemMethod: "manual",
      enabled: true,
      awaitingManualRotation: true,
    }),
    undefined,
    "Mainframe operator",
    rotationConfigDescription({
      schedulePreset: QuartzSchedulePreset.None,
      actions: rotationConfigActions({ canRotateNow: false, canRecordManual: true }),
    }),
  ),
];

function rotationServices(rows: RotationConfigRow[]) {
  return moduleMetadata({
    imports: [RouterOutlet],
    providers: [
      {
        provide: RotationConfigsService,
        useValue: {
          loading$: of(false),
          loadError$: of(null),
          rows$: of(rows),
          configs$: of(rows.map((r) => r.config)),
          awaitingManualCount$: of(rows.filter((r) => r.awaitingManualRotation).length),
          load: () => Promise.resolve(),
          pause: () => Promise.resolve(),
          resume: () => Promise.resolve(),
          rotateNow: () => Promise.resolve(),
          recordManual: () => Promise.resolve(),
          delete: () => Promise.resolve(),
        },
      },
      {
        provide: OrgCiphersService,
        useValue: { ciphers$: of(rows.length > 0 ? CIPHERS : []), load: () => Promise.resolve() },
      },
      {
        provide: TargetSystemsService,
        useValue: {
          systems$: of([{ id: sysId("1") }, { id: sysId("2") }]),
          loading$: of(false),
          loadError$: of(null),
          load: () => Promise.resolve(),
        },
      },
    ],
  });
}

/**
 * Mirrors `rotation.routes.ts` (minus its guards) so the tab reads `organizationId` from a real
 * route param and its `[".."]` navigations resolve. The create and edit pages are stubbed as
 * childless routes: the stories only need them to exist as navigation targets.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "managed-credentials", component: ManagedCredentialsTabComponent },
      { path: "managed-credentials/new", children: [] },
      { path: "managed-credentials/:configId", children: [] },
      { path: "target-systems/new", children: [] },
    ],
  },
];

export default {
  title: "Web/PAM/Rotation/Managed Credentials Tab",
  component: ManagedCredentialsTabComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    atUrl(`/organizations/${ORGANIZATION_ID}/pam/rotation/managed-credentials`),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: AccountService, useValue: { activeAccount$: of({ id: "user-1" }) } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of(COLLECTIONS) },
        },
        { provide: DialogService, useValue: { openSimpleDialog: () => Promise.resolve(false) } },
        { provide: ToastService, useValue: { showToast: () => {} } },
      ],
    }),
  ],
} as Meta<ManagedCredentialsTabComponent>;

type Story = StoryObj<ManagedCredentialsTabComponent>;

export const Default: Story = {
  decorators: [rotationServices(ROWS)],
};

/** Target systems exist, but no managed credential has been configured yet. */
export const Empty: Story = {
  decorators: [rotationServices([])],
};
