import { Observable } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionView } from "@bitwarden/common/src/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/src/vault/models/view/folder.view";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

import { CollectionAdminView } from "../../../../core/views/collection-admin.view";
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
}
