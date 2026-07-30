import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";

import { IconComponent as VaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  defineTable,
  FilterMenuModule,
  IconModule,
  LinkModule,
  NoItemsModule,
  SearchModule,
  SelectionConfig,
  SkeletonTextComponent,
  SortFn,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { VaultItemEvent } from "../vault-item-event";

import { VaultItemsTableActionsColumnComponent } from "./vault-items-table-actions-column.component";
import { VaultItemsTableChipsCellComponent } from "./vault-items-table-chips-cell.component";
import {
  DEFAULT_COPY_PRESENTATION,
  VaultItemsTableCopyPresentation,
} from "./vault-items-table-copy-presentation";
import { VaultItemsTableColumn, VaultItemsTableRowAction } from "./vault-items-table-row-action";

/**
 * Sentinel for the Vault chip's "my vault" option. Organizations are identified by id, and the
 * individual vault has none, so it needs a value of its own that can't collide with one.
 */
export const MY_VAULT = "myVault";

/** Sentinel for the My folders chip's "no folder" option. */
export const NO_FOLDER = "noFolder";

/** The shape of {@link BitTableV2Component.filterValues} for this table. */
export type VaultItemsTableFilters = {
  /** Reserved key — the table adopts a projected `bit-search` under it automatically. */
  search?: string;
  type?: CipherType;
  favorites?: boolean;
  /** An organization id, or {@link MY_VAULT}. */
  vault?: string;
  /** A collection id. */
  sharedFolder?: string;
  /** A folder id, or {@link NO_FOLDER}. */
  folder?: string;
};

/** Every cipher type the Type chip offers when a client doesn't narrow the list. */
const ALL_CIPHER_TYPES: CipherType[] = [
  CipherType.Login,
  CipherType.Card,
  CipherType.Identity,
  CipherType.SecureNote,
  CipherType.SshKey,
  CipherType.BankAccount,
  CipherType.DriversLicense,
  CipherType.Passport,
];

/**
 * Widens an id to a plain string.
 *
 * Cipher ids are branded SDK types on `CipherListView` (`OrganizationId`, `CollectionId`,
 * `FolderId`) but plain strings on `CipherView`, so reading one off `CipherViewLike` yields a
 * union that can't key a lookup or be compared to a filter value until it's normalized.
 */
const idString = (id: unknown): string | undefined => (id == null ? undefined : String(id));

/** i18n key per cipher type, for the Type chip's options. */
const CIPHER_TYPE_LABELS: Record<CipherType, string> = {
  [CipherType.Login]: "typeLogin",
  [CipherType.Card]: "typeCard",
  [CipherType.Identity]: "typeIdentity",
  [CipherType.SecureNote]: "typeSecureNote",
  [CipherType.SshKey]: "typeSshKey",
  [CipherType.BankAccount]: "typeBankAccount",
  [CipherType.DriversLicense]: "typeDriversLicense",
  [CipherType.Passport]: "typePassport",
};

/**
 * The shared vault items list: a cipher-only table on `bit-table-v2` with its own search and
 * filter chips, sorting, selection, and the two-tier row actions column.
 *
 * The component is deliberately client-agnostic. It never builds a domain event — each row action
 * carries an event factory the client supplies ({@link VaultItemsTableRowAction}) — and it never
 * navigates, so hosting it means supplying data, an action set, and an event handler.
 *
 * @typeParam C - The cipher shape, either `CipherView` or the lighter `CipherListView`.
 * @typeParam E - The event type the client's actions produce. Defaults to {@link VaultItemEvent}.
 */
@Component({
  selector: "vault-items-table",
  templateUrl: "./vault-items-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    FilterMenuModule,
    I18nPipe,
    IconModule,
    LinkModule,
    NoItemsModule,
    SearchModule,
    SkeletonTextComponent,
    VaultIconComponent,
    VaultItemsTableActionsColumnComponent,
    VaultItemsTableChipsCellComponent,
  ],
})
export class VaultItemsTableComponent<C extends CipherViewLike, E = VaultItemEvent<C>> {
  private readonly i18nService = inject(I18nService);

  /** The rows to display. Declared before {@link table}, which reads it as its data signal. */
  readonly ciphers = input.required<C[]>();

