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
import { NoResults } from "@bitwarden/assets/svg";
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
  SearchModule,
  SelectionConfig,
  SkeletonTextComponent,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
  TooltipDirective,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  idString,
  matchesFavorite,
  matchesFolder,
  matchesSharedFolder,
  matchesType,
  matchesVault,
  MY_VAULT,
  NO_FOLDER,
} from "../../utils/vault-filter-predicates";

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
    SearchModule,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
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
   * The organization this table is scoped to, when the host has narrowed the view to one org.
   *
   * Scopes `SearchService`'s lunr index (see {@link cipherSearchMatches}) and suppresses the
   * "My vault" option in the Vault chip's empty-state fallback so a user who has no personal
   * items yet does not see a personal-vault filter while browsing an org-scoped view.
   * Leave it unset for an unscoped individual vault.
   */
  readonly scopedOrganizationId = input<OrganizationId>();

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

  /**
   * Whether the `OrganizationDataOwnership` organization policy applies to the current user.
   * Used within the logic of determining whether the "My vault" filter should be available to the user.
   */
  readonly orgRequiresDataOwnership = input<boolean>(false);

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
    if (!this.showVaults()) {
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

  protected readonly noResultsIcon = NoResults;

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

  /**
   * Whether the Shared folders chip has nothing to offer: either no cipher belongs to an org,
   * or no collections have been provided to populate the dropdown.
   */
  protected readonly noSharedFolderOptions = computed(() => {
    const allPersonalCiphers = this.ciphers().every((cipher) => cipher.organizationId == null);
    return allPersonalCiphers || !this.collections().length;
  });

  /** Tooltip for the disabled Shared folders chip — see {@link favoritesDisabledTooltip}. */
  protected readonly sharedFolderDisabledTooltip = computed(() =>
    this.noSharedFolderOptions() ? this.i18nService.t("sharedFolderFilterTooltip") : "",
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
   * Whether there are any ciphers that belong to the personal vault.
   */
  private readonly hasPersonalCiphers = computed(() =>
    this.ciphers().some((cipher) => !idString(cipher.organizationId)),
  );

  /**
   * Whether the Vault chip offers "My vault".
   */
  protected readonly showMyVaultOption = computed(() => {
    const canHaveEmptyPersonalVault =
      !this.ciphers().filter((cipher) => !cipher.organizationId).length &&
      !this.scopedOrganizationId() &&
      !this.orgRequiresDataOwnership();
    return this.hasPersonalCiphers() || canHaveEmptyPersonalVault;
  });

  /**
   * Whether the Vault chip and column should be shown.
   *
   * Shown when the user's items can span more than one vault:
   * - multiple organizations are present (user can filter between them), or
   * - exactly one organization is present alongside a personal vault option
   *   (user can distinguish personal items from org-owned ones).
   */
  protected readonly showVaults = computed(() => {
    const hasMultipleVaults = this.sortedOrganizations().length > 1;
    const hasPersonalAndOrgVault =
      this.showMyVaultOption() && this.sortedOrganizations().length === 1;
    return hasMultipleVaults || hasPersonalAndOrgVault;
  });

  /**
   * The organizations the Vault chip offers. Derived from the `organizations` input
   * so the options don't change as ciphers are filtered in or out.
   */
  protected readonly sortedOrganizations = computed(() =>
    [...this.organizations()].sort((a, b) => a.name.localeCompare(b.name)),
  );

  /**
   * Whether the Shared folders chip and column should be shown.
   *
   * Driven by the organizations input rather than the cipher rows, so the chip stays
   * visible even when org-owned ciphers are filtered out.
   */
  protected readonly showSharedFolders = computed(() => this.organizations().length > 0);

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

  /** Clear the table's internal row selection (called when the batch bar "Clear" fires). */
  clearSelection(): void {
    this.tableComponent()?.selectionModel()?.clear();
  }

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
    this.scopedOrganizationId,
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
    matchesType(cipher, values.type) &&
    matchesFavorite(cipher, values.favorites) &&
    matchesVault(cipher, values.vault) &&
    matchesSharedFolder(cipher, values.sharedFolder) &&
    matchesFolder(cipher, values.folder);

  /**
   * Whether the cipher is among the active search's matches. `undefined` matches means no
   * searchable term is active, so every row passes — see {@link cipherSearchMatches}.
   */
  private matchesSearch(cipher: C): boolean {
    const matches = this.searchMatches();
    return matches === undefined || matches.has(String(cipher.id));
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
