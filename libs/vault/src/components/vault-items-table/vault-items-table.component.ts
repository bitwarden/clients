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
  ButtonModule,
  defineTable,
  FilterControl,
  FilterMenuModule,
  IconModule,
  LinkModule,
  NoItemsModule,
  SearchModule,
  SelectionConfig,
  SkeletonTextComponent,
  SortFn,
  TooltipDirective,
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
 * Sentinel for the Vault chip's "my vault" option — organizations are identified by id, and the
 * individual vault has none.
 */
export const MY_VAULT = "myVault";

/** Sentinel for the My folders chip's "no folder" option. */
export const NO_FOLDER = "noFolder";

/**
 * The `filterValues` key `bit-table-v2` reserves for a projected `bit-search` (its module-private
 * `SEARCH_FILTER_KEY`). Mirrored here so the empty state's Clear all can skip it and clear chip
 * filters only, matching the toolbar's own `clearAll()`.
 */
const SEARCH_FILTER_KEY = "search";

/** The shape of {@link BitTableV2Component.filterValues} for this table. */
export type VaultItemsTableFilters = {
  /** Reserved key — the table adopts a projected `bit-search` under it automatically. */
  search?: string;
  type?: CipherType;
  favorites?: boolean;
  /** Organization ids, or {@link MY_VAULT}. Multi-select: a cipher matches any selected value. */
  vault?: string[];
  /** Collection ids. Multi-select: a cipher matches any selected collection. */
  sharedFolder?: string[];
  /** Folder ids, or {@link NO_FOLDER}. Multi-select: a cipher matches any selected value. */
  folder?: string[];
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
 * filter chips, sorting, selection, and row actions.
 *
 * Hosting it means supplying the rows ({@link ciphers}, plus the {@link folders},
 * {@link collections}, and {@link organizations} their columns and chips resolve names from), a
 * {@link rowActions} set, and an {@link action} handler. The table builds no domain events and
 * never navigates, so each client stays in control of what its actions mean.
 *
 * Project page-level buttons into the toolbar with `slot="toolbar"`.
 *
 * @typeParam C - The cipher shape, either `CipherView` or the lighter `CipherListView`.
 * @typeParam E - The event type the client's actions produce. Defaults to {@link VaultItemEvent}.
 *
 * @example
 * ```html
 * <vault-items-table
 *   [ciphers]="ciphers()"
 *   [rowActions]="rowActions()"
 *   [folders]="folders()"
 *   [collections]="collections()"
 *   [organizations]="organizations()"
 *   [itemAction]="editCipher"
 *   (action)="onAction($event)"
 * >
 *   <button slot="toolbar" bitButton buttonType="primary" type="button">Add</button>
 * </vault-items-table>
 * ```
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
    ButtonModule,
    FilterMenuModule,
    I18nPipe,
    IconModule,
    LinkModule,
    NoItemsModule,
    SearchModule,
    SkeletonTextComponent,
    TooltipDirective,
    VaultIconComponent,
    VaultItemsTableActionsColumnComponent,
    VaultItemsTableChipsCellComponent,
  ],
})
export class VaultItemsTableComponent<C extends CipherViewLike, E = VaultItemEvent<C>> {
  private readonly i18nService = inject(I18nService);

  /** The rows to display. */
  readonly ciphers = input.required<C[]>();

  /** Shows skeleton rows in place of data. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** The client's overflow menu actions. */
  readonly rowActions = input<VaultItemsTableRowAction<C, E>[]>([]);

  /** How the built-in Copy quick action presents itself. */
  readonly copyPresentation = input<VaultItemsTableCopyPresentation>(DEFAULT_COPY_PRESENTATION);

  /** Folders used to resolve the My folders column and chip. */
  readonly folders = input<FolderView[]>([]);

  /** Collections used to resolve the Shared folders column and chip. */
  readonly collections = input<CollectionView[]>([]);

  /**
   * Organizations used to resolve the Vault column and chip. Pass an empty array to hide the Vault
   * chip — policy decisions (organization data ownership, single organization) belong to the
   * hosting page.
   */
  readonly organizations = input<Organization[]>([]);

  /** Cipher types the Type chip offers. Narrow it to respect a client's feature flags. */
  readonly cipherTypes = input<CipherType[]>(ALL_CIPHER_TYPES);

  /**
   * Filter chip selections to open the table with, keyed by chip `key` — e.g. deep-linking into
   * one shared folder. Applied once per chip as it registers, so later changes are ignored; to
   * drive chips reactively, use `bit-table-v2`'s `filterControls()` and their `setValue()`.
   */
  readonly initialFilterValues = input<Partial<VaultItemsTableFilters>>();

  /**
   * Builds the event emitted when a row's name is activated. Omit to render the name as plain
   * text rather than a button.
   */
  readonly itemAction = input<(item: C) => E>();

  /** Emits the event built by the chosen {@link rowActions} entry, or by {@link itemAction}. */
  readonly action = output<E>();

  /** Emits the selected rows whenever the selection changes. */
  readonly selectedChange = output<readonly C[]>();

  /** Reads {@link ciphers} as its data signal, so that input has to be declared before this. */
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

  /**
   * The Type chip's options: {@link cipherTypes} narrowed to the types actually present among
   * {@link ciphers}, preserving `cipherTypes()`'s ordering.
   *
   * Deliberately derived from the unfiltered `ciphers()` input, NOT from the table's filtered
   * rows. Deriving it from the filtered rows would look like a reasonable optimization — narrow
   * the menu to what's actually visible — but it isn't: once the user selects "Card", the
   * filtered rows become card-only, so every *other* type would vanish from the menu and the
   * user could never switch away from "Card" again. The unfiltered cipher list is what the menu
   * must reflect for it to stay usable while a filter is active.
   */
  protected readonly availableCipherTypes = computed(() => {
    const present = new Set(this.ciphers().map((cipher) => CipherViewLikeUtils.getType(cipher)));
    return this.cipherTypes().filter((type) => present.has(type));
  });

