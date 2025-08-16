import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { OrgKey } from "@bitwarden/common/types/key";

import { CollectionAccessSelectionView } from "./collection-access-selection.view";
import { CollectionAccessDetailsResponse, CollectionResponse } from "./collection.response";
import { CollectionView } from "./collection.view";

// TODO: this is used to represent the pseudo "Unassigned" collection as well as
// the user's personal vault (as a pseudo organization). This should be separated out into different values.
export const Unassigned = "unassigned";
export type Unassigned = typeof Unassigned;

export class CollectionAdminView extends CollectionView {
  groups: CollectionAccessSelectionView[] = [];
  users: CollectionAccessSelectionView[] = [];

  /**
   * Flag indicating the collection has no active user or group assigned to it with CanManage permissions
   * In this case, the collection can be managed by admins/owners or custom users with appropriate permissions
   */
  unmanaged: boolean = false;

  /**
   * Flag indicating the user has been explicitly assigned to this Collection
   */
  assigned: boolean = false;

  /**
   * Returns true if the user can edit a collection (including user and group access) from the Admin Console.
   */
  override canEdit(org: Organization): boolean {
    if (this.isDefaultCollection) {
      return false;
    }

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
    if (this.isDefaultCollection) {
      return false;
    }

    return org?.canDeleteAnyCollection || super.canDelete(org);
  }

  /**
   * Whether the user can modify user access to this collection
   */
  canEditUserAccess(org: Organization): boolean {
    if (this.isDefaultCollection) {
      return false;
    }

    return (
      (org.permissions.manageUsers && org.allowAdminAccessToAllCollectionItems) || this.canEdit(org)
    );
  }

  /**
   * Whether the user can modify group access to this collection
   */
  canEditGroupAccess(org: Organization): boolean {
    if (this.isDefaultCollection) {
      return false;
    }

    return (
      (org.permissions.manageGroups && org.allowAdminAccessToAllCollectionItems) ||
      this.canEdit(org)
    );
  }

  /**
   * Returns true if the user can view collection info and access in a read-only state from the Admin Console
   */
  override canViewCollectionInfo(org: Organization | undefined): boolean {
    if (this.isUnassignedCollection || this.isDefaultCollection) {
      return false;
    }
    const isAdmin = org?.isAdmin ?? false;
    const permissions = org?.permissions.editAnyCollection ?? false;

    return this.manage || isAdmin || permissions;
  }

  /**
   * True if this collection represents the pseudo "Unassigned" collection
   * This is different from the "unmanaged" flag, which indicates that no users or groups have access to the collection
   */
  get isUnassignedCollection() {
    return this.id === Unassigned;
  }

  /**
   * Returns true if the collection name can be edited. Editing the collection name is restricted for collections
   * that were DefaultUserCollections but where the relevant user has been offboarded.
   * When this occurs, the offboarded user's email is treated as the collection name, and cannot be edited.
   * This is important for security so that the server cannot ask the client to encrypt arbitrary data.
   * WARNING! This is an IMPORTANT restriction that MUST be maintained for security purposes.
   * Do not edit or remove this unless you understand why.
   */
  override canEditName(org: Organization): boolean {
    return (this.canEdit(org) && !this.defaultUserCollectionEmail) || super.canEditName(org);
  }
  static async fromCollectionAccessDetails(
    collection: CollectionAccessDetailsResponse,
    encryptService: EncryptService,
    orgKey: OrgKey,
  ): Promise<CollectionAdminView> {
    const view = new CollectionAdminView({ ...collection });
    view.name = await encryptService.decryptString(new EncString(view.name), orgKey);
    view.assigned = collection.assigned;
    view.readOnly = collection.readOnly;
    view.hidePasswords = collection.hidePasswords;
    view.manage = collection.manage;
    view.unmanaged = collection.unmanaged;
    view.type = collection.type;
    view.externalId = collection.externalId;
    view.defaultUserCollectionEmail = collection.defaultUserCollectionEmail;

    view.groups = collection.groups
      ? collection.groups.map((g) => new CollectionAccessSelectionView(g))
      : [];

    view.users = collection.users
      ? collection.users.map((g) => new CollectionAccessSelectionView(g))
      : [];

    return view;
  }

  static async fromCollectionResponse(
    collection: CollectionResponse,
    encryptService: EncryptService,
    orgKey: OrgKey,
  ): Promise<CollectionAdminView> {
    const collectionAdminView = new CollectionAdminView({
      id: collection.id,
      name: await encryptService.decryptString(new EncString(collection.name), orgKey),
      organizationId: collection.organizationId,
    });

    collectionAdminView.externalId = collection.externalId;

    return collectionAdminView;
  }
}
