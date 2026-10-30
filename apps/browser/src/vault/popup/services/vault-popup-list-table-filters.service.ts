import { computed, inject, Injectable, signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
} from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { DynamicTreeNode } from "@bitwarden/angular/vault/vault-filter/models/dynamic-tree-node.model";
import { sortDefaultCollections } from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { ITreeNodeObject, TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CIPHER_MENU_ITEMS,
  DIALOG_CIPHER_MENU_ITEMS,
} from "@bitwarden/common/vault/types/cipher-menu-items";
import { CipherViewLikeUtils } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { getNestedFolderTree } from "@bitwarden/common/vault/utils/folder-utils";
import { ChipFilterOption, getAvatarDefaultColor } from "@bitwarden/components";
import { StateProvider, UserKeyDefinition, VAULT_TABLE_FILTERS_DISK } from "@bitwarden/state";
import {
  ALL_ITEMS_SCOPE,
  idString,
  MY_VAULT,
  NO_FOLDER,
  orgIconTile,
  personalIconTile,
  scopeKey,
  type VaultScope,
} from "@bitwarden/vault";

interface CachedTableFilterState {
  organizationIds?: string[];
  collectionIds?: string[];
  folderIds?: string[];
  cipherType?: CipherType | null;
}

/**
 * Each vault's chip selection for a user, keyed by {@link scopeKey}. Stored per user so that
 * switching accounts brings back that user's filters, which the popup view cache can't do — the
 * background clears it on every account switch. Cleared only on logout.
 */
const VAULT_TABLE_FILTERS = UserKeyDefinition.record<CachedTableFilterState>(
  VAULT_TABLE_FILTERS_DISK,
  "tableFiltersByScope",
  {
    deserializer: (v) => v,
    clearOn: ["logout"],
  },
);

/** The `:vaultId` route segment of the vault a user last selected, or `null` for All items. */
const VAULT_SELECTED_SCOPE = new UserKeyDefinition<string | null>(
  VAULT_TABLE_FILTERS_DISK,
  "selectedScopeId",
  {
    deserializer: (v) => v,
    clearOn: ["logout"],
  },
);

/** Each vault's search text for a user, keyed by {@link scopeKey}. */
const VAULT_SEARCH_TEXT = UserKeyDefinition.record<string>(
  VAULT_TABLE_FILTERS_DISK,
  "searchTextByScope",
  {
    deserializer: (v) => v,
    clearOn: ["logout"],
  },
);

/**
 * Filter service for the vault popup list table (`VaultPopupListTableComponent`).
 */
