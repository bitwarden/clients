import { Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import {
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  startWith,
  switchMap,
  tap,
} from "rxjs";

import { DynamicTreeNode } from "@bitwarden/angular/vault/vault-filter/models/dynamic-tree-node.model";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Collection } from "@bitwarden/common/vault/models/domain/collection";
import { ITreeNodeObject, TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ServiceUtils } from "@bitwarden/common/vault/service-utils";
import { ChipSelectOption } from "@bitwarden/components";

/** All available cipher filters */
export type PopupListFilter = {
  organization: Organization | null;
  collection: Collection | null;
  folder: FolderView | null;
  cipherType: CipherType | null;
};

/** Delimiter that denotes a level of nesting  */
const NESTING_DELIMITER = "/";

/** Id assigned to the "My vault" organization */
export const MY_VAULT_ID = "MyVault";

const INITIAL_FILTERS: PopupListFilter = {
  organization: null,
  collection: null,
  folder: null,
  cipherType: null,
};

@Injectable({
  providedIn: "root",
})
export class VaultPopupListFiltersService {
  /**
   * UI form for all filters
   */
  filterForm = this.formBuilder.group<PopupListFilter>(INITIAL_FILTERS);

  /**
   * Observable for `filterForm` value
   */
  filters$ = this.filterForm.valueChanges.pipe(
    startWith(INITIAL_FILTERS),
  ) as Observable<PopupListFilter>;

  /**
   * Static list of ciphers views used in synchronous context
   */
  private cipherViews: CipherView[] = [];

  /**
   * Observable of cipher views
   */
  private cipherViews$: Observable<CipherView[]> = this.cipherService.cipherViews$.pipe(
    tap((cipherViews) => {
      this.cipherViews = Object.values(cipherViews);
    }),
    map((ciphers) => Object.values(ciphers)),
  );

  constructor(
    private folderService: FolderService,
    private cipherService: CipherService,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private collectionService: CollectionService,
    private formBuilder: FormBuilder,
    private policyService: PolicyService,
  ) {
    this.filterForm.controls.organization.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(this.validateOrganizationChange.bind(this));
  }

  /**
   * Observable whose value is a function that filters an array of `CipherView` objects based on the current filters
   */
  filterFunction$: Observable<(ciphers: CipherView[]) => CipherView[]> = this.filters$.pipe(
    map(
      (filters) => (ciphers: CipherView[]) =>
        ciphers.filter((cipher) => {
          // Vault popup lists never shows deleted ciphers
          if (cipher.isDeleted) {
            return false;
          }

          if (filters.cipherType !== null && cipher.type !== filters.cipherType) {
            return false;
          }

          if (
            filters.collection !== null &&
            !cipher.collectionIds.includes(filters.collection.id)
          ) {
            return false;
          }

          if (filters.folder !== null && cipher.folderId !== filters.folder.id) {
            return false;
          }

          const isMyVault = filters.organization?.id === MY_VAULT_ID;

          if (isMyVault) {
            if (cipher.organizationId !== null) {
              return false;
            }
          } else if (filters.organization !== null) {
            if (cipher.organizationId !== filters.organization.id) {
              return false;
            }
          }

          return true;
        }),
    ),
  );

  /**
   * All available cipher types
   */
  readonly cipherTypes: ChipSelectOption<CipherType>[] = [
    {
      value: CipherType.Login,
      label: this.i18nService.t("typeLogin"),
      icon: "bwi-globe",
    },
    {
      value: CipherType.Card,
      label: this.i18nService.t("typeCard"),
      icon: "bwi-credit-card",
    },
    {
      value: CipherType.Identity,
      label: this.i18nService.t("typeIdentity"),
      icon: "bwi-id-card",
    },
    {
      value: CipherType.SecureNote,
      label: this.i18nService.t("note"),
      icon: "bwi-sticky-note",
    },
    {
      value: CipherType.SshKey,
      label: this.i18nService.t("typeSshKey"),
      icon: "bwi-key",
    },
  ];