  /**
   * Whether the Favorites chip has nothing to offer. Derived from the unfiltered `ciphers()`
   * input for the same reason as {@link availableCipherTypes} — see that comment.
   */
  protected readonly noFavorites = computed(
    () => !this.ciphers().some((cipher) => cipher.favorite),
  );

  /**
   * Tooltip for the disabled Favorites chip; empty while the chip is enabled, since `bitTooltip`
   * renders nothing for an empty string.
   */
  protected readonly favoritesDisabledTooltip = computed(() =>
    this.noFavorites() ? this.i18nService.t("favoritesFilterTooltip") : "",
  );

  /** Whether the My folders chip has nothing to offer — see {@link noFavorites}. */
  protected readonly noFolders = computed(() => this.folders().length === 0);

  /** Tooltip for the disabled My folders chip — see {@link favoritesDisabledTooltip}. */
  protected readonly foldersDisabledTooltip = computed(() =>
    this.noFolders() ? this.i18nService.t("foldersFilterTooltip") : "",
  );

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

  /** The Shared folders chip's options, sorted for a stable menu, when it isn't grouped. */
  protected readonly sortedCollections = computed(() =>
    [...this.collections()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /**
   * Whether the Shared folders chip has enough collections to group by organization instead of
   * listing them flat. Matches `bit-filter-menu`'s own `SEARCH_THRESHOLD` (also 10, exclusive) so
   * the in-menu search and the grouping kick in at the same point.
   */
  protected readonly groupSharedFolders = computed(() => this.collections().length > 10);

  /**
   * The Shared folders chip's options grouped by owning organization, for when there are enough
   * collections to warrant it (see {@link groupSharedFolders}). Groups are sorted by organization
   * name, and each group's collections are sorted by name — both for the same menu stability
   * {@link sortedOrganizations} exists for. A collection whose organization isn't in
   * {@link organizations} falls back to the localized "organization" label, matching
   * {@link vaultName}.
   */
  protected readonly groupedSharedFolders = computed(() => {
    const names = this.organizationNames();
    const groups = new Map<
      string,
      { organizationId: string; name: string; collections: CollectionView[] }
    >();
    for (const collection of this.collections()) {
      const organizationId = idString(collection.organizationId) ?? "";
      let group = groups.get(organizationId);
      if (!group) {
        group = {
          organizationId,
          name: names.get(organizationId) ?? this.i18nService.t("organization"),
          collections: [],
        };
        groups.set(organizationId, group);
      }
      group.collections.push(collection);
    }
    return [...groups.values()]
      .map((group) => ({
        ...group,
        collections: [...group.collections].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /** The My folders chip's options, sorted for a stable menu; {@link NO_FOLDER} stays pinned first. */
  protected readonly sortedFolders = computed(() =>
    [...this.folders()].sort((a, b) => a.name.localeCompare(b.name)),
  );

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

  /**
   * The Vault chip is multi-select: `vault` is an array of organization ids and/or
   * {@link MY_VAULT}. A cipher matches if it satisfies *any* selected value (OR).
   * `undefined` and `[]` both mean "no filter, match everything".
   */
  private matchesVault(cipher: C, vault: string[] | undefined): boolean {
    if (!vault || vault.length === 0) {
      return true;
    }
    return vault.some((value) =>
      value === MY_VAULT ? !cipher.organizationId : idString(cipher.organizationId) === value,
    );
  }

  /**
   * The Shared folders chip is multi-select: `sharedFolder` is an array of collection ids. As
   * with {@link matchesVault}, `undefined` and `[]` both mean unfiltered, and a cipher matches if
   * it belongs to *any* selected collection.
   */
  private matchesSharedFolder(cipher: C, sharedFolder: string[] | undefined): boolean {
    if (!sharedFolder || sharedFolder.length === 0) {
      return true;
    }
    const collectionIds = (cipher.collectionIds ?? []).map((id) => idString(id));
    return sharedFolder.some((value) => collectionIds.includes(value));
  }

  /**
   * The My folders chip is multi-select: `folder` is an array of folder ids and/or
   * {@link NO_FOLDER}. As with {@link matchesVault}, `undefined` and `[]` both mean unfiltered,
   * and a cipher matches if it satisfies *any* selected value.
   */
  private matchesFolder(cipher: C, folder: string[] | undefined): boolean {
    if (!folder || folder.length === 0) {
      return true;
    }
    return folder.some((value) =>
      value === NO_FOLDER ? !cipher.folderId : idString(cipher.folderId) === value,
    );
  }

  /**
   * Whether at least one chip filter is active, excluding the reserved {@link SEARCH_FILTER_KEY}.
   */
  protected hasActiveChipFilters(
    table: BitTableV2Component<C, VaultItemsTableColumn, VaultItemsTableFilters>,
  ): boolean {
    return table
      .filterControls()
      .some((control: FilterControl) => control.key() !== SEARCH_FILTER_KEY && control.active());
  }

  /**
   * Clears every chip filter, leaving the search term untouched.
   */
  protected clearChipFilters(
    table: BitTableV2Component<C, VaultItemsTableColumn, VaultItemsTableFilters>,
  ): void {
    for (const control of table.filterControls()) {
      if (control.key() !== SEARCH_FILTER_KEY) {
        control.setValue(undefined);
      }
    }
  }
}
