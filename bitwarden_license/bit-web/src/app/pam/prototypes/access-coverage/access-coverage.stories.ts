// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  importProvidersFrom,
  inject,
  input,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";
import { action } from "storybook/actions";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { NudgesService, NudgeStatus } from "@bitwarden/angular/vault";
import { AccountWarning, AdminConsoleLogo, NoResults, Party } from "@bitwarden/assets/svg";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { EventCollectionService } from "@bitwarden/common/dirt/event-logs";
import { ClientType, DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import {
  AsyncActionsModule,
  BadgeComponent,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  CardComponent,
  ChipActionComponent,
  defineTable,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FilterMenuModule,
  HeaderComponent,
  IconButtonModule,
  IconComponent,
  IconTileComponent,
  LayoutComponent,
  LinkModule,
  MenuModule,
  NavigationModule,
  PageComponent,
  PopoverModule,
  SearchModule,
  SectionComponent,
  SectionHeaderComponent,
  SkeletonComponent,
  StatusLockupComponent,
  StorybookGlobalStateProvider,
  StorybookStateProvider,
  SvgModule,
  ToastModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { GlobalStateProvider, StateProvider } from "@bitwarden/state";
import { enabledFlags } from "@bitwarden/storybook";
import {
  CipherFormConfig,
  CipherFormGenerationService,
  CipherFormModule,
  PasswordRepromptService,
  TotpCaptureService,
} from "@bitwarden/vault";
// eslint-disable-next-line no-restricted-imports
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/src/app/core/tests";

/* eslint-disable no-restricted-imports */
import { CipherFormService } from "../../../../../../../libs/vault/src/cipher-form/abstractions/cipher-form.service";
import { CipherFormCacheService } from "../../../../../../../libs/vault/src/cipher-form/services/default-cipher-form-cache.service";
import { SshImportPromptService } from "../../../../../../../libs/vault/src/services/ssh-import-prompt.service";
/* eslint-enable no-restricted-imports */

type StoryState =
  | "default"
  | "scanning"
  | "no-rules"
  | "no-gaps"
  | "no-search"
  | "no-filter"
  | "scan-failed"
  | "mixed-perms";

interface SharedFolder {
  id: string;
  name: string;
  isProtected: boolean;
}

interface CoverageRow {
  id: string;
  name: string;
  username: string;
  iconColor: string;
  reachable: SharedFolder[];
  protectedIn: SharedFolder[];
  editable: boolean;
}

interface Summary {
  gaps: number;
  foldersCovered: number;
  foldersTotal: number;
  foldersPercent: number;
  itemsCovered: number;
  itemsTotal: number;
  itemsPercent: number;
}

const SHARED_FOLDERS: SharedFolder[] = [
  { id: "aws-prod", name: "AWS production", isProtected: true },
  { id: "aws-dev", name: "AWS dev sandbox", isProtected: false },
  { id: "data-warehouse", name: "Data warehouse", isProtected: true },
  { id: "data-scratch", name: "Data scratchpad", isProtected: false },
  { id: "finance-ops", name: "Finance operations", isProtected: true },
  { id: "hr-general", name: "HR general", isProtected: false },
  { id: "legacy-reporting", name: "Legacy reporting", isProtected: false },
  { id: "security-review", name: "Security review", isProtected: true },
];

const folder = (id: string): SharedFolder => SHARED_FOLDERS.find((f) => f.id === id)!;

const COVERAGE_ROWS: CoverageRow[] = [
  {
    id: "aws-root",
    name: "AWS root rotator",
    username: "root-rotator@meridian-prod",
    iconColor: "#f39c12",
    reachable: [folder("aws-dev"), folder("legacy-reporting")],
    protectedIn: [folder("aws-prod")],
    editable: true,
  },
  {
    id: "snowflake-etl",
    name: "Snowflake ETL service account",
    username: "svc-snowflake-etl",
    iconColor: "#29b5e8",
    reachable: [folder("data-scratch")],
    protectedIn: [folder("data-warehouse")],
    editable: true,
  },
  {
    id: "okta-superadmin",
    name: "Okta super admin",
    username: "okta-svc-admin",
    iconColor: "#007dc1",
    reachable: [folder("hr-general"), folder("legacy-reporting")],
    protectedIn: [folder("security-review")],
    editable: false,
  },
  {
    id: "oracle-dba",
    name: "Oracle DBA account",
    username: "oracle_dba",
    iconColor: "#c74634",
    reachable: [folder("legacy-reporting"), folder("hr-general"), folder("data-scratch")],
    protectedIn: [folder("finance-ops")],
    editable: true,
  },
  {
    id: "salesforce-integration",
    name: "Salesforce integration user",
    username: "sf-integration-svc",
    iconColor: "#00a1e0",
    reachable: [folder("aws-dev")],
    protectedIn: [],
    editable: true,
  },
  {
    id: "splunk-forwarder",
    name: "Splunk forwarder account",
    username: "splunk-fwd",
    iconColor: "#f99d1c",
    reachable: [folder("legacy-reporting")],
    protectedIn: [],
    editable: true,
  },
  {
    id: "mysql-replication",
    name: "MySQL replication user",
    username: "repl_user",
    iconColor: "#00758f",
    reachable: [folder("data-scratch"), folder("legacy-reporting")],
    protectedIn: [],
    editable: false,
  },
  {
    id: "cisco-asa",
    name: "Cisco ASA admin",
    username: "asa-admin",
    iconColor: "#1ba0d7",
    reachable: [folder("aws-dev"), folder("hr-general")],
    protectedIn: [],
    editable: true,
  },
  {
    id: "azure-keyvault",
    name: "Azure Key Vault rotator",
    username: "kv-rotator-svc",
    iconColor: "#0078d4",
    reachable: [folder("aws-dev")],
    protectedIn: [],
    editable: true,
  },
];

const DEFAULT_SUMMARY: Summary = {
  gaps: 9,
  foldersCovered: 4,
  foldersTotal: 8,
  foldersPercent: 50,
  itemsCovered: 47,
  itemsTotal: 56,
  itemsPercent: 84,
};

const ZERO_SUMMARY: Summary = {
  gaps: 0,
  foldersCovered: 8,
  foldersTotal: 8,
  foldersPercent: 100,
  itemsCovered: 56,
  itemsTotal: 56,
  itemsPercent: 100,
};

/**
 * Default sort: items that have anything in "Protected in" come first (the bypass
 * cases that make a reviewer anxious), then everything else, each group alphabetical.
 * Flipping the sort direction inverts both the partition and the alphabetical order.
 */
const sortCoverage = (a: CoverageRow, b: CoverageRow) => {
  const aHasProtected = a.protectedIn.length > 0 ? 0 : 1;
  const bHasProtected = b.protectedIn.length > 0 ? 0 : 1;
  if (aHasProtected !== bHasProtected) {
    return aHasProtected - bHasProtected;
  }
  return a.name.localeCompare(b.name);
};

/**
 * Stand-in for the real `CipherFormService` so the embedded `vault-cipher-form` can
 * mount without pulling in `CipherService` and the rest of the vault's dependency
 * graph. Save resolves after a short delay to exercise the form's async UI.
 */
class StubCipherFormService implements CipherFormService {
  decryptCipher(cipher: Cipher): Promise<CipherView> {
    return Promise.resolve({ ...cipher } as unknown as CipherView);
  }
  async saveCipher(cipher: CipherView): Promise<CipherView> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return cipher;
  }
}

/** The mock org every shared folder and cipher belongs to in this prototype. */
const PROTOTYPE_ORG_ID = "acme-prototype-org";

/**
 * Shared folders map 1:1 to Bitwarden collections for the form's picker.
 * `assigned: true` + `readOnly: false` + `SharedCollection` type satisfy the non-admin
 * filter in `updateCollectionOptions` — otherwise every option would be filtered out
 * and the Shared folders dropdown would come up empty.
 */
const PROTOTYPE_COLLECTIONS: CollectionView[] = SHARED_FOLDERS.map(
  (f) =>
    ({
      id: f.id,
      name: f.name,
      organizationId: PROTOTYPE_ORG_ID,
      type: CollectionTypes.SharedCollection,
      assigned: true,
      readOnly: false,
    }) as CollectionView,
);

const PROTOTYPE_ORGANIZATIONS: Organization[] = [
  // `canEditAllCiphers: true` keeps the Shared folders control editable in the form —
  // without it, setCollectionControlState() disables the field unless the cipher sets
  // `canAssignToCollections`, which the mock doesn't model.
  { id: PROTOTYPE_ORG_ID, name: "Acme corporation", canEditAllCiphers: true } as Organization,
];

const buildCipherFormConfig = (row: CoverageRow): CipherFormConfig => {
  const collectionIds = [...row.reachable, ...row.protectedIn].map((f) => f.id);
  return {
    mode: "edit",
    cipherType: CipherType.Login,
    admin: false,
    organizationDataOwnershipDisabled: true,
    collections: PROTOTYPE_COLLECTIONS,
    folders: [],
    organizations: PROTOTYPE_ORGANIZATIONS,
    originalCipher: {
      id: row.id,
      organizationId: PROTOTYPE_ORG_ID,
      name: row.name,
      folderId: null,
      collectionIds,
      favorite: false,
      notes: "",
      viewPassword: true,
      edit: row.editable,
      login: Object.assign(new LoginView(), {
        username: row.username,
        password: "",
      }),
    } as unknown as Cipher,
  };
};

/**
 * Wraps `vault-cipher-form` in a `bit-dialog` shell. The real Admin Console would
 * use `VaultItemDialogComponent`, but it pulls in archive, attachments, and
 * decryption-failure services that aren't worth wiring for a prototype. The form
 * itself is the real one, so the Edit flow renders production fields and
 * validation.
 */
@Component({
  selector: "access-coverage-edit-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DialogModule, ButtonModule, CipherFormModule, AsyncActionsModule],
  // CipherFormModule binds DefaultCipherFormService to CipherFormService in its own module
  // injector, which beats a root-level override. Re-providing it on the component's element
  // injector wins back — otherwise the form reaches for the real CipherService and crashes.
  providers: [{ provide: CipherFormService, useClass: StubCipherFormService }],
  template: /* HTML */ `
    <bit-dialog dialogSize="large" background="alt">
      <span bitDialogTitle>Edit login</span>
      <div bitDialogContent>
        <vault-cipher-form
          formId="access-coverage-cipher-form"
          [config]="data.config"
          (cipherSaved)="onSaved()"
        ></vault-cipher-form>
      </div>
      <ng-container bitDialogFooter>
        <button bitButton type="submit" form="access-coverage-cipher-form" buttonType="primary">
          Save
        </button>
        <button bitButton type="button" buttonType="secondary" bitDialogClose>Cancel</button>
      </ng-container>
    </bit-dialog>
  `,
})
class AccessCoverageEditDialogComponent {
  protected readonly data = inject<{ config: CipherFormConfig }>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);

  protected onSaved(): void {
    void this.dialogRef.close("saved");
  }
}