  /** Resets `filterForm` to the original state */
  resetFilterForm(): void {
    this.filterForm.reset(INITIAL_FILTERS);
  }

  /**
   * Organization array structured to be directly passed to `ChipSelectComponent`
   */
  organizations$: Observable<ChipSelectOption<Organization>[]> = combineLatest([
    this.organizationService.memberOrganizations$,
    this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership),
  ]).pipe(
    map(([orgs, personalOwnershipApplies]): [Organization[], boolean] => [
      orgs.sort(Utils.getSortFunction(this.i18nService, "name")),
      personalOwnershipApplies,
    ]),
    map(([orgs, personalOwnershipApplies]) => {
      // When there are no organizations return an empty array,
      // resulting in the org filter being hidden
      if (!orgs.length) {
        return [];
      }

      // When there is only one organization and personal ownership policy applies,
      // return an empty array, resulting in the org filter being hidden
      if (orgs.length === 1 && personalOwnershipApplies) {
        return [];
      }

      const myVaultOrg: ChipSelectOption<Organization>[] = [];

      // Only add "My vault" if personal ownership policy does not apply
      if (!personalOwnershipApplies) {
        myVaultOrg.push({
          value: { id: MY_VAULT_ID } as Organization,
          label: this.i18nService.t("myVault"),
          icon: "bwi-user",
        });
      }

      return [
        ...myVaultOrg,
        ...orgs.map((org) => {
          let icon = "bwi-business";

          if (!org.enabled) {
            // Show a warning icon if the organization is deactivated
            icon = "bwi-exclamation-triangle tw-text-danger";
          } else if (
            org.productTierType === ProductTierType.Families ||
            org.productTierType === ProductTierType.Free
          ) {
            // Show a family icon if the organization is a family or free org
            icon = "bwi-family";
          }

          return {
            value: org,
            label: org.name,
            icon,
          };
        }),
      ];
    }),
  );

  /**
   * Folder array structured to be directly passed to `ChipSelectComponent`
   */
  folders$: Observable<ChipSelectOption<FolderView>[]> = combineLatest([
    this.filters$.pipe(
      distinctUntilChanged(
        (previousFilter, currentFilter) =>
          // Only update the collections when the organizationId filter changes
          previousFilter.organization?.id === currentFilter.organization?.id,
      ),
    ),
    this.folderService.folderViews$,
    this.cipherViews$,
  ]).pipe(
    map(([filters, folders, cipherViews]): [PopupListFilter, FolderView[], CipherView[]] => {
      if (folders.length === 1 && folders[0].id === null) {
        // Do not display folder selections when only the "no folder" option is available.
        return [filters, [], cipherViews];
      }

      // Sort folders by alphabetic name
      folders.sort(Utils.getSortFunction(this.i18nService, "name"));
      let arrangedFolders = folders;

      const noFolder = folders.find((f) => f.id === null);

      if (noFolder) {
        // Update `name` of the "no folder" option to "Items with no folder"
        noFolder.name = this.i18nService.t("itemsWithNoFolder");

        // Move the "no folder" option to the end of the list
        arrangedFolders = [...folders.filter((f) => f.id !== null), noFolder];
      }
      return [filters, arrangedFolders, cipherViews];
    }),
    map(([filters, folders, cipherViews]) => {
      const organizationId = filters.organization?.id ?? null;

      // When no org or "My vault" is selected, return all folders
      if (organizationId === null || organizationId === MY_VAULT_ID) {
        return folders;
      }

      const orgCiphers = cipherViews.filter((c) => c.organizationId === organizationId);

      // Return only the folders that have ciphers within the filtered organization
      return folders.filter((f) => orgCiphers.some((oc) => oc.folderId === f.id));
    }),
    map((folders) => {
      const nestedFolders = this.getAllFoldersNested(folders);
      return new DynamicTreeNode<FolderView>({
        fullList: folders,
        nestedList: nestedFolders,
      });
    }),
    map((folders) =>
      folders.nestedList.map((f) => this.convertToChipSelectOption(f, "bwi-folder")),
    ),
  );

  /**
   * Collection array structured to be directly passed to `ChipSelectComponent`
   */
  collections$: Observable<ChipSelectOption<CollectionView>[]> = combineLatest([
    this.filters$.pipe(
      distinctUntilChanged(
        (previousFilter, currentFilter) =>
          // Only update the collections when the organizationId filter changes
          previousFilter.organization?.id === currentFilter.organization?.id,
      ),
    ),
    this.collectionService.decryptedCollections$,
  ]).pipe(
    map(([filters, allCollections]) => {
      const organizationId = filters.organization?.id ?? null;
      // When the organization filter is selected, filter out collections that do not belong to the selected organization
      const collections =
        organizationId === null
          ? allCollections
          : allCollections.filter((c) => c.organizationId === organizationId);

      return collections;
    }),
    switchMap(async (collections) => {
      const nestedCollections = await this.collectionService.getAllNested(collections);

      return new DynamicTreeNode<CollectionView>({
        fullList: collections,
        nestedList: nestedCollections,
      });
    }),
    map((collections) =>
      collections.nestedList.map((c) => this.convertToChipSelectOption(c, "bwi-collection")),
    ),
  );

  /**
   * Converts the given item into the `ChipSelectOption` structure
   */
  private convertToChipSelectOption<T extends ITreeNodeObject>(
    item: TreeNode<T>,
    icon: string,
  ): ChipSelectOption<T> {
    return {
      value: item.node,
      label: item.node.name,
      icon,
      children: item.children
        ? item.children.map((i) => this.convertToChipSelectOption(i, icon))
        : undefined,
    };
  }

  /**
   * Returns a nested folder structure based on the input FolderView array
   */
  private getAllFoldersNested(folders: FolderView[]): TreeNode<FolderView>[] {
    const nodes: TreeNode<FolderView>[] = [];

    folders.forEach((f) => {
      const folderCopy = new FolderView();
      folderCopy.id = f.id;
      folderCopy.revisionDate = f.revisionDate;

      // Remove "/" from beginning and end of the folder name
      // then split the folder name by the delimiter
      const parts = f.name != null ? f.name.replace(/^\/+|\/+$/g, "").split(NESTING_DELIMITER) : [];
      ServiceUtils.nestedTraverse(nodes, 0, parts, folderCopy, null, NESTING_DELIMITER);
    });

    return nodes;
  }

  /**
   * Validate collection & folder filters when the organization filter changes
   */
  private validateOrganizationChange(organization: Organization | null): void {
    if (!organization) {
      return;
    }

    const currentFilters = this.filterForm.getRawValue();

    // When the organization filter changes and a collection is already selected,
    // reset the collection filter if the collection does not belong to the new organization filter
    if (currentFilters.collection && currentFilters.collection.organizationId !== organization.id) {
      this.filterForm.get("collection").setValue(null);
    }

    // When the organization filter changes and a folder is already selected,
    // reset the folder filter if the folder does not belong to the new organization filter
    if (
      currentFilters.folder &&
      currentFilters.folder.id !== null &&
      organization.id !== MY_VAULT_ID
    ) {
      // Get all ciphers that belong to the new organization
      const orgCiphers = this.cipherViews.filter((c) => c.organizationId === organization.id);

      // Find any ciphers within the organization that belong to the current folder
      const newOrgContainsFolder = orgCiphers.some(
        (oc) => oc.folderId === currentFilters.folder.id,
      );

      // If the new organization does not contain the current folder, reset the folder filter
      if (!newOrgContainsFolder) {
        this.filterForm.get("folder").setValue(null);
      }
    }
  }
}
