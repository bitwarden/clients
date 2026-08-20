import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";

import { IconComponent as VaultIconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DIALOG_CIPHER_MENU_ITEMS } from "@bitwarden/common/vault/types/cipher-menu-items";
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

import { VaultItemsTableActionsColumnComponent } from "./vault-items-table-actions-column.component";
import {
  VaultItemsTableChip,
  VaultItemsTableChipsCellComponent,
} from "./vault-items-table-chips-cell.component";
import {
  DEFAULT_COPY_PRESENTATION,
  VaultItemsTableCopyPresentation,
} from "./vault-items-table-copy-presentation";
import { VaultItemsTableRowAction } from "./vault-items-table-row-action";
import { cipherSearchMatches } from "./vault-items-table-search";

/**
 * Sentinel for the Vault chip's "my vault" option — organizations are identified by id, and the
 * individual vault has none.
 */
export const MY_VAULT = "myVault";

/** Sentinel for the My folders chip's "no folder" option. */
export const NO_FOLDER = "noFolder";

/** The `queryParam` namespace shared by every filter chip in the vault table. */
export const VAULT_FILTER_NAMESPACE = "vault";

/**
 * The `key` values for each filter chip in the vault table.
 * Export these so consumers (the guard, deep-link builders) can reference them
 * without coupling to string literals that diverge over time.
 */
export const VAULT_FILTER_KEYS = Object.freeze({
  type: "type",
  favorites: "favorites",
  vault: "vault",
  sharedFolder: "sharedFolder",
  folder: "folder",
  search: "search",
} as const);

/**
 * Every column the table declares, in display order. Doubles as the default column set — which of
 * them actually render is narrowed from here per the rows on hand, see {@link
 * VaultItemsTableComponent.visibleColumns}.
 */
export const VAULT_COLUMNS = Object.freeze([
  "name",
  "vault",
  "sharedFolders",
  "myFolders",
  "actions",
] as const);

/** Passed as `defineTable`'s second type parameter. */
export type VaultItemsTableColumn = (typeof VAULT_COLUMNS)[number];

/**
 * The `filterValues` key `bit-table-v2` reserves for a projected `bit-search` (its module-private
 * `SEARCH_FILTER_KEY`). Mirrored here so the empty state's Clear all can skip it and clear chip
 * filters only, matching the toolbar's own `clearAll()`.
 */
const SEARCH_FILTER_KEY = "search";