interface ViewedFolder {
  id: string;
  name: string;
  controlled: boolean;
}

/**
 * Lightweight stand-in for the real `CipherViewComponent` dialog, matched against
 * production's "View login" layout: an identity card up top (icon tile + item name +
 * organization/shared-folder chips), a Login credentials card with label/value rows
 * separated by dividers, and an Edit + delete footer. Production uses
 * `VaultItemDialogComponent` in `view` mode with ~15 services and a stack of
 * per-type view subcomponents — out of scope for a prototype. Edit flips to the live
 * `vault-cipher-form` dialog.
 */
@Component({
  selector: "access-coverage-view-dialog",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    IconButtonModule,
    BadgeComponent,
    IconTileComponent,
    TypographyModule,
  ],
  template: /* HTML */ `
    <bit-dialog dialogSize="large" background="alt">
      <span bitDialogTitle>View login</span>

      <div bitDialogContent class="tw-flex tw-flex-col tw-gap-5">
        <!-- Identity card: icon tile + item name + organization/shared-folder chips. -->
        <div
          class="tw-flex tw-items-center tw-gap-4 tw-rounded tw-border tw-border-solid tw-border-secondary-100 tw-bg-background tw-p-4"
        >
          <bit-icon-tile
            class="!tw-flex tw-flex-none"
            icon="bwi-globe"
            size="xl"
            [color]="data.row.iconColor"
          ></bit-icon-tile>
          <div class="tw-flex tw-min-w-0 tw-flex-col tw-gap-2">
            <h2 bitTypography="h3" noMargin class="tw-truncate">{{ data.row.name }}</h2>
            <!--
              Badges (not chips) because this is view-only — bit-chip always renders a
              dismiss affordance that doesn't belong here. Shared folder badges use the
              brand/gray startIcon that matches the field.
            -->
            <div class="tw-flex tw-flex-wrap tw-gap-1">
              <span bitBadge variant="subtle" size="small" startIcon="bwi-business">
                Acme corporation
              </span>
              @for (f of folders(); track f.id) {
              <span
                bitBadge
                variant="subtle"
                size="small"
                [startIcon]="f.controlled ? 'bwi-encrypted' : 'bwi-collection-shared'"
              >
                {{ f.name }}
              </span>
              }
            </div>
          </div>
        </div>

        <!-- Login credentials: rows separated by dividers, actions on the right. -->
        <div>
          <h3 bitTypography="h6" class="tw-mb-2">Login credentials</h3>
          <div
            class="tw-rounded tw-border tw-border-solid tw-border-secondary-100 tw-bg-background"
          >
            <div class="tw-flex tw-items-center tw-gap-2 tw-p-4">
              <div class="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col">
                <span bitTypography="helper" class="tw-text-muted">Username</span>
                <span class="tw-truncate tw-text-main">{{ data.row.username }}</span>
              </div>
              <button
                type="button"
                bitIconButton="bwi-clone"
                size="small"
                buttonType="main"
                label="Copy username"
              ></button>
            </div>

            <div
              class="tw-mx-4 tw-border-0 tw-border-t tw-border-solid tw-border-secondary-100"
            ></div>

            <div class="tw-flex tw-items-center tw-gap-2 tw-p-4">
              <div class="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col">
                <span bitTypography="helper" class="tw-text-muted">Password</span>
                <span class="tw-font-mono tw-text-main" aria-label="Password hidden">
                  ••••••••
                </span>
              </div>
              <button
                type="button"
                bitIconButton="bwi-eye"
                size="small"
                buttonType="main"
                label="Reveal password"
              ></button>
              <button
                type="button"
                bitIconButton="bwi-clone"
                size="small"
                buttonType="main"
                label="Copy password"
              ></button>
            </div>
          </div>
        </div>
      </div>

      <ng-container bitDialogFooter>
        @if (data.row.editable) {
        <button bitButton type="button" buttonType="primary" (click)="switchToEdit()">Edit</button>
        }
        <button
          type="button"
          bitIconButton="bwi-trash"
          buttonType="danger"
          size="default"
          label="Delete"
          class="tw-ml-auto"
        ></button>
      </ng-container>
    </bit-dialog>
  `,
})
class AccessCoverageViewDialogComponent {
  protected readonly data = inject<{ row: CoverageRow }>(DIALOG_DATA);
  private readonly dialogService = inject(DialogService);
  private readonly dialogRef = inject(DialogRef);

