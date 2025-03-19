// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { CollectionAdminView, CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import {
  CipherTypeFilter,
  CollectionFilter,
  FolderFilter,
  OrganizationFilter,
} from "../../shared/models/vault-filter.type";

export abstract class VaultFilterService {
  collapsedFilterNodes$: Observable<Set<string>>;
  filteredFolders$: Observable<FolderView[]>;
  filteredCollections$: Observable<CollectionView[]>;
  organizationTree$: Observable<TreeNode<OrganizationFilter>>;
  folderTree$: Observable<TreeNode<FolderFilter>>;
  collectionTree$: Observable<TreeNode<CollectionFilter>>;
  cipherTypeTree$: Observable<TreeNode<CipherTypeFilter>>;
  getCollectionNodeFromTree: (id: string) => Promise<TreeNode<CollectionFilter>>;
  setCollapsedFilterNodes: (collapsedFilterNodes: Set<string>) => Promise<void>;
  expandOrgFilter: () => Promise<void>;
  getOrganizationFilter: () => Observable<Organization>;
  setOrganizationFilter: (organization: Organization) => void;
  buildTypeTree: (
    head: CipherTypeFilter,
    array: CipherTypeFilter[],
  ) => Observable<TreeNode<CipherTypeFilter>>;
  // TODO: Remove this from org vault when collection admin service adopts state management
  reloadCollections?: (collections: CollectionAdminView[]) => void;
  clearOrganizationFilter: () => void;
}