@Injectable({
  providedIn: "root",
})
export class VaultPopupListTableFiltersService {
  private readonly folderService = inject(FolderService);
  private readonly cipherService = inject(CipherService);
  private readonly organizationService = inject(OrganizationService);
  private readonly i18nService = inject(I18nService);
  private readonly collectionService = inject(CollectionService);
  private readonly policyService = inject(PolicyService);
  private readonly accountService = inject(AccountService);
  private readonly viewCacheService = inject(ViewCacheService);
  private readonly restrictedItemTypesService = inject(RestrictedItemTypesService);
  private readonly configService = inject(ConfigService);
  private readonly avatarService = inject(AvatarService);
  private readonly stateProvider = inject(StateProvider);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filter((userId): userId is UserId => userId != null),
  );

  private readonly activeUserId = toSignal(this.activeUserId$);

  /**
   * The active user's stored `key`. Starts over as `null` for each user until their stored state
   * arrives, so a switch never shows the previous user's values.
   */
  private userState$<T>(key: UserKeyDefinition<T>): Observable<T | null> {
    return this.activeUserId$.pipe(
      switchMap((userId) => this.stateProvider.getUser(userId, key).state$.pipe(startWith(null))),
    );
  }

  private readonly userFilters = toSignal(
    this.userState$(VAULT_TABLE_FILTERS).pipe(map((filtersByScope) => filtersByScope ?? {})),
    { initialValue: {} as Record<string, CachedTableFilterState> },
  );

  private readonly userSearchText = toSignal(
    this.userState$(VAULT_SEARCH_TEXT).pipe(map((searchText) => searchText ?? {})),
    { initialValue: {} as Record<string, string> },
  );

  /** A search the user just typed, shown until it lands in state so the input never rewinds. */
  private readonly pendingSearchText = signal<{ key: string; text: string } | null>(null);

  /** The search text for the active user's vault in view. */
  readonly searchText = computed(() => {
    const key = this.activeScopeKey();
    const pending = this.pendingSearchText();
    return pending?.key === key ? pending.text : (this.userSearchText()[key] ?? "");
  });

  /** Sets the search text for the active user's vault in view. */
  async setSearchText(text: string): Promise<void> {
    const userId = this.activeUserId();
    if (userId == null) {
      return;
    }

    const key = this.activeScopeKey();
    const pending = { key, text };
    this.pendingSearchText.set(pending);
    try {
      await this.stateProvider
        .getUser(userId, VAULT_SEARCH_TEXT)
        .update((searchText) => ({ ...searchText, [key]: text }));
    } finally {
      if (this.pendingSearchText() === pending) {
        this.pendingSearchText.set(null);
      }
    }
  }

  /** The {@link scopeKey} of the vault in view, which every read and write below targets. */
  private readonly activeScopeKey = signal(scopeKey(ALL_ITEMS_SCOPE));

  /** The {@link scopeKey} of the vault in view, for other per-vault state such as search text. */
  readonly scopeKey = this.activeScopeKey.asReadonly();

  /** The chip selection for the active user's vault in view. */
  readonly cachedFilters = computed(() => this.userFilters()[this.activeScopeKey()] ?? {});

  /**
   * Whether the toolbar's filter dialog is open. Root-scoped because the view cache seeds from its
   * popup-open snapshot, so a recreated owner would reopen a closed dialog.
   */
  readonly filterDialogOpen = this.viewCacheService.signal<boolean>({
    key: "vault-filter-dialog-open",
    initialValue: false,
    persistNavigation: true,
  });

  /** The active user's selected vault, as its `:vaultId` route segment; `null` is All items. */
  readonly cachedVaultScopeId = toSignal(this.userState$(VAULT_SELECTED_SCOPE), {
    initialValue: null,
  });

  /** Stores the active user's selected vault. Await it before a navigation that reads it back. */
  async setCachedVaultScopeId(id: string | null): Promise<void> {
    const userId = this.activeUserId();
    if (userId != null) {
      await this.stateProvider.getUser(userId, VAULT_SELECTED_SCOPE).update(() => id);
    }
  }

  /** The active user's selected vault, once their stored state has loaded. */
  storedVaultScopeId(): Promise<string | null> {
    return firstValueFrom(
      this.activeUserId$.pipe(
        switchMap((userId) => this.stateProvider.getUser(userId, VAULT_SELECTED_SCOPE).state$),
        map((id) => id ?? null),
      ),
    );
  }

  /** Whether any chip filter is currently selected. */
  readonly hasFilterApplied = computed(() => {
    const filters = this.cachedFilters();
    return !!(
      filters.organizationIds?.length ||
      filters.collectionIds?.length ||
      filters.folderIds?.length ||
      filters.cipherType != null
    );
  });

  /** Observable mirror of {@link hasFilterApplied} for use in RxJS pipelines. */
  hasFilterApplied$ = toObservable(this.hasFilterApplied);

  /**
   * Whether every organization in `ids` is suspended, which blanks the rows rather than filtering
   * them. Takes ids because either the chip or the route scope can name them.
   */
  suspended$(ids: string[]): Observable<boolean> {
    const named = ids.filter((id) => id !== MY_VAULT);
    if (!named.length || named.length !== ids.length) {
      return of(false);
    }

    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.memberOrganizations$(userId)),
      map((orgs) => {
        const selected = orgs.filter((org) => named.includes(idString(org.id)!));
        return selected.length > 0 && selected.every((org) => !org.enabled);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /**
   * The current chip selection, in the shape the table's `filterValues` uses.
   */
  readonly selectedFilters$ = toObservable(
    computed(() => {
      const filters = this.cachedFilters();
      return {
        cipherType: filters.cipherType ?? null,
        organization: filters.organizationIds ?? [],
        collection: filters.collectionIds ?? [],
        folder: filters.folderIds ?? [],
      };
    }),
  );

  /**
   * Points the cached selection at the vault in view. Call before the table restores, so it seeds
   * from this vault's entry rather than the previous one's. A `null` scope keys as All items.
   */
  setScope(scope: VaultScope | null): void {
    this.activeScopeKey.set(scopeKey(scope ?? ALL_ITEMS_SCOPE));
  }

  private fullCipherListViews$ = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.cipherService.cipherListViews$(userId).pipe(
        filter((ciphers) => ciphers != null),
        map((ciphers) =>
          ciphers.filter(
            (cipher) =>
              !CipherViewLikeUtils.isDeleted(cipher) && !CipherViewLikeUtils.isArchived(cipher),
          ),
        ),
      ),
    ),
  );

  /**
   * Persists the current chip selection to the active user's state, under the vault in view.
   * Call this whenever the table's `filterValues` signal emits a new value.
   */
  saveFilters(values: {
    cipherType?: CipherType | null;
    organization?: string[];
    collection?: string[];
    folder?: string[];
  }): void {
    const userId = this.activeUserId();
    if (userId == null) {
      return;
    }

    // Both resolved now rather than in the update, which lands after a later switch could move them.
    const key = this.activeScopeKey();
    void this.stateProvider.getUser(userId, VAULT_TABLE_FILTERS).update((filtersByScope) => ({
      ...filtersByScope,
      [key]: {
        organizationIds: values.organization ?? [],
        collectionIds: values.collection ?? [],
        folderIds: values.folder ?? [],
        cipherType: values.cipherType ?? null,
      },
    }));
  }

  /**
   * Resolves the vault in view's cached filter state back to chip-selectable ids, emitting once.
   *
   * Call this after the table's filter chips are registered to seed them from the
   * previously-persisted state. The observable takes the first emission of
   * `organizations$`, `collections$`, and the active user's folder views, drops any cached id
   * that no longer names a real option (e.g. a deleted folder), and completes.
   */
  restoreFilters$(): Observable<{
    cipherType?: CipherType | null;
    organization?: string[];
    collection?: string[];
    folder?: string[];
  }> {
    return combineLatest([
      this.organizations$,
      this.collections$,
      this.activeUserId$.pipe(switchMap((userId) => this.folderService.folderViews$(userId))),
      // Not `userState$`, which starts empty: the first emission here is the stored state.
      this.activeUserId$.pipe(
        switchMap((userId) => this.stateProvider.getUser(userId, VAULT_TABLE_FILTERS).state$),
      ),
    ]).pipe(
      take(1),
      map(([orgOptions, collectionOptions, folderViews, filtersByScope]) => {
        const state = filtersByScope?.[this.activeScopeKey()] ?? {};
        const result: {
          cipherType?: CipherType | null;
          organization?: string[];
          collection?: string[];
          folder?: string[];
        } = {};

        if (state.organizationIds?.length) {
          const validIds = new Set(orgOptions.map((o) => idString(o.value?.id)));
          const organization = state.organizationIds.filter((id) => validIds.has(id));
          if (organization.length) {
            result.organization = organization;
          }
        }

        if (state.collectionIds?.length) {
          const flatCollections = collectionOptions.flatMap((c) => this.flattenOptions(c));
          const validIds = new Set(flatCollections.map((c) => idString(c.value?.id)));
          const collection = state.collectionIds.filter((id) => validIds.has(id));
          if (collection.length) {
            result.collection = collection;
          }
        }

        if (state.folderIds?.length) {
          const validIds = new Set(folderViews.map((f) => f.id || NO_FOLDER));
          const folder = state.folderIds.filter((id) => validIds.has(id));
          if (folder.length) {
            result.folder = folder;
          }
        }

        if (state.cipherType != null) {
          result.cipherType = state.cipherType;
        }

        return result;
      }),
    );
  }

  /**
   * Available cipher types, filtered by vault presence, policy restrictions, and feature flags.
   * Only types that exist in the vault are shown.
   */
  readonly cipherTypes$: Observable<ChipFilterOption<CipherType>[]> = combineLatest([
    this.restrictedItemTypesService.restricted$,
    this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
    this.fullCipherListViews$,
  ]).pipe(
    map(([restrictedTypes, allowNewItemTypes, ciphers]) => {
      const presentTypes = new Set((ciphers ?? []).map((c) => CipherViewLikeUtils.getType(c)));
      const cipherMenuItems = allowNewItemTypes ? DIALOG_CIPHER_MENU_ITEMS : CIPHER_MENU_ITEMS;
      return cipherMenuItems
        .filter((item) => {
          if (!presentTypes.has(item.type)) {
            return false;
          }
          const restriction = restrictedTypes.find((r) => r.cipherType === item.type);
          return !restriction || restriction.allowViewOrgIds.length > 0;
        })
        .map((item) => ({
          value: item.type,
          label: this.i18nService.t(item.labelKey),
        }));
    }),
  );

  /** The active user's avatar color, so the "My vault" filter tile matches their avatar. */
  private readonly userAvatarColor$ = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      account
        ? this.avatarService
            .getUserAvatarColor$(account.id)
            .pipe(map((color) => color ?? getAvatarDefaultColor(account.id, account.name)))
        : of(undefined),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * Organization names by id, for every organization the user is a member of.
   *
   * Kept separate from {@link organizations$}, which drops suspended organizations so they aren't
   * offered as a filter option. Collections owned by a suspended organization are still listed, so
   * name resolution has to read the unfiltered membership or those collections lose their label.
   */
  organizationNames$: Observable<Map<string, string>> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.organizationService.memberOrganizations$(userId)),
    map((orgs) => new Map(orgs.map((org) => [idString(org.id)!, org.name]))),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * Organizations, structured for `bit-filter-menu`.
   */
  organizations$: Observable<ChipFilterOption<Organization>[]> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        combineLatest([
          this.organizationService.memberOrganizations$(userId),
          this.policyService.policyAppliesToUser$(PolicyType.OrganizationDataOwnership, userId),
          this.userAvatarColor$,
        ]),
      ),
      map(
        ([orgs, organizationDataOwnership, avatarColor]): [
          Organization[],
          boolean,
          string | undefined,
        ] => [
          orgs.filter((org) => org.enabled).sort(Utils.getSortFunction(this.i18nService, "name")),
          organizationDataOwnership,
          avatarColor,
        ],
      ),
      map(([orgs, organizationDataOwnership, avatarColor]) => {
        if (!orgs.length) {
          return [];
        }
        if (orgs.length === 1 && organizationDataOwnership) {
          return [];
        }

        const myVaultOrg: ChipFilterOption<Organization>[] = organizationDataOwnership
          ? []
          : [
              {
                value: { id: MY_VAULT } as Organization,
                label: this.i18nService.t("myVault"),
                iconTile: personalIconTile(avatarColor ?? "brand"),
              },
            ];

        return [
          ...myVaultOrg,
          ...orgs.map((org) => ({
            value: org,
            label: org.name,
            iconTile: orgIconTile(org.productTierType),
          })),
        ];
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  /**
   * Folders, structured for `bit-filter-menu`.
   */
  folders$: Observable<ChipFilterOption<FolderView>[]> = this.activeUserId$.pipe(
    switchMap((userId) =>
      this.folderService.folderViews$(userId).pipe(
        map((folders) => (folders.length === 1 && !folders[0].id ? ([] as FolderView[]) : folders)),
        map((folders) => {
          const nested = getNestedFolderTree(folders, this.i18nService);
          return new DynamicTreeNode<FolderView>({ fullList: folders, nestedList: nested });
        }),
        map((node) => node.nestedList.map((f) => this.convertToChipFilterOption(f))),
      ),
    ),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * Collections, structured for `bit-filter-menu`.
   */
  collections$: Observable<ChipFilterOption<CollectionView>[]> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        combineLatest([
          this.collectionService.decryptedCollections$(userId),
          this.organizationService.memberOrganizations$(userId),
        ]),
      ),
      map(([allCollections, orgs]) =>
        sortDefaultCollections(allCollections, orgs, this.i18nService.collator),
      ),
      map(
        (fullList) =>
          new DynamicTreeNode<CollectionView>({
            fullList,
            nestedList: this.collectionService.getAllNested(fullList),
          }),
      ),
      map((tree) => tree.nestedList.map((c) => this.convertToChipFilterOption(c))),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  private flattenOptions<T>(option: ChipFilterOption<T>): ChipFilterOption<T>[] {
    return [option, ...(option.children?.flatMap((c) => this.flattenOptions(c)) ?? [])];
  }

  private convertToChipFilterOption<T extends ITreeNodeObject>(
    item: TreeNode<T>,
  ): ChipFilterOption<T> {
    return {
      value: item.node,
      label: item.node.name,
      children: item.children?.map((i) => this.convertToChipFilterOption(i)),
    };
  }
}
