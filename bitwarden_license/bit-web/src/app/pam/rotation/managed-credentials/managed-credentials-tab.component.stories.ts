import { importProvidersFrom } from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";

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
      awaitingManualRotation: true,
    }),
    undefined,
    "Staging admin login",
    rotationConfigDescription({
      actions: rotationConfigActions({
        canRotateNow: false,
        canRecordManual: true,
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
    rotationConfigDescription(),
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
        importProvidersFrom(RouterModule.forRoot([])),
        {
          provide: ActivatedRoute,
          useValue: { params: of({ organizationId: "org-1" }) },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              delete: "Delete",
              edit: "Edit",
              status: "Status",
              all: "All",
              options: "Options",
              search: "Search",
              pamCollectionFilter: "Collection",
              pamNoTargetSystemsYetTitle: "No target systems yet",
              pamRotationConfigColumnCredential: "Credential",
              pamRotationConfigColumnLastRotation: "Last rotation",
              pamRotationConfigColumnNextRotation: "Next rotation",
              pamRotationConfigColumnRotateOnAccessEnd: "Rotate on access end",
              pamRotationConfigColumnSchedule: "Schedule",
              pamRotationConfigColumnTargetSystem: "Target system",
              pamRotationConfigDeleteLockedTitle:
                "Can't remove while a rotation is in progress. It clears when the current job finishes or times out.",
              pamRotationConfigEmptyState: "No managed credentials configured",
              pamRotationConfigEmptyStateDescription:
                "Add a managed credential to start rotating it automatically.",
              pamRotationConfigInProgress: "Rotation in progress",
              pamRotationConfigManualDue: "Manual rotation due",
              pamRotationConfigNew: "New managed credential",
              pamRotationConfigNoResultsFiltered: "No managed credentials match your filters.",
              pamRotationConfigNoTargetSystems:
                "Set up a target system before you can rotate credentials. A target system defines where a credential lives and how Bitwarden rotates it.",
              pamRotationConfigPause: "Pause",
              pamRotationConfigRecordManual: "Record manual rotation",
              pamRotationConfigResume: "Resume",
              pamRotationConfigRotateNow: "Rotate now",
              pamRotationConfigRotateNowDisabledTitle:
                "Cannot rotate now — the rotation is disabled, paused, or already in progress.",
              pamRotationConfigSearch: "Search managed credentials",
              pamRotationConfigSetUpTargetSystem: "Set up a target system",
              pamRotationConfigStatusActive: "Active",
              pamRotationConfigStatusPaused: "Paused",
            }),
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

/**
 * Two target systems and both statuses, so the Status and Target system chips each narrow the
 * table; the Collection chip resolves its options from the rows' ciphers.
 */
export const Default: Story = {
  decorators: [rotationServices(ROWS)],
};

/** Target systems exist, but no managed credential has been configured yet. */
export const Empty: Story = {
  decorators: [rotationServices([])],
};