  /** Shows skeleton rows in place of data. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** The client's overflow menu actions. */
  readonly rowActions = input<VaultItemsTableRowAction<C, E>[]>([]);

  /** How the built-in Copy quick action presents itself; forwarded to the actions column. */
  readonly copyPresentation = input<VaultItemsTableCopyPresentation>(DEFAULT_COPY_PRESENTATION);

  /** Folders used to resolve the My folders column and chip. */
  readonly folders = input<FolderView[]>([]);

  /** Collections used to resolve the Shared folders column and chip. */
  readonly collections = input<CollectionView[]>([]);

  /**
   * Organizations used to resolve the Vault column and chip. Pass an empty array to hide the
   * Vault chip — policy decisions (organization data ownership, single organization) belong to
   * the hosting page, not here.
   */
  readonly organizations = input<Organization[]>([]);

  /** Cipher types the Type chip offers. Narrow it to respect a client's feature flags. */
  readonly cipherTypes = input<CipherType[]>(ALL_CIPHER_TYPES);

  /**
   * Builds the event emitted when a row's name is activated. Omit to render the name as plain
   * text rather than a button.
   */
  readonly itemAction = input<(item: C) => E>();

  /** Emits the event a chosen row action or item activation built. */
  readonly action = output<E>();

  /** Emits the selected rows whenever the selection changes. */
  readonly selectedChange = output<readonly C[]>();

  protected readonly table = defineTable<C, VaultItemsTableColumn>(this.ciphers);

  /**
   * Must stay a stable reference — `bit-table-v2` rebuilds its selection model whenever this
   * changes, so an inline object literal in the template would reset the selection constantly.
   */
  protected readonly selection: SelectionConfig<C> = { multiple: true };

  /** Bound to `[displayedColumns]`; the hook a future column-customize story writes to. */
  protected readonly displayedColumns = signal<VaultItemsTableColumn[]>([
    "name",
    "vault",
    "sharedFolders",
    "myFolders",
    "actions",
  ]);

  protected readonly CipherViewLikeUtils = CipherViewLikeUtils;
  protected readonly MY_VAULT = MY_VAULT;
  protected readonly NO_FOLDER = NO_FOLDER;

  /**
   * Empty-state copy. A single `slot="empty"` has to cover both cases — rows filtered down to
   * none, and a genuinely empty vault — so the branch resolves to an i18n key rather than
   * wrapping the slots in an `@if`: content projection only matches the static top-level nodes
   * of projected content, so anything inside a conditional block never reaches its slot.
   *
   * `bit-table-v2` draws the same distinction internally, but keeps it `protected`; the row
   * input tells us the same thing.
   */
  protected readonly emptyTitleKey = computed(() =>
    this.ciphers().length > 0 ? "noMatchingItems" : "noItemsInVault",
  );

  protected readonly emptyDescriptionKey = computed(() =>
    this.ciphers().length > 0 ? "clearFiltersOrTryAnother" : "emptyVaultDescription",
  );

  protected readonly cipherTypeLabel = (type: CipherType) => CIPHER_TYPE_LABELS[type];

  private readonly folderNames = computed(() => this.nameMap(this.folders()));

  private readonly collectionNames = computed(() => this.nameMap(this.collections()));

  private readonly organizationNames = computed(() => this.nameMap(this.organizations()));

  /** Indexes named entities by id, widened to plain strings, skipping any that lack one. */
  private nameMap(items: readonly { id?: unknown; name: string }[]): Map<string, string> {
    const map = new Map<string, string>();
    for (const item of items) {
      const id = idString(item.id);
      if (id) {
        map.set(id, item.name);
      }
    }
    return map;
  }

