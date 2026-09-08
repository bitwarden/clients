// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { distinctUntilChanged, filter, map, skip, Subject } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { DeactivatedOrg, NoResults } from "@bitwarden/assets/svg";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitRowGroupComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ChipActionComponent,
  ChipFilterOption,
  CompactModeService,
  defineTable,
  FilterMenuModule,
  IconButtonModule,
  IconComponent,
  SearchModule,
  StatusLockupComponent,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
import {
  matchesFolder,
  matchesSharedFolder,
  matchesType,
  matchesVault,
  MY_VAULT,
  NO_FOLDER,
  OrgIconDirective,
  Vfo1I18nPipe,
} from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../platform/browser/browser-popup-utils";
import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultPopupListTableFiltersService } from "../../../services/vault-popup-list-table-filters.service";
import {
  VaultPopupListTableService,
  VaultTableRow,
} from "../../../services/vault-popup-list-table.service";
import { VaultPopupLoadingService } from "../../../services/vault-popup-loading.service";
import { VaultPopupSectionService } from "../../../services/vault-popup-section.service";
import { PopupCipherViewLike } from "../../../views/popup-cipher.view";
import { ItemCopyActionsComponent } from "../item-copy-action/item-copy-actions.component";
import { ItemMoreOptionsComponent } from "../item-more-options/item-more-options.component";

/**
 * Flattens a nested `ChipFilterOption` tree into a single depth-first list. Interim:
 * `bit-filter-option` has no depth or children concept, so a flat list is the only shape the menu
 * renders today. Drop this once the recursive nesting in CL-985 lands.
 */
function flattenOptions<T>(options: ChipFilterOption<T>[]): ChipFilterOption<T>[] {
  return options.flatMap((option) => [option, ...flattenOptions(option.children ?? [])]);
}

