import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
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
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  id,
  sysId,
  rotationConfig,
  rotationConfigActions,
  rotationConfigDescription,
} from "../testing/rotation-builders";

import { ManagedCredentialsTabComponent } from "./managed-credentials-tab.component";
import { buildRotationConfigRow, RotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

const CIPHER_PROD = asUuid<CipherId>(id("cipher-prod-db"));
const CIPHER_STAGING = asUuid<CipherId>(id("cipher-staging-admin"));
const CIPHER_CI = asUuid<CipherId>(id("cipher-ci-token"));
const CIPHER_MAINFRAME = asUuid<CipherId>(id("cipher-mainframe"));

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
    }),
    undefined,
    "Prod DB service account",
    rotationConfigDescription(),
  ),
  buildRotationConfigRow(
    rotationConfig({
      cipherId: CIPHER_STAGING,
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      enabled: false,
    }),
    undefined,
    "Staging admin login",
    rotationConfigDescription({
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
    }),
    undefined,
    "CI pipeline token",
    rotationConfigDescription({
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
      actions: rotationConfigActions({ canRotateNow: false, canRecordManual: true }),
    }),
  ),
];

function rotationServices(rows: RotationConfigRow[]) {
  return moduleMetadata({
    providers: [
      {
        provide: RotationConfigsService,
        useValue: {
          loading$: of(false),
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
          load: () => Promise.resolve(),
        },
      },
    ],
  });
}

export default {
  title: "Web/PAM/Rotation/Managed Credentials Tab",
  component: ManagedCredentialsTabComponent,
  decorators: [
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(RouterModule.forRoot([])),
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: "org-1" }) },
        },
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