  /** The organizations offered by the Vault chip, sorted for a stable menu. */
  protected readonly sortedOrganizations = computed(() =>
    [...this.organizations()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** Whether the Vault chip has anything to offer beyond the individual vault. */
  protected readonly showVaultFilter = computed(() => this.organizations().length > 0);

  /** The owning vault's display name: the organization's name, or "My vault". */
  protected vaultName(cipher: C): string {
    const organizationId = idString(cipher.organizationId);
    if (!organizationId) {
      return this.i18nService.t("myVault");
    }
    return this.organizationNames().get(organizationId) ?? this.i18nService.t("organization");
  }

  /** Resolved names of the collections this cipher belongs to. */
  protected sharedFolderNames(cipher: C): string[] {
    const names = this.collectionNames();
    return (cipher.collectionIds ?? [])
      .map((id) => idString(id))
      .map((id) => (id ? names.get(id) : undefined))
      .filter((name): name is string => name != null);
  }

  /** Resolved name of this cipher's folder, as a list so it shares the chips cell. */
  protected folderNamesFor(cipher: C): string[] {
    const folderId = idString(cipher.folderId);
    const name = folderId ? this.folderNames().get(folderId) : undefined;
    return name ? [name] : [];
  }

  protected subtitle(cipher: C): string | undefined {
    return CipherViewLikeUtils.subtitle(cipher, this.i18nService);
  }

  /**
   * Sort comparators for the synthetic columns. The table's default comparator reads
   * `row[columnName]`, which is undefined for a column with no matching field — so without
   * these, sorting those headers would silently do nothing. Each sorts by resolved display
   * name, which is what the user sees, not by the underlying id.
   */
  protected readonly sortByVault: SortFn = (a: C, b: C) =>
    this.vaultName(a).localeCompare(this.vaultName(b));

  protected readonly sortBySharedFolders: SortFn = (a: C, b: C) =>
    this.compareNames(this.sharedFolderNames(a), this.sharedFolderNames(b));

  protected readonly sortByFolders: SortFn = (a: C, b: C) =>
    this.compareNames(this.folderNamesFor(a), this.folderNamesFor(b));

  /** Orders by first name; rows with no memberships sort last regardless of direction. */
  private compareNames(a: string[], b: string[]): number {
    const first = a.at(0);
    const second = b.at(0);
    if (!first && !second) {
      return 0;
    }
    if (!first) {
      return 1;
    }
    if (!second) {
      return -1;
    }
    return first.localeCompare(second);
  }

  /**
   * The single client-side predicate `bit-table-v2` derives everything from: the visible rows,
   * the toolbar's item count, the select-all scope, each chip option's faceted count, and the
   * empty-versus-no-matches branch.
   *
   * Declared as a field arrow function so its reference stays stable across change detection.
   */
  protected readonly filter = (cipher: C, values: VaultItemsTableFilters): boolean =>
    this.matchesSearch(cipher, values.search) &&
    this.matchesType(cipher, values.type) &&
    this.matchesFavorite(cipher, values.favorites) &&
    this.matchesVault(cipher, values.vault) &&
    this.matchesSharedFolder(cipher, values.sharedFolder) &&
    this.matchesFolder(cipher, values.folder);

  private matchesSearch(cipher: C, search: string | undefined): boolean {
    const term = search?.trim().toLowerCase();
    if (!term) {
      return true;
    }
    const subtitle = this.subtitle(cipher);
    return (
      cipher.name.toLowerCase().includes(term) || (subtitle?.toLowerCase().includes(term) ?? false)
    );
  }

  private matchesType(cipher: C, type: CipherType | undefined): boolean {
    // `type` differs between CipherView and CipherListView, so it must go through the utils.
    return type == null || CipherViewLikeUtils.getType(cipher) === type;
  }

  private matchesFavorite(cipher: C, favorites: boolean | undefined): boolean {
    return !favorites || cipher.favorite;
  }

  private matchesVault(cipher: C, vault: string | undefined): boolean {
    if (vault == null) {
      return true;
    }
    if (vault === MY_VAULT) {
      return !cipher.organizationId;
    }
    return idString(cipher.organizationId) === vault;
  }

  private matchesSharedFolder(cipher: C, sharedFolder: string | undefined): boolean {
    return (
      sharedFolder == null ||
      (cipher.collectionIds ?? []).some((id) => idString(id) === sharedFolder)
    );
  }

  private matchesFolder(cipher: C, folder: string | undefined): boolean {
    if (folder == null) {
      return true;
    }
    if (folder === NO_FOLDER) {
      return !cipher.folderId;
    }
    return idString(cipher.folderId) === folder;
  }
}