@Component({
  selector: "app-vault-popup-list-table",
  templateUrl: "vault-popup-list-table.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Forward height through to the `height="fill"` table so it can size to a bounded parent
    // (e.g. the popup-page scroll area). Without this the host collapses to 0 and no rows show.
    // The negative margins cancel `popup-page`'s scroll-region padding so the toolbar's bottom
    // border reaches the popup edges.
    class:
      "tw-flex tw-flex-col tw-flex-1 tw-min-h-0 -tw-mx-3 -tw-mt-3 -tw-mb-2.5 bit-compact:-tw-mx-2 bit-compact:-tw-mt-2 bit-compact:-tw-mb-1.5",
  },
  imports: [
    CommonModule,
    FormsModule,
    JslibModule,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitRowGroupComponent,
    BitTableToolbarComponent,
    FilterMenuModule,
    IconButtonModule,
    IconComponent,
    SearchModule,
    StatusLockupComponent,
    SvgComponent,
    TypographyModule,
    ChipActionComponent,
    ItemCopyActionsComponent,
    ItemMoreOptionsComponent,
    OrgIconDirective,
    Vfo1I18nPipe,
  ],
})
export class VaultPopupListTableComponent {
  private readonly vaultPopupLoadingService = inject(VaultPopupLoadingService);
  private readonly vaultPopupAutofillService = inject(VaultPopupAutofillService);
  private readonly vaultPopupSectionService = inject(VaultPopupSectionService);
  private readonly compactModeService = inject(CompactModeService);
  private readonly listTableService = inject(VaultPopupListTableService);
  private readonly listFiltersService = inject(VaultPopupListTableFiltersService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18nService = inject(I18nService);
  private readonly window = inject<Window>(WINDOW);

  /** The projected `bit-table-v2`, used to seed and observe chip selections. */
  private readonly tableEl = viewChild(BitTableV2Component);

  protected readonly CipherViewLikeUtils = CipherViewLikeUtils;

  protected readonly noResultsIcon = NoResults;
  protected readonly deactivatedIcon = DeactivatedOrg;

  protected searchText: string = "";
  private readonly searchText$ = new Subject<string>();

  protected readonly loading = toSignal(this.vaultPopupLoadingService.loading$, {
    initialValue: true,
  });

  protected readonly hasSearchText = toSignal(this.listTableService.hasSearchText$, {
    initialValue: false,
  });

  /** The selected organizations, kept in sync with the org chip selection. */
  private readonly selectedOrgs = signal<Organization[]>([]);

  /**
   * Whether the organization filter points at a suspended organization. The table stays mounted in
   * this state so the filter that caused it remains clearable — unmounting would strip the chips
   * and the search box along with it.
   */
  protected readonly showDeactivatedOrg = computed(() => {
    const orgs = this.selectedOrgs().filter((o) => o.id !== MY_VAULT);
    return (
      orgs.length > 0 && orgs.length === this.selectedOrgs().length && orgs.every((o) => !o.enabled)
    );
  });

  private readonly allRows = toSignal(this.listTableService.rows$, {
    initialValue: [] as VaultTableRow[],
  });

  /**
   * A suspended organization's ciphers still match its own filter, so they're withheld here rather
   * than upstream. Emptying the rows also hands the state to the table's empty slot.
   */
  protected readonly rows = computed(() => (this.showDeactivatedOrg() ? [] : this.allRows()));

  protected readonly table = defineTable<VaultTableRow, "name">(this.rows);

  /**
   * Row-level filter predicate passed to `bit-table-v2 [filter]`. The chip selections are ids
   * (organization/collection/folder ids, plus the {@link MY_VAULT}/{@link NO_FOLDER} sentinels)
   * rather than full objects — see {@link organizationOptions} for why.
   */
  protected readonly filterPredicate = (
    row: VaultTableRow,
    values: {
      cipherType?: CipherType | null;
      organization?: string[];
      collection?: string[];
      folder?: string[];
    },
  ): boolean =>
    matchesType(row.cipher, values.cipherType) &&
    matchesVault(row.cipher, values.organization) &&
    matchesSharedFolder(row.cipher, values.collection) &&
    matchesFolder(row.cipher, values.folder);

  /**
   * One row per unique cipher, for filter-chip counts. {@link rows} intentionally contains up to
   * three entries per cipher (autofill/favorites/allItems sections) so each section renders its
   * own copy — counting off it directly would triple-count a cipher that's both a favorite and an
   * autofill suggestion. The "allItems" section always contains the complete, once-each list of
   * currently matching ciphers (it's the only section rendered at all when a search is active), so
   * it doubles as the deduplicated set.
   */
  protected readonly uniqueRows = computed(() =>
    this.rows().filter((row) => row._section === "allItems"),
  );

  /**
   * Count of unique ciphers matching the current chip selection with `key` pinned to `value`.
   * Bound as each `bit-filter-option`'s `[count]`, overriding `bit-table-v2`'s default count
   * (which counts off the triplicated {@link rows} instead of {@link uniqueRows}).
   */
  protected optionCount = (key: string, value: unknown): number => {
    const values = { ...(this.tableEl()?.filterValues() as any), [key]: value };
    return this.uniqueRows().filter((row) => this.filterPredicate(row, values)).length;
  };

  /**
   * The filter options. Each stream empties when its filter doesn't apply (no orgs, or
   * folders/collections narrowed away by the selected organization), which hides that chip.
   *
   * These carry the full domain object (label, icon, `organizationId`, …) for rendering, but the
   * template binds `bit-filter-option [value]` to the id, not the option itself: `folders$` and
   * `collections$` rebuild `FolderView`/`CollectionView` instances on every emission (they
   * `combineLatest` on {@link VaultPopupListTableFiltersService.selectedOrganizations}, which
   * churns on unrelated chip changes — see `saveFilters`), and `FilterMenuComponent` tracks
   * selection by `===` identity. Binding the object would desync the checkmark from the selection
   * the moment either stream re-emitted a fresh copy. Ids are stable across re-emissions.
   */
  protected readonly cipherTypeOptions = toSignal(this.listFiltersService.cipherTypes$, {
    initialValue: [] as ChipFilterOption<CipherType>[],
  });

  /**
   * Cached filter state to seed the table's chips on load.
   */
  protected readonly filtersToRestore = toSignal(this.listFiltersService.restoreFilters$());

  protected readonly organizationOptions = toSignal(this.listFiltersService.organizations$, {
    initialValue: [] as ChipFilterOption<Organization>[],
  });

  /**
   * Organization names by id, including suspended organizations. {@link organizationOptions} omits
   * those, so it can't label their collections — see {@link collectionsByOrg}.
   */
  private readonly organizationNames = toSignal(this.listFiltersService.organizationNames$, {
    initialValue: new Map<string, string>(),
  });

  private readonly collectionTree = toSignal(this.listFiltersService.collections$, {
    initialValue: [] as ChipFilterOption<CollectionView>[],
  });

  private readonly folderTree = toSignal(this.listFiltersService.folders$, {
    initialValue: [] as ChipFilterOption<FolderView>[],
  });

  /**
   * Collections and folders arrive as nested trees, flattened to one option per node. Each node
   * keeps the trailing path segment the tree gave it, so a child of "Work" shows as "EU" — meaning
   * options are tracked by id, since "Work/Personal" and "Home/Personal" flatten to one label.
   */
  protected readonly collectionOptions = computed(() => flattenOptions(this.collectionTree()));
  protected readonly folderOptions = computed(() => flattenOptions(this.folderTree()));

  /** Exposed for the folder chip's `[value]`, which falls back to this sentinel for "no folder". */
  protected readonly NO_FOLDER = NO_FOLDER;

  /** True when collections span more than one organization — switches to org-sectioned layout. */
  protected readonly groupCollectionsByOrg = computed(() => {
    const orgIds = new Set(
      this.collectionOptions()
        .map((o) => o.value?.organizationId)
        .filter(Boolean),
    );
    return orgIds.size > 1;
  });

  /**
   * Collections grouped by owning org, each group sorted alphabetically (the service pre-sorts),
   * with groups themselves sorted by organization name. A collection whose organization isn't in
   * {@link organizationNames} falls back to the localized "organization" label.
   */
  protected readonly collectionsByOrg = computed(() => {
    const groups = new Map<
      string,
      { id: string; name: string; collections: ChipFilterOption<CollectionView>[] }
    >();
    for (const option of this.collectionOptions()) {
      const orgId = option.value?.organizationId as string | undefined;

      if (!orgId) {
        continue;
      }

      if (!groups.has(orgId)) {
        const orgName = this.organizationNames().get(orgId) ?? this.i18nService.t("organization");
        groups.set(orgId, { id: orgId, name: orgName, collections: [] });
      }
      groups.get(orgId)!.collections.push(option);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly itemHeight = toSignal(
    this.compactModeService.enabled$.pipe(map((enabled) => (enabled ? 53 : 59))),
    { initialValue: 59 },
  );

  protected readonly currentUriIsBlocked = toSignal(
    this.vaultPopupAutofillService.currentTabIsOnBlocklist$,
  );

  /** Whether the popup is rendered in the sidebar, where the autofill refresh control is offered. */
  protected readonly showRefresh = BrowserPopupUtils.inSidebar(this.window);

  /** Keyboard-shortcut tooltip shown on the legacy (flag-off) autofill chip, e.g. "Autofill ⌘⇧L". */
  protected readonly autofillShortcutTooltip = signal<string | undefined>(undefined);

  /** The all-items section heading, which becomes "Search results" while a search is active. */
  protected readonly allItemsSectionKey = computed(() =>
    this.hasSearchText() ? "searchResults" : "allItems",
  );

  /** The autofill section heading, which becomes "Suggested items" when the current URI is blocked. */
  protected readonly autofillSectionKey = computed(() =>
    this.currentUriIsBlocked() ? "itemSuggestions" : "autofillSuggestions",
  );

  protected readonly favoritesOpenState = computed(
    () => this.vaultPopupSectionService.getOpenDisplayStateForSection("favorites")() ?? true,
  );

  protected readonly allItemsOpenState = computed(
    () => this.vaultPopupSectionService.getOpenDisplayStateForSection("allItems")() ?? true,
  );

  /** Persist a section's open/closed state when the user toggles its collapsible header. */
  protected setSectionCollapsed(section: "favorites" | "allItems", collapsed: boolean) {
    return this.vaultPopupSectionService.updateSectionOpenStoredState(section, !collapsed);
  }

  /**
   * Stable row identity for the table. The section prefix matters: the same cipher can appear in
   * both the autofill/favorites sections and all-items, so a bare `cipher.id` would collide.
   */
  protected readonly trackRow = (_: number, row: VaultTableRow) =>
    `${row._section}:${row.cipher.id}`;

  protected readonly isAutofill = (row: VaultTableRow) => row._section === "autofill";
  protected readonly isFavorites = (row: VaultTableRow) => row._section === "favorites";
  protected readonly isAllItems = (row: VaultTableRow) => row._section === "allItems";

  protected readonly isCard = (row: VaultTableRow) =>
    CipherViewLikeUtils.getType(row.cipher) === CipherType.Card;
  protected readonly isIdentity = (row: VaultTableRow) =>
    CipherViewLikeUtils.getType(row.cipher) === CipherType.Identity;

  constructor() {
    // Keep the input in sync with the search text already applied to the vault (e.g. restored state).
    this.listTableService.searchText$
      .pipe(
        takeUntilDestroyed(),
        filter((text) => !!text),
      )
      .subscribe((text) => (this.searchText = text));

    // Debounced apply lives in the service; the component just feeds it and owns the subscription.
    this.listTableService
      .applyFilterOnInput(this.searchText$)
      .pipe(takeUntilDestroyed())
      .subscribe();

    // Announce when all selected organizations become deactivated.
    toObservable(this.showDeactivatedOrg)
      .pipe(takeUntilDestroyed(), distinctUntilChanged(), skip(1), filter(Boolean))
      .subscribe(() => {
        void this.liveAnnouncer.announce(
          `${this.i18nService.t("organizationIsDeactivated")} ${this.i18nService.t("contactYourOrgAdmin")}`,
          "polite",
        );
      });

    // Resolve the keyboard-shortcut tooltip for the legacy (flag-off) autofill chip.
    void this.setAutofillShortcutTooltip();

    // Wire up persistence after the first render so we can access the table reference.
    afterNextRender(() => {
      const table = this.tableEl();
      if (!table) {
        return;
      }

      // Persist cache and update service state whenever chip selections change.
      toObservable(table.filterValues, { injector: this.injector })
        .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
        .subscribe((values: any) => {
          this.listFiltersService.saveFilters(values);
          const orgIds: string[] = values.organization ?? [];
          const orgs = orgIds
            .map((id) => this.organizationOptions().find((o) => o.value?.id === id)?.value)
            .filter((o): o is Organization => o != null);
          this.selectedOrgs.set(orgs);
          this.validateOrgChips(table, values);
        });
    });
  }

  private async setAutofillShortcutTooltip() {
    const shortcut = await this.platformUtilsService.getAutofillKeyboardShortcut();
    this.autofillShortcutTooltip.set(
      shortcut === "" ? undefined : `${this.i18nService.t("autofillVerb")} ${shortcut}`,
    );
  }

  onSearchTextChanged() {
    this.searchText$.next(this.searchText);
  }

  /**
   * Primary click action for a row: autofill for autofill-section rows, otherwise navigate to view.
   */
  onCipherSelect(row: VaultTableRow) {
    return row.actions.primaryAutofill
      ? this.listTableService.doAutofill(row.cipher)
      : this.listTableService.viewCipher(row.cipher);
  }

  launchCipher(cipher: CipherViewLike) {
    return this.listTableService.launchCipher(cipher);
  }

  doAutofill(cipher: PopupCipherViewLike) {
    return this.listTableService.doAutofill(cipher);
  }

  /** Refreshes the current tab so the autofill suggestions repopulate. */
  refreshCurrentTab() {
    return this.listTableService.refreshCurrentTab();
  }

  orgIconTooltip({ collectionIds, collections }: PopupCipherViewLike) {
    if (collectionIds.length > 1 || !collections) {
      return this.i18nService.t("nSharedFolders", collectionIds.length);
    }
    return collections[0]?.name;
  }

  /**
   * Clears collection chip selections that are no longer valid for the newly-selected
   * organizations. Called whenever the org chip changes.
   */
  private validateOrgChips(
    table: BitTableV2Component<any, any, any>,
    values: { organization?: string[]; collection?: string[] },
  ): void {
    const selectedOrgIds = (values.organization ?? []).filter((id) => id !== MY_VAULT);

    if (!selectedOrgIds.length) {
      return;
    }

    const currentCollectionIds = values.collection ?? [];
    if (!currentCollectionIds.length) {
      return;
    }

    const collectionOrgById = new Map<string | undefined, string | undefined>(
      this.collectionOptions().map((o) => [o.value?.id, o.value?.organizationId]),
    );

    const validCollectionIds = currentCollectionIds.filter((id) => {
      const organizationId = collectionOrgById.get(id);
      return organizationId != null && selectedOrgIds.includes(organizationId);
    });

    if (validCollectionIds.length !== currentCollectionIds.length) {
      table
        .filterControls()
        .find((c) => c.key() === "collection")
        ?.setValue(validCollectionIds.length ? validCollectionIds : undefined);
    }
  }
}