/** The shape of {@link BitTableV2Component.filterValues} for this table. */
export type VaultItemsTableFilters = {
  /**
   * Reserved key — the table adopts a projected `bit-search` under it automatically. It carries the
   * term for seeding, URL sync, and Clear all, but matching runs through `SearchService` rather
   * than off this value — see {@link VaultItemsTableComponent.filter}.
   */
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

/**
 * Every cipher type the Type chip offers when a client doesn't narrow the list, in the order the
 * new item dialog lists them. Derived from {@link DIALOG_CIPHER_MENU_ITEMS} so the two stay in
 * step as types are added.
 */
const ALL_CIPHER_TYPES: CipherType[] = DIALOG_CIPHER_MENU_ITEMS.map((item) => item.type);

/**
 * Widens an id to a plain string.
 *
 * Cipher ids are branded SDK types on `CipherListView` (`OrganizationId`, `CollectionId`,
 * `FolderId`) but plain strings on `CipherView`, so reading one off `CipherViewLike` yields a
 * union that can't key a lookup or be compared to a filter value until it's normalized.
 */
const idString = (id: unknown): string | undefined => (id == null ? undefined : String(id));

/**
 * i18n key per cipher type, for the Type chip's options — taken from the same menu items
 * {@link ALL_CIPHER_TYPES} is built from, so a type and its label come from one place.
 *
 * Those items cover every {@link CipherType}, so the lookup in {@link
 * VaultItemsTableComponent.cipherTypeLabel} always resolves.
 */
const CIPHER_TYPE_LABELS = new Map<CipherType, string>(
  DIALOG_CIPHER_MENU_ITEMS.map((item) => [item.type, item.labelKey]),
);

/**
 * The shared vault items list: a cipher-only table on `bit-table-v2` with its own search and
 * filter chips, sorting, selection, and row actions.
 *
 * Hosting it means supplying the rows (`ciphers`, plus the `folders`, `collections`, and
 * `organizations` their columns and chips resolve names from), a `rowActions` set, and an `action`
 * handler. The table builds no domain events and never navigates, so each client stays in control
 * of what its actions mean.
 *
 * Everything else follows from the rows: which filter chips and columns apply, which cipher types
 * the Type chip offers, and every faceted count. A host narrows `ciphers` and the table adjusts.
 *
 * `ciphers` needs no ordering — the table sorts by name itself and keeps that as the tiebreak
 * behind every other column. See {@link sortedCiphers}.
 *
 * The toolbar's search goes through `SearchService`, so it matches on everything a client's own
 * vault search does — name, subtitle, login URIs, notes, and item id, diacritic-insensitively —
 * and honors `>`-prefixed lunr queries. See {@link cipherSearchMatches}.
 *
 * Project page-level buttons into the toolbar with `slot="toolbar"`.
 *
 * @typeParam C - The cipher shape, either `CipherView` or the lighter `CipherListView`.
 *
 * @example
 * ```html
 * <vault-items-table
 *   [ciphers]="ciphers()"
 *   [rowActions]="rowActions()"
 *   [folders]="folders()"
 *   [collections]="collections()"
 *   [organizations]="organizations()"
 *   [itemAction]="viewCipher"
 * >
 *   <button slot="toolbar" bitButton buttonType="primary" type="button">Add</button>
 * </vault-items-table>
 * ```
 */
@Component({
  selector: "vault-items-table",
  templateUrl: "./vault-items-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-flex-1 tw-min-h-0",
  },
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
export class VaultItemsTableComponent<C extends CipherViewLike> {
  private readonly i18nService = inject(I18nService);

  protected readonly filterNamespace = VAULT_FILTER_NAMESPACE;
  protected readonly filterKeys = VAULT_FILTER_KEYS;

  /** The rows to display. */
  readonly ciphers = input.required<C[]>();

  /** Shows skeleton rows in place of data. */
  readonly loading = input(false, { transform: booleanAttribute });

  /** The client's overflow menu actions. */
  readonly rowActions = input<VaultItemsTableRowAction<C>[]>([]);

  /** How the built-in Copy quick action presents itself. */
  readonly copyPresentation = input<VaultItemsTableCopyPresentation>(DEFAULT_COPY_PRESENTATION);

  /** Folders used to resolve the My folders column and chip. */
  readonly folders = input<FolderView[]>([]);

  /** Collections used to resolve the Shared folders column and chip. */
  readonly collections = input<CollectionView[]>([]);

  /**
   * Organizations used to resolve the Vault column and chip.
   */
  readonly organizations = input<Organization[]>([]);

  /** Cipher types the Type chip offers. Narrow it to respect a client's feature flags. */
  readonly cipherTypes = input<CipherType[]>(ALL_CIPHER_TYPES);

  /**
   * The organization these rows belong to, for a vault the admin console has scoped to one.
   *
   * It scopes `SearchService`'s lunr index (see {@link cipherSearchMatches}) and nothing else.
   * Which columns and filter chips apply is derived from `ciphers` alone, so setting this neither
   * hides nor reveals any of them — scoping the table stays a matter of narrowing `ciphers`. Leave
   * it unset for an individual vault.
   */
  readonly organizationId = input<OrganizationId>();

  /**
   * Filter chip selections to open the table with, keyed by chip `key` — e.g. deep-linking into
   * one shared folder. Applied once per chip as it registers, so later changes are ignored; to
   * drive chips reactively, use `bit-table-v2`'s `filterControls()` and their `setValue()`.
   */
  readonly initialFilterValues = input<Partial<VaultItemsTableFilters>>();

  /**
   * Runs when a row's name is activated. Omit to render the name as plain text rather than a button.
   */
  readonly itemAction = input<(item: C) => void | Promise<void>>();

  /** Emits the selected rows whenever the selection changes. */
  readonly selectedChange = output<readonly C[]>();

  /**
   * {@link ciphers} ordered by name serving as the table's implicit secondary sort.
   */
  private readonly sortedCiphers = computed(() =>
    [...this.ciphers()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** Reads {@link sortedCiphers} as its data signal, so that has to be declared before this. */
  protected readonly table = defineTable<C, VaultItemsTableColumn>(this.sortedCiphers);

  /**
   * Must stay a stable reference — `bit-table-v2` rebuilds its selection model whenever this
   * changes, so an inline object literal in the template would reset the selection constantly.
   */
  protected readonly selection: SelectionConfig<C> = { multiple: true };

  /** The configured column set to display */
  protected readonly displayedColumns = signal<VaultItemsTableColumn[]>([...VAULT_COLUMNS]);

  /**
   * The relevant columns to be displayed based on the current ciphers provided.
   *  - Vault is omitted if all ciphers belong to the same Vault
   *  - Shared Folders is omitted if all ciphers are individually owned
   */
  protected readonly visibleColumns = computed<VaultItemsTableColumn[]>(() => {
    const hidden = new Set<VaultItemsTableColumn>();
    if (!this.multipleVaults()) {
      hidden.add("vault");
    }
    if (!this.showSharedFolders()) {
      hidden.add("sharedFolders");
    }
    return this.displayedColumns().filter((column) => !hidden.has(column));
  });

  protected readonly CipherViewLikeUtils = CipherViewLikeUtils;
  protected readonly MY_VAULT = MY_VAULT;
  protected readonly NO_FOLDER = NO_FOLDER;

  /**
   * Empty-state copy. A single `slot="empty"` has to cover both cases — rows filtered down to
   * none, and a genuinely empty vault — so the branch resolves to an i18n key rather than
   * wrapping the slots in an `@if`: content projection only matches the static top-level nodes
   * of projected content, so anything inside a conditional block never reaches its slot.
   */
  protected readonly emptyTitleKey = computed(() =>
    this.ciphers().length > 0 ? "noMatchingItems" : "noItemsInVault",
  );

  protected readonly emptyDescriptionKey = computed(() =>
    this.ciphers().length > 0 ? "clearFiltersOrTryAnother" : "emptyVaultDescription",
  );

  protected readonly cipherTypeLabel = (type: CipherType) => CIPHER_TYPE_LABELS.get(type) ?? "";

  /**
   * The Type chip's options: {@link cipherTypes} narrowed to the types actually present among
   * {@link ciphers}, preserving `cipherTypes()`'s ordering.
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

  /**
   * The distinct vaults {@link ciphers} span, as the values the Vault chip offers: an organization
   * id per organization {@link organizations} can name, plus {@link MY_VAULT} when any cipher is
   * individually owned.
   */
  private readonly presentVaults = computed(() => {
    const names = this.organizationNames();
    const vaults = new Set<string>();
    for (const cipher of this.ciphers()) {
      const organizationId = idString(cipher.organizationId);
      if (!organizationId) {
        vaults.add(MY_VAULT);
      } else if (names.has(organizationId)) {
        vaults.add(organizationId);
      }
    }
    return vaults;
  });

  /**
   * Whether the rows span more than one vault. Used to determine Vault column/filter visbility.
   */
  protected readonly multipleVaults = computed(() => this.presentVaults().size > 1);

  /** Whether the Vault chip offers "My vault" — only when some cipher is individually owned. */
  protected readonly showMyVaultOption = computed(() => this.presentVaults().has(MY_VAULT));

  /**
   * The organizations the Vault chip offers, sorted for a stable menu.
   */
  protected readonly sortedOrganizations = computed(() => {
    const present = this.presentVaults();
    return this.organizations()
      .filter((organization) => present.has(idString(organization.id) ?? ""))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  /**
   * Whether the Shared folders chip has anything to offer — only when some cipher belongs to an organization
   */
  protected readonly showSharedFolders = computed(() =>
    this.ciphers().some((cipher) => cipher.organizationId != null),
  );

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

  /**
   * The collections this cipher belongs to, as chips ordered by name. Collections missing from
   * {@link collections} are dropped, so every chip carries a value the Shared folders filter
   * actually offers.
   */
  protected sharedFolderChips(cipher: C): VaultItemsTableChip[] {
    const names = this.collectionNames();
    return (cipher.collectionIds ?? [])
      .flatMap((collectionId) => {
        const value = idString(collectionId);
        const name = value ? names.get(value) : undefined;
        return value && name ? [{ value, name }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** This cipher's folder, as a chip list so it shares the chips cell — see {@link sharedFolderChips}. */
  protected folderChips(cipher: C): VaultItemsTableChip[] {
    const value = idString(cipher.folderId);
    const name = value ? this.folderNames().get(value) : undefined;
    return value && name ? [{ value, name }] : [];
  }

  protected subtitle(cipher: C): string | undefined {
    return CipherViewLikeUtils.subtitle(cipher, this.i18nService);
  }

  /**
   * Sort comparators for the synthetic columns. The table's default comparator reads
   * `row[columnName]`, which is undefined for a column with no matching field — so without
   * these, sorting those headers would silently do nothing.
   */
  protected readonly sortByVault: SortFn = (a: C, b: C) =>
    this.vaultName(a).localeCompare(this.vaultName(b));

  protected readonly sortBySharedFolders: SortFn = (a: C, b: C) =>
    this.compareChips(this.sharedFolderChips(a), this.sharedFolderChips(b));

  protected readonly sortByFolders: SortFn = (a: C, b: C) =>
    this.compareChips(this.folderChips(a), this.folderChips(b));

  /**
   * Orders by first name, sorting rows with no memberships after named ones — so they land last
   * ascending and first descending, since `bit-table-v2` negates the result for a descending sort.
   *
   * Equal first names return `0` so the row order falls through to {@link sortedCiphers}
   */
  private compareChips(a: VaultItemsTableChip[], b: VaultItemsTableChip[]): number {
    const first = a.at(0)?.name;
    const second = b.at(0)?.name;
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
   * The projected `bit-table-v2`, read for the search term it adopts from `bit-search` under
   * {@link SEARCH_FILTER_KEY}. A view query rather than the predicate's `values`, because a
   * memoized search result has to be computed outside the per-row call.
   */
  private readonly tableComponent = viewChild(BitTableV2Component);

  /**
   * The live search term. Cast because a view query erases the table's generics, so its
   * `filterValues()` comes back as an untyped record.
   */
  private readonly searchTerm = computed(
    () =>
      (this.tableComponent()?.filterValues() as VaultItemsTableFilters | undefined)?.search ?? "",
  );

  /** Reads the signals above, so all of them have to be declared before this. */
  private readonly searchMatches = cipherSearchMatches(
    this.ciphers,
    this.searchTerm,
    this.organizationId,
  );

  /**
   * The single client-side predicate `bit-table-v2` derives everything from: the visible rows,
   * the toolbar's item count, the select-all scope, each chip option's faceted count, and the
   * empty-versus-no-matches branch.
   *
   * The search term is the one filter it doesn't read off `values`: `SearchService` is
   * asynchronous and set-based, so the term is resolved to a set of matching ids out of band by
   * {@link cipherSearchMatches} and consulted here. Reading that signal is what makes the table
   * re-filter when a search resolves.
   *
   * Declared as a field arrow function so its reference stays stable across change detection.
   */
  protected readonly filter = (cipher: C, values: VaultItemsTableFilters): boolean =>
    this.matchesSearch(cipher) &&
    this.matchesType(cipher, values.type) &&
    this.matchesFavorite(cipher, values.favorites) &&
    this.matchesVault(cipher, values.vault) &&
    this.matchesSharedFolder(cipher, values.sharedFolder) &&
    this.matchesFolder(cipher, values.folder);

  /**
   * Whether the cipher is among the active search's matches. `undefined` matches means no
   * searchable term is active, so every row passes — see {@link cipherSearchMatches}.
   */
  private matchesSearch(cipher: C): boolean {
    const matches = this.searchMatches();
    return matches === undefined || matches.has(String(cipher.id));
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
   * Narrows one multi-select chip to a single value, replacing whatever it held.
   *
   * Activating a membership chip in a row reads as "show me this folder", so it replaces that
   * chip's selection rather than adding to it. Every other chip is left alone, so it composes with
   * an active search or Type filter.
   */
  protected filterTo(
    table: BitTableV2Component<C, VaultItemsTableColumn, VaultItemsTableFilters>,
    key: "sharedFolder" | "folder",
    value: string,
  ): void {
    table
      .filterControls()
      .find((control: FilterControl) => control.key() === key)
      ?.setValue([value]);
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
