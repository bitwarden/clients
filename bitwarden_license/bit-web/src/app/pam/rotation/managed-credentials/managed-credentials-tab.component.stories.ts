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

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import { OrgCiphersService } from "../org-ciphers.service";
import { TargetSystemsService } from "../target-systems/target-systems.service";
import {
  id,
  configId,
  sysId,
  ORGANIZATION_ID,
  rotationConfig,
  rotationConfigActions,
  rotationConfigDescription,
  rotationConfigSealedFields,
} from "../testing/rotation-builders";
import { atUrl } from "../testing/story-helpers";

import { ManagedCredentialsTabComponent } from "./managed-credentials-tab.component";
import { buildRotationConfigRow, RotationConfigRow } from "./rotation-config-row";
import { RotationConfigsService } from "./rotation-configs.service";

/**
 * Single hex digits, since `id()` folds a longer label onto one digit and two labels could collide.
 * These key the collection lookup; `1`, `2` and `a` are taken by the target systems and the org.
 */
const CIPHER_PROD = asUuid<CipherId>(id("4"));
const CIPHER_STAGING = asUuid<CipherId>(id("5"));
const CIPHER_CI = asUuid<CipherId>(id("6"));
const CIPHER_MAINFRAME = asUuid<CipherId>(id("7"));
const CIPHER_FIREWALL = asUuid<CipherId>(id("8"));
const CIPHER_LEDGER = asUuid<CipherId>(id("9"));

const DAY = 86_400_000;
const fromNow = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

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
  cipher(CIPHER_FIREWALL, "Edge firewall", ["col-1"]),
  cipher(CIPHER_LEDGER, "Legacy ledger", []),
];

const COLLECTIONS: CollectionAdminView[] = [
  { id: "col-1", name: "Production" } as CollectionAdminView,
  { id: "col-2", name: "Engineering" } as CollectionAdminView,
];

const ROWS: RotationConfigRow[] = [
  buildRotationConfigRow(
    rotationConfig({
      id: configId("1"),
      cipherId: CIPHER_PROD,
      targetSystemId: sysId("1"),
      targetSystemName: "Prod Entra",
      enabled: true,
      scheduleCron: "0 0 0 * * ?",
      rotateOnAccessEnd: true,
      sealed: rotationConfigSealedFields({ accountIdentity: "sf-integration-svc" }),
      lastRotationAt: fromNow(-5 * DAY),
      nextRotationAt: fromNow(14 * DAY + 3_600_000),
    }),
    undefined,
    "Prod DB service account",
    rotationConfigDescription(),
  ),
  buildRotationConfigRow(
    rotationConfig({
      id: configId("2"),
      cipherId: CIPHER_STAGING,
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      enabled: false,
      sealed: rotationConfigSealedFields({ accountIdentity: "root-rotator@meridian-prod" }),
      lastRotationAt: fromNow(-95 * DAY),
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
      id: configId("3"),
      cipherId: CIPHER_CI,
      targetSystemId: sysId("1"),
      targetSystemName: "Prod Entra",
      enabled: true,
      hasActiveJob: true,
      sealed: rotationConfigSealedFields({ accountIdentity: "ci-deployer" }),
      lastRotationAt: fromNow(-3 * DAY),
    }),
    undefined,
    "CI pipeline token",
    rotationConfigDescription({
      actions: rotationConfigActions({ canRotateNow: false, mutationsLocked: true }),
    }),
  ),
  buildRotationConfigRow(
    rotationConfig({
      id: configId("4"),
      cipherId: CIPHER_MAINFRAME,
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      targetSystemMethod: "manual",
      enabled: true,
      awaitingManualRotation: true,
      sealed: rotationConfigSealedFields({ accountIdentity: "oracle_dba" }),
      nextRotationAt: fromNow(-3 * DAY - 3_600_000),
    }),
    undefined,
    "Mainframe operator",
    rotationConfigDescription({
      actions: rotationConfigActions({ canRotateNow: false, canRecordManual: true }),
    }),
  ),
  buildRotationConfigRow(
    rotationConfig({
      id: configId("5"),
      cipherId: CIPHER_FIREWALL,
      targetSystemId: sysId("3"),
      targetSystemName: "Network Firewall",
      sealed: rotationConfigSealedFields({ accountIdentity: "root-rotator@meridian-prod" }),
      lastRotationAt: fromNow(-8 * 60_000),
    }),
    undefined,
    "Edge firewall",
    rotationConfigDescription(),
    [],
  ),
  buildRotationConfigRow(
    rotationConfig({
      id: configId("6"),
      cipherId: CIPHER_LEDGER,
      targetSystemId: sysId("2"),
      targetSystemName: "Staging AD",
      targetSystemMethod: "manual",
      enabled: true,
      sealed: rotationConfigSealedFields({ accountIdentity: "ledger_admin" }),
    }),
    undefined,
    "Legacy ledger",
    rotationConfigDescription({
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
      { provide: AccessConnectorsService, useValue: { load: () => Promise.resolve() } },
      {
        provide: OrgCiphersService,
        useValue: { ciphers$: of(rows.length > 0 ? CIPHERS : []), load: () => Promise.resolve() },
      },
      {
        provide: TargetSystemsService,
        useValue: {
          systems$: of([{ id: sysId("1") }, { id: sysId("2") }, { id: sysId("3") }]),
          loading$: of(false),
          loadError$: of(null),
          load: () => Promise.resolve(),
        },
      },
    ],
  });
}

/**
 * Mirrors `rotation.routes.ts`, minus its guards, so `organizationId` and the `[".."]` navigations
 * resolve. The create and edit pages exist only as navigation targets.
 */
const routes: Routes = [
  {
    path: "organizations/:organizationId/pam/rotation",
    children: [
      { path: "managed-credentials", component: ManagedCredentialsTabComponent },
      { path: "managed-credentials/new", children: [] },
      { path: "managed-credentials/:configId", children: [] },
      { path: "managed-credentials/:configId/history", children: [] },
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
