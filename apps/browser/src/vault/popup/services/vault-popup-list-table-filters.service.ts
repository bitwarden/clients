import { computed, inject, Injectable, signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { combineLatest, filter, map, Observable, shareReplay, switchMap, take } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { DynamicTreeNode } from "@bitwarden/angular/vault/vault-filter/models/dynamic-tree-node.model";
import { sortDefaultCollections } from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import {
  CollectionView,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
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
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import {
  CIPHER_MENU_ITEMS,
  DIALOG_CIPHER_MENU_ITEMS,
} from "@bitwarden/common/vault/types/cipher-menu-items";
import { BitwardenIcon, ChipFilterOption } from "@bitwarden/components";
import { idString, MY_VAULT, NO_FOLDER } from "@bitwarden/vault";

import { PopupCipherViewLike } from "../views/popup-cipher.view";

/** Nesting delimiter for folder path segments. */
const NESTING_DELIMITER = "/";

/** Persisted filter state for the view cache. */
interface CachedTableFilterState {
  organizationIds?: string[];
  collectionIds?: string[];
  /** Folder ids; {@link NO_FOLDER} marks the "no folder" selection. */
  folderIds?: string[];
  cipherType?: CipherType | null;
}

/**
 * Filter service for the vault popup list table (`VaultPopupListTableComponent`).
 *
 * Provides filter chip option streams, per-option item counts, cache persistence,
 * and cache restore. The table component owns its chip selections via `BitTableV2Component`;
 * this service supplies the option data and saves/restores state from the view cache.
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

  /**
   * Ids of the currently-selected organizations (plus {@link MY_VAULT}); drives {@link folders$}
   * and {@link collections$} narrowing. Update this whenever the organization chip selection
   * changes.
   */
  readonly selectedOrganizations = signal<string[]>([]);

  /** Observable mirror of {@link selectedOrganizations} for use in RxJS pipelines. */
  private readonly selectedOrganizations$ = toObservable(this.selectedOrganizations);

  private readonly activeUserId$ = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filter((userId): userId is UserId => userId !== null),
  );

  private readonly cachedFilters = this.viewCacheService.signal<CachedTableFilterState>({
    key: "vault-table-filters",
    initialValue: {},
    deserializer: (v) => v,
    persistNavigation: true,
  });

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
   * Persists the current chip selection to the view cache.
   * Call this whenever the table's `filterValues` signal emits a new value.
   *
   * Also keeps {@link selectedOrganizations} in sync: this service is `providedIn: "root"` and
   * outlives any one component instance, so every call site that changes the org selection
   * (including clearing it) must go through here rather than setting the signal separately.
   */
  saveFilters(values: {
    cipherType?: CipherType | null;
    organization?: string[];
    collection?: string[];
    folder?: string[];
  }): void {
    this.cachedFilters.set({
      organizationIds: values.organization ?? [],
      collectionIds: values.collection ?? [],
      folderIds: values.folder ?? [],
      cipherType: values.cipherType ?? null,
    });
    this.selectedOrganizations.set(values.organization ?? []);
  }

  /**
   * Resolves the cached filter state back to chip-selectable ids, emitting once.
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
    const state = this.cachedFilters();
    return combineLatest([
      this.organizations$,
      this.collections$,
      this.activeUserId$.pipe(switchMap((userId) => this.folderService.folderViews$(userId))),
    ]).pipe(
      take(1),
      map(([orgOptions, collectionOptions, folderViews]) => {
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
          const validIds = new Set(folderViews.map((f) => f.id ?? NO_FOLDER));
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
   * Available cipher types, filtered by policy restrictions and feature flags.
   */
  readonly cipherTypes$: Observable<ChipFilterOption<CipherType>[]> = combineLatest([
    this.restrictedItemTypesService.restricted$,
    this.configService.getFeatureFlag$(FeatureFlag.PM32009NewItemTypes),
  ]).pipe(
    map(([restrictedTypes, allowNewItemTypes]) => {
      const cipherMenuItems = allowNewItemTypes ? DIALOG_CIPHER_MENU_ITEMS : CIPHER_MENU_ITEMS;
      return cipherMenuItems
        .filter((item) => {
          const restriction = restrictedTypes.find((r) => r.cipherType === item.type);
          return !restriction || restriction.allowViewOrgIds.length > 0;
        })
        .map((item) => ({
          value: item.type,
          label: this.i18nService.t(item.labelKey),
          icon: item.icon as BitwardenIcon,
        }));
    }),
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
        ]),
      ),
      map(([orgs, organizationDataOwnership]): [Organization[], boolean] => [
        orgs.sort(Utils.getSortFunction(this.i18nService, "name")),
        organizationDataOwnership,
      ]),
      map(([orgs, organizationDataOwnership]) => {
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
                icon: "bwi-user",
              },
            ];

        return [
          ...myVaultOrg,
          ...orgs.map((org) => {
            let icon: BitwardenIcon = "bwi-business";
            let iconClass: string | undefined = undefined;

            if (!org.enabled) {
              icon = "bwi-exclamation-triangle";
              iconClass = "tw-text-danger";
            } else if (
              org.productTierType === ProductTierType.Families ||
              org.productTierType === ProductTierType.Free
            ) {
              icon = "bwi-family";
            }

            return { value: org, label: org.name, icon, iconClass };
          }),
        ];
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );

  /**
   * Folders, structured for `bit-filter-menu`.
   * Narrows to folders that have ciphers in the selected organization(s) when an org
   * filter is active.
   */
  folders$: Observable<ChipFilterOption<FolderView>[]> = this.activeUserId$.pipe(
    switchMap((userId) => {
      const cipherViews$ = this.cipherService
        .cipherListViews$(userId)
        .pipe(map((ciphers) => (ciphers ? (Object.values(ciphers) as PopupCipherViewLike[]) : [])));

      return combineLatest([
        this.selectedOrganizations$,
        this.folderService.folderViews$(userId),
        cipherViews$,
      ]).pipe(
        map(([selectedOrgs, folders, cipherViews]) => {
          if (folders.length === 1 && !folders[0].id) {
            return [selectedOrgs, [] as FolderView[], cipherViews] as const;
          }

          folders.sort(Utils.getSortFunction(this.i18nService, "name"));
          let arrangedFolders = folders;
          const noFolder = folders.find((f) => !f.id);

          if (noFolder) {
            const updatedNoFolder = { ...noFolder, name: this.i18nService.t("itemsWithNoFolder") };
            arrangedFolders = [...folders.filter((f) => f.id), updatedNoFolder];
          }

          return [selectedOrgs, arrangedFolders, cipherViews] as const;
        }),
        map(([selectedOrgs, folders, cipherViews]) => {
          const selectedOrgIds = selectedOrgs.filter((id) => id !== MY_VAULT);

          // No org filter active — show all folders.
          if (!selectedOrgIds.length) {
            return folders;
          }

          const orgCiphers = cipherViews.filter(
            (c) => c.organizationId != null && selectedOrgIds.includes(idString(c.organizationId)!),
          );

          return folders.filter((f) => {
            if (!f.id) {
              return orgCiphers.some((oc) => !oc.folderId);
            }
            return orgCiphers.some((oc) => idString(oc.folderId) === f.id);
          });
        }),
        map((folders) => {
          const nested = this.getAllFoldersNested(folders);
          return new DynamicTreeNode<FolderView>({ fullList: folders, nestedList: nested });
        }),
        map((node) => node.nestedList.map((f) => this.convertToChipFilterOption(f, "bwi-folder"))),
      );
    }),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * Collections, structured for `bit-filter-menu`.
   * Narrows to collections in the selected organization(s) when an org filter is active.
   */
  collections$: Observable<ChipFilterOption<CollectionView>[]> =
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        combineLatest([
          this.selectedOrganizations$,
          this.collectionService.decryptedCollections$(userId),
          this.organizationService.memberOrganizations$(userId),
        ]),
      ),
      map(([selectedOrgs, allCollections, orgs]) => {
        const selectedOrgIds = selectedOrgs.filter((id) => id !== MY_VAULT);

        const filtered = selectedOrgIds.length
          ? allCollections.filter(
              (c) =>
                c.organizationId != null && selectedOrgIds.includes(idString(c.organizationId)!),
            )
          : allCollections;

        return sortDefaultCollections(filtered, orgs, this.i18nService.collator);
      }),
      map(
        (fullList) =>
          new DynamicTreeNode<CollectionView>({
            fullList,
            nestedList: this.collectionService.getAllNested(fullList),
          }),
      ),
      map((tree) =>
        tree.nestedList.map((c) =>
          this.convertToChipFilterOption(
            c,
            c.node.type === CollectionTypes.DefaultUserCollection
              ? "bwi-user"
              : "bwi-shared-folder",
          ),
        ),
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  private flattenOptions<T>(option: ChipFilterOption<T>): ChipFilterOption<T>[] {
    return [option, ...(option.children?.flatMap((c) => this.flattenOptions(c)) ?? [])];
  }

  private convertToChipFilterOption<T extends ITreeNodeObject>(
    item: TreeNode<T>,
    icon: BitwardenIcon,
  ): ChipFilterOption<T> {
    return {
      value: item.node,
      label: item.node.name,
      icon,
      children: item.children?.map((i) => this.convertToChipFilterOption(i, icon)),
    };
  }

  private getAllFoldersNested(folders: FolderView[]): TreeNode<FolderView>[] {
    const nodes: TreeNode<FolderView>[] = [];
    folders.forEach((f) => {
      const folderCopy = new FolderView();
      folderCopy.id = f.id;
      folderCopy.revisionDate = f.revisionDate;
      const parts = f.name != null ? f.name.replace(/^\/+|\/+$/g, "").split(NESTING_DELIMITER) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, folderCopy, undefined, NESTING_DELIMITER);
    });
    return nodes;
  }
}
