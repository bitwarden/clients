import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionAccessDetailsResponse } from "@bitwarden/common/src/vault/models/response/collection.response";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";

import { CollectionAccessSelectionView } from "../../../admin-console/organizations/core/views/collection-access-selection.view";
import { Unassigned } from "../../individual-vault/vault-filter/shared/models/routed-vault-filter.model";

export class CollectionAdminView extends CollectionView {
  groups: CollectionAccessSelectionView[] = [];
  users: CollectionAccessSelectionView[] = [];

  /**
   * Flag indicating the collection has no active user or group assigned to it with CanManage permissions
   * In this case, the collection can be managed by admins/owners or custom users with appropriate permissions
   */
  unmanaged: boolean;

  /**
   * Flag indicating the user has been explicitly assigned to this Collection
   */
  assigned: boolean;

  constructor(response?: CollectionAccessDetailsResponse) {
    super(response);

    if (!response) {
      return;
    }

    this.groups = response.groups
      ? response.groups.map((g) => new CollectionAccessSelectionView(g))
      : [];

    this.users = response.users
      ? response.users.map((g) => new CollectionAccessSelectionView(g))
      : [];

    this.assigned = response.assigned;
  }

  /**
   * Returns true if the user can edit a collection (including user and group access) from the Admin Console.
   */
  override canEdit(org: Organization): boolean {
    return (
      org?.canEditAnyCollection ||
      (this.unmanaged && org?.canEditUnmanagedCollections) ||
      super.canEdit(org)
    );
  }

  /**
   * Returns true if the user can delete a collection from the Admin Console.
   */
  override canDelete(org: Organization): boolean {
    return org?.canDeleteAnyCollection || super.canDelete(org);
  }

  /**
   * Whether the user can modify user access to this collection
   */
  canEditUserAccess(org: Organization): boolean {
    return (
      (org.permissions.manageUsers && org.allowAdminAccessToAllCollectionItems) || this.canEdit(org)
    );
  }

  /**
   * Whether the user can modify group access to this collection
   */
  canEditGroupAccess(org: Organization): boolean {
    return (
      (org.permissions.manageGroups && org.allowAdminAccessToAllCollectionItems) ||
      this.canEdit(org)
    );
  }

  /**
   * Returns true if the user can view collection info and access in a read-only state from the Admin Console
   */
  override canViewCollectionInfo(org: Organization | undefined): boolean {
    if (this.isUnassignedCollection) {
      return false;
    }

    return this.manage || org?.isAdmin || org?.permissions.editAnyCollection;
  }

  /**
   * True if this collection represents the pseudo "Unassigned" collection
   * This is different from the "unmanaged" flag, which indicates that no users or groups have access to the collection
   */
  get isUnassignedCollection() {
    return this.id === Unassigned;
  }
}