  protected readonly folders = computed<ViewedFolder[]>(() => [
    ...this.data.row.protectedIn.map((f) => ({ ...f, controlled: true })),
    ...this.data.row.reachable.map((f) => ({ ...f, controlled: false })),
  ]);

  protected switchToEdit(): void {
    const row = this.data.row;
    void this.dialogRef.close("edit");
    this.dialogService.open<string, { config: CipherFormConfig }>(
      AccessCoverageEditDialogComponent,
      { data: { config: buildCipherFormConfig(row) } },
    );
  }
}

/**
 * Prototype host for the Access coverage page. Owns the big template and the
 * `DialogService` calls that back the item-name link and the row edit button.
 * Everything that changes between stories (state, rows, summary) is an input.
 */
@Component({
  selector: "access-coverage-prototype",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    LayoutComponent,
    NavigationModule,
    HeaderComponent,
    PageComponent,
    SectionComponent,
    SectionHeaderComponent,
    BitTableV2Component,
    BitTableToolbarComponent,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    ButtonModule,
    IconButtonModule,
    IconComponent,
    IconTileComponent,
    CardComponent,
    ChipActionComponent,
    PopoverModule,
    BadgeComponent,
    TypographyModule,
    FilterMenuModule,
    MenuModule,
    SearchModule,
    DialogModule,
    LinkModule,
    SkeletonComponent,
    StatusLockupComponent,
    SvgModule,
  ],
  template: /* HTML */ `
    <bit-layout>
      <bit-side-nav variant="secondary">
        <bit-nav-logo [openIcon]="adminConsoleLogo" route="/" label="Admin Console"></bit-nav-logo>
        <bit-nav-item text="Acme corporation" icon="bwi-business" route="/org"></bit-nav-item>
        <bit-nav-item
          text="Access intelligence"
          icon="bwi-dashboard"
          route="/access-intelligence"
        ></bit-nav-item>
        <bit-nav-group text="Privileged Controls" icon="bwi-lock-encrypted" [open]="true">
          <bit-nav-item
            text="Access coverage"
            route="/pam/access-coverage"
            [forceActiveStyles]="true"
          ></bit-nav-item>
          <bit-nav-item text="Access rules" route="/pam/access-rules"></bit-nav-item>
          <bit-nav-item text="Audit log" route="/pam/audit-log"></bit-nav-item>
          <bit-nav-item text="Rotation" route="/pam/rotation"></bit-nav-item>
        </bit-nav-group>
        <bit-nav-item text="Members" icon="bwi-user" route="/members"></bit-nav-item>
        <bit-nav-item text="Groups" icon="bwi-users" route="/groups"></bit-nav-item>
        <bit-nav-group text="Reporting" icon="bwi-sliders"></bit-nav-group>
        <bit-nav-group text="Billing" icon="bwi-billing"></bit-nav-group>
        <bit-nav-item text="Integrations" icon="bwi-msp" route="/integrations"></bit-nav-item>
        <bit-nav-group text="Settings" icon="bwi-cog"></bit-nav-group>
        <bit-nav-item
          slot="account"
          text="Will Robinson"
          icon="bwi-user"
          route="/account"
        ></bit-nav-item>
      </bit-side-nav>

      <bit-page
        [attr.aria-busy]="state() === 'scanning' ? 'true' : null"
        [attr.aria-label]="'Access coverage'"
      >
        <bit-header title="Access coverage">
          <div slot="subtitle">See which items are covered by an access rule.</div>
          <button
            type="button"
            bitButton
            buttonType="secondary"
            startIcon="bwi-download"
            [disabled]="state() === 'scanning' || state() === 'scan-failed'"
          >
            Export CSV
          </button>
        </bit-header>

        @if (state() === "scanning") {
        <span role="status" class="tw-sr-only">Scanning items.</span>
        } @if (state() !== "no-rules" && state() !== "scan-failed") {
        <h2 class="tw-sr-only">Summary</h2>
        <div class="tw-mb-6 tw-grid tw-grid-cols-1 tw-gap-4 md:tw-grid-cols-3">
          <bit-card>
            @if (state() === "scanning") {
            <div class="tw-flex tw-flex-col tw-gap-2">
              <bit-skeleton class="tw-h-3 tw-w-24"></bit-skeleton>
              <bit-skeleton class="tw-h-8 tw-w-16"></bit-skeleton>
              <bit-skeleton class="tw-h-3 tw-w-40"></bit-skeleton>
            </div>
            } @else {
            <div class="tw-flex tw-flex-col tw-gap-1">
              <div bitTypography="helper" class="tw-text-muted">Coverage gaps</div>
              <div class="tw-text-3xl tw-font-semibold tw-text-main">{{ summary().gaps }}</div>
              <div bitTypography="helper" class="tw-text-muted">
                Items that aren't fully covered
              </div>
            </div>
            }
          </bit-card>
          <bit-card>
            @if (state() === "scanning") {
            <div class="tw-flex tw-flex-col tw-gap-2">
              <bit-skeleton class="tw-h-3 tw-w-36"></bit-skeleton>
              <bit-skeleton class="tw-h-8 tw-w-20"></bit-skeleton>
              <bit-skeleton class="tw-h-3 tw-w-32"></bit-skeleton>
            </div>
            } @else {
            <div class="tw-flex tw-flex-col tw-gap-1">
              <div bitTypography="helper" class="tw-text-muted">Shared folders covered</div>
              <div class="tw-text-3xl tw-font-semibold tw-text-main">
                {{ summary().foldersPercent }}%
              </div>
              <div bitTypography="helper" class="tw-text-muted">
                {{ summary().foldersCovered }} of {{ summary().foldersTotal }} shared folders
              </div>
            </div>
            }
          </bit-card>
          <bit-card>
            @if (state() === "scanning") {
            <div class="tw-flex tw-flex-col tw-gap-2">
              <bit-skeleton class="tw-h-3 tw-w-28"></bit-skeleton>
              <bit-skeleton class="tw-h-8 tw-w-20"></bit-skeleton>
              <bit-skeleton class="tw-h-3 tw-w-32"></bit-skeleton>
            </div>
            } @else {
            <div class="tw-flex tw-flex-col tw-gap-1">
              <div bitTypography="helper" class="tw-text-muted">Items covered</div>
              <div class="tw-text-3xl tw-font-semibold tw-text-main">
                {{ summary().itemsPercent }}%
              </div>
              <div bitTypography="helper" class="tw-text-muted">
                {{ summary().itemsCovered }} of {{ summary().itemsTotal }} items
              </div>
            </div>
            }
          </bit-card>
        </div>
        }

        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h2">Coverage gaps</h2>
          </bit-section-header>
          <p bitTypography="body1" class="tw-mb-4 tw-text-muted">
            These items can be reached without a request through at least one shared folder that
            isn't protected.
          </p>

          <bit-table-v2 [tableDef]="table" [loading]="state() === 'scanning'">
            <bit-table-toolbar>
              <bit-search
                class="tw-flex-1"
                placeholder="Search items and shared folders"
                aria-label="Search"
              ></bit-search>

              <bit-filter-menu key="shared-folders" placeholderText="Shared folders" multiple>
                <bit-filter-section label="Reachable" collapsible>
                  @for (f of reachableFolders; track f.id) {
                  <bit-filter-option
                    [value]="f.id"
                    [iconTile]="{ icon: 'bwi-collection-shared', variant: 'warning' }"
                  >
                    {{ f.name }}
                  </bit-filter-option>
                  }
                </bit-filter-section>
                <bit-filter-section label="Protected" collapsible>
                  @for (f of protectedFolders; track f.id) {
                  <bit-filter-option
                    [value]="f.id"
                    [iconTile]="{ icon: 'bwi-encrypted', variant: 'success' }"
                  >
                    {{ f.name }}
                  </bit-filter-option>
                  }
                </bit-filter-section>
              </bit-filter-menu>
            </bit-table-toolbar>

            <bit-column
              sortable
              defaultSort="asc"
              [sortFn]="sortCoverage"
              width="minmax(260px, 1.4fr)"
            >
              <bit-header-cell>Item</bit-header-cell>
              <bit-cell *bitCellDef="table.columns.name; let row">
                <div class="tw-flex tw-min-w-0 tw-items-center tw-gap-3">
                  <bit-icon-tile
                    class="!tw-flex tw-flex-none"
                    icon="bwi-globe"
                    size="base"
                    [color]="row.iconColor"
                  ></bit-icon-tile>
                  <div class="tw-flex tw-min-w-0 tw-flex-col">
                    <button
                      type="button"
                      bitLink
                      class="tw-truncate tw-text-start"
                      (click)="openViewDialog(row)"
                    >
                      {{ row.name }}
                    </button>
                    <span class="tw-truncate tw-text-sm tw-text-muted">{{ row.username }}</span>
                  </div>
                </div>
              </bit-cell>
            </bit-column>

            <bit-column width="minmax(240px, 1fr)">
              <bit-header-cell>Reachable through</bit-header-cell>
              <bit-cell *bitCellDef="table.columns.reachable; let row">
                <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-1">
                  @if (row.reachable.length > 0) {
                  <a
                    bit-chip-action
                    startIcon="bwi-collection-shared"
                    [label]="row.reachable[0].name"
                  ></a>
                  @if (row.reachable.length > 1) {
                  <button
                    type="button"
                    bit-chip-action
                    [label]="'+' + (row.reachable.length - 1)"
                    [attr.aria-label]="
                          row.reachable.length - 1 + ' more reachable shared folders'
                        "
                    [bitPopoverTriggerFor]="reachableRest"
                  ></button>
                  <bit-popover #reachableRest title="Reachable through">
                    <div class="tw-flex tw-flex-col tw-items-start tw-gap-1">
                      @for (f of row.reachable.slice(1); track f.id) {
                      <a bit-chip-action startIcon="bwi-collection-shared" [label]="f.name"></a>
                      }
                    </div>
                  </bit-popover>
                  } }
                </div>
              </bit-cell>
            </bit-column>

            <bit-column width="minmax(240px, 1fr)">
              <bit-header-cell>Protected in</bit-header-cell>
              <bit-cell *bitCellDef="table.columns.protectedIn; let row">
                <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-1">
                  @if (row.protectedIn.length > 0) {
                  <a
                    bit-chip-action
                    startIcon="bwi-encrypted"
                    [label]="row.protectedIn[0].name"
                  ></a>
                  @if (row.protectedIn.length > 1) {
                  <button
                    type="button"
                    bit-chip-action
                    [label]="'+' + (row.protectedIn.length - 1)"
                    [attr.aria-label]="
                          row.protectedIn.length - 1 + ' more protected shared folders'
                        "
                    [bitPopoverTriggerFor]="protectedRest"
                  ></button>
                  <bit-popover #protectedRest title="Protected in">
                    <div class="tw-flex tw-flex-col tw-items-start tw-gap-1">
                      @for (f of row.protectedIn.slice(1); track f.id) {
                      <a bit-chip-action startIcon="bwi-encrypted" [label]="f.name"></a>
                      }
                    </div>
                  </bit-popover>
                  } }
                </div>
              </bit-cell>
            </bit-column>

            <bit-column width="80px">
              <bit-header-cell>
                <span class="tw-sr-only">Actions</span>
              </bit-header-cell>
              <bit-cell *bitCellDef="table.columns.actions; let row">
                <div slot="end" class="tw-flex tw-flex-nowrap tw-items-center tw-gap-1">
                  @if (row.editable) {
                  <div
                    class="tw-pointer-events-none tw-flex tw-flex-nowrap tw-items-center tw-gap-1 tw-opacity-0 tw-transition-opacity group-hover/row:tw-pointer-events-auto group-hover/row:tw-opacity-100 group-has-[:focus-visible]/row:tw-pointer-events-auto group-has-[:focus-visible]/row:tw-opacity-100"
                  >
                    <button
                      type="button"
                      bitIconButton="bwi-pencil-square"
                      size="small"
                      label="Edit item"
                      (click)="openEditDialog(row)"
                    ></button>
                  </div>
                  }
                </div>
              </bit-cell>
            </bit-column>

            <div slot="empty">
              @switch (state()) { @case ("no-rules") {
              <bit-status-lockup>
                <bit-svg slot="graphic" [content]="noResultsSvg"></bit-svg>
                <span slot="title">No access rules yet</span>
                <span slot="description">
                  Items in a shared folder with an access rule are covered. Create an access rule to
                  see your coverage.
                </span>
                <button slot="button" type="button" bitButton buttonType="primary">
                  Create access rule
                </button>
              </bit-status-lockup>
              } @case ("no-gaps") {
              <bit-status-lockup>
                <bit-svg slot="graphic" [content]="partySvg"></bit-svg>
                <span slot="title">You're all caught up</span>
                <span slot="description">
                  Every item in a shared folder is covered by an access rule.
                </span>
                <button slot="button" type="button" bitButton buttonType="secondary">
                  View access rules
                </button>
              </bit-status-lockup>
              } @case ("no-search") {
              <bit-status-lockup>
                <bit-svg slot="graphic" [content]="noResultsSvg"></bit-svg>
                <span slot="title">No items match "oracle"</span>
                <button
                  slot="button"
                  type="button"
                  bitButton
                  buttonType="secondary"
                  startIcon="bwi-clear"
                >
                  Clear search
                </button>
              </bit-status-lockup>
              } @case ("no-filter") {
              <bit-status-lockup>
                <bit-svg slot="graphic" [content]="noResultsSvg"></bit-svg>
                <span slot="title">No items match selected filters</span>
                <button
                  slot="button"
                  type="button"
                  bitButton
                  buttonType="secondary"
                  startIcon="bwi-clear"
                >
                  Clear all
                </button>
              </bit-status-lockup>
              } @case ("scan-failed") {
              <bit-status-lockup>
                <bit-svg slot="graphic" [content]="scanFailedSvg"></bit-svg>
                <span slot="title">Items couldn't be scanned</span>
                <span slot="description">
                  An error occurred while scanning items. Refresh the page to try again.
                </span>
                <button
                  slot="button"
                  type="button"
                  bitButton
                  buttonType="primary"
                  startIcon="bwi-refresh"
                >
                  Refresh
                </button>
              </bit-status-lockup>
              } }
            </div>
          </bit-table-v2>
        </bit-section>
      </bit-page>
    </bit-layout>
  `,
})
class AccessCoveragePrototypeComponent {
  readonly state = input.required<StoryState>();
  readonly rows = input.required<CoverageRow[]>();
  readonly summary = input.required<Summary>();

