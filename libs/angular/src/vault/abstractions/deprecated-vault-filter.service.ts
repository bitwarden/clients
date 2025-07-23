import { Observable } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionView } from "@bitwarden/admin-console/common";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { DynamicTreeNode } from "../vault-filter/models/dynamic-tree-node.model";

/**
 * @deprecated August 30 2022: Use new VaultFilterService with observables
 */
export abstract class DeprecatedVaultFilterService {
  abstract buildOrganizations(): Promise<Organization[]>;
  abstract buildNestedFolders(organizationId?: string): Observable<DynamicTreeNode<FolderView>>;
  abstract buildCollections(organizationId?: string): Promise<DynamicTreeNode<CollectionView>>;
  abstract buildCollapsedFilterNodes(userId: UserId): Promise<Set<string>>;
  abstract storeCollapsedFilterNodes(
    collapsedFilterNodes: Set<string>,
    userId: UserId,
  ): Promise<void>;
  abstract checkForSingleOrganizationPolicy(): Promise<boolean>;
  abstract checkForOrganizationDataOwnershipPolicy(): Promise<boolean>;
}