  private readonly dialogService = inject(DialogService);

  protected readonly table = defineTable<CoverageRow, "actions">(this.rows);

  protected readonly reachableFolders = SHARED_FOLDERS.filter((f) => !f.isProtected);
  protected readonly protectedFolders = SHARED_FOLDERS.filter((f) => f.isProtected);
  protected readonly adminConsoleLogo = AdminConsoleLogo;
  protected readonly noResultsSvg = NoResults;
  protected readonly partySvg = Party;
  protected readonly scanFailedSvg = AccountWarning;
  protected readonly sortCoverage = sortCoverage;

  /**
   * Open the read-only view dialog, matching how clicking an item's name behaves in
   * production. Edit from here flips to {@link openEditDialog}.
   */
  protected openViewDialog(row: CoverageRow): void {
    this.dialogService.open<string, { row: CoverageRow }>(AccessCoverageViewDialogComponent, {
      data: { row },
    });
  }

  /**
   * Open the real `vault-cipher-form` in a dialog, pre-filled with the row. The
   * form is live — fields, generator, validation, Save/Cancel all work — so the
   * prototype demonstrates the full editing surface the production flow would use.
   */
  protected openEditDialog(row: CoverageRow): void {
    this.dialogService.open<string, { config: CipherFormConfig }>(
      AccessCoverageEditDialogComponent,
      { data: { config: buildCipherFormConfig(row) } },
    );
  }
}

export default {
  title: "Prototypes/PAM/Access Coverage/Admin Console page",
  component: AccessCoveragePrototypeComponent,
  decorators: [
    moduleMetadata({
      imports: [AccessCoveragePrototypeComponent],
    }),
    applicationConfig({
      // Everything lives at root so the overlay-hosted edit dialog can see it. The vault
      // services the embedded `vault-cipher-form` touches (CipherFormService override,
      // generator, totp capture, nudges, account/avatar, etc.) are all plain stubs — the
      // form is the real component, only the write path is mocked.
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        importProvidersFrom(PreloadedEnglishI18nModule),
        importProvidersFrom(ToastModule.forRoot()),
        { provide: GlobalStateProvider, useClass: StorybookGlobalStateProvider },
        { provide: StateProvider, useClass: StorybookStateProvider },
        {
          provide: NudgesService,
          useValue: {
            showNudge$: new BehaviorSubject({
              hasBadgeDismissed: true,
              hasSpotlightDismissed: true,
            } as NudgeStatus),
            showNudgeSpotlight$: () => new BehaviorSubject(false),
          },
        },
        {
          provide: CipherArchiveService,
          useValue: {
            userCanArchive$: () => of(false),
            archiveWithServer: () => Promise.resolve(),
          },
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: new BehaviorSubject({ email: "admin@acme.corp", name: "Admin Alex" }),
          },
        },
        { provide: AvatarService, useValue: { getUserAvatarColor$: () => of("#175ddc") } },
        { provide: CipherFormService, useClass: StubCipherFormService },
        { provide: ToastService, useValue: { showToast: action("showToast") } },
        { provide: PasswordRepromptService, useValue: { enabled$: new BehaviorSubject(false) } },
        {
          provide: SshImportPromptService,
          useValue: { importSshKeyFromClipboard: () => Promise.resolve(new SshKeyData()) },
        },
        {
          provide: CipherFormGenerationService,
          useValue: {
            generateInitialPassword: () => Promise.resolve("initial-password"),
            generatePassword: () => Promise.resolve("random-password"),
            generateUsername: () => Promise.resolve("random-username"),
          },
        },
        {
          provide: TotpCaptureService,
          useValue: {
            captureTotpSecret: () => Promise.resolve("some-value"),
            canCaptureTotp: () => true,
          },
        },
        { provide: AuditService, useValue: { passwordLeaked: () => Promise.resolve(0) } },
        {
          provide: DomainSettingsService,
          useValue: {
            resolvedDefaultUriMatchStrategy$: new BehaviorSubject(UriMatchStrategy.StartsWith),
            defaultUriMatchStrategy$: new BehaviorSubject(UriMatchStrategy.Domain),
            defaultUriMatchStrategyPolicy$: new BehaviorSubject(null),
          },
        },
        {
          provide: AutofillSettingsServiceAbstraction,
          useValue: { autofillOnPageLoadDefault$: new BehaviorSubject(true) },
        },
        { provide: EventCollectionService, useValue: { collect: () => Promise.resolve() } },
        {
          provide: PlatformUtilsService,
          useValue: {
            getClientType: () => ClientType.Web,
            getDevice: () => DeviceType.ChromeBrowser,
          },
        },
        {
          provide: CipherFormCacheService,
          useValue: { getCachedCipherView: (): null => null, initializedWithValue: false },
        },
        { provide: ViewCacheService, useValue: { signal: () => signal(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
        { provide: PolicyService, useValue: { policiesByType$: () => new BehaviorSubject([]) } },
      ],
    }),
  ],
} as Meta<AccessCoveragePrototypeComponent>;

type Story = StoryObj<AccessCoveragePrototypeComponent>;

const storyTemplate = /* HTML */ `<access-coverage-prototype
  [state]="state"
  [rows]="rows"
  [summary]="summary"
></access-coverage-prototype>`;

export const CoverageGaps: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "default", rows: COVERAGE_ROWS, summary: DEFAULT_SUMMARY },
    template: storyTemplate,
  }),
};

export const Scanning: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "scanning", rows: [], summary: DEFAULT_SUMMARY },
    template: storyTemplate,
  }),
};

export const NoAccessRules: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "no-rules", rows: [], summary: DEFAULT_SUMMARY },
    template: storyTemplate,
  }),
};

export const NoCoverageGaps: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "no-gaps", rows: [], summary: ZERO_SUMMARY },
    template: storyTemplate,
  }),
};

export const NoResultsFromSearch: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "no-search", rows: [], summary: DEFAULT_SUMMARY },
    template: storyTemplate,
  }),
};

export const NoResultsFromFilters: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "no-filter", rows: [], summary: DEFAULT_SUMMARY },
    template: storyTemplate,
  }),
};

export const ScanFailed: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "scan-failed", rows: [], summary: DEFAULT_SUMMARY },
    template: storyTemplate,
  }),
};

export const MixedPermissions: Story = {
  globals: enabledFlags(FeatureFlag.VFO1Foundation),
  render: () => ({
    props: { state: "default", rows: COVERAGE_ROWS, summary: DEFAULT_SUMMARY },
    template: storyTemplate,
  }),
};
