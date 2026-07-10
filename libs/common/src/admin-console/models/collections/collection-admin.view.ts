import { CollectionView as SdkCollectionView } from "@bitwarden/sdk-internal";

import { EncryptService } from "../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../key-management/crypto/models/enc-string";
import { uuidAsString } from "../../../platform/abstractions/sdk/sdk.service";
import { CollectionId } from "../../../types/guid";
import { OrgKey } from "../../../types/key";
import { Organization } from "../domain/organization";

import { CollectionAccessDetailsResponse, CollectionResponse } from "./collection.response";
import { CollectionView } from "./collection.view";

import { CollectionAccessSelectionView } from ".";

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
    try {
      view.name = await encryptService.decryptString(new EncString(view.name), orgKey);
    } catch (e) {
      view.name = "[error: cannot decrypt]";
      // Note: This should be replaced by the owning team with appropriate, domain-specific behavior.
      // eslint-disable-next-line no-console
      console.error(
        "[CollectionAdminView/fromCollectionAccessDetails] Error decrypting collection name",
        e,
      );
    }
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

  /**
   * Creates a CollectionAdminView from the SDK CollectionView returned by SDK decrypt operations.
   *
   * The `source` parameter provides the admin-only fields (`groups`, `users`, `unmanaged`,
   * `assigned`) that the SDK's CollectionView type does not carry, since those are specific to
   * the Admin Console's collection-access-details representation, not the SDK's crypto model.
   */
  static fromSdkCollectionViewWithAccessDetails(
    sdkView: SdkCollectionView,
    source: CollectionAccessDetailsResponse,
  ): CollectionAdminView {
    const view = new CollectionAdminView({
      id: sdkView.id ? (uuidAsString(sdkView.id) as CollectionId) : (source.id as CollectionId),
      organizationId: source.organizationId,
      name: sdkView.name,
    });

    view.externalId = sdkView.externalId;
    view.hidePasswords = sdkView.hidePasswords;
    view.readOnly = sdkView.readOnly;
    view.manage = sdkView.manage;
    view.type = sdkView.type;
    view.defaultUserCollectionEmail = source.defaultUserCollectionEmail;

    view.assigned = source.assigned;
    view.unmanaged = source.unmanaged;
    view.groups = source.groups
      ? source.groups.map((g) => new CollectionAccessSelectionView(g))
      : [];
    view.users = source.users ? source.users.map((g) => new CollectionAccessSelectionView(g)) : [];

    return view;
  }

  /**
   * Creates a placeholder CollectionAdminView for a collection that failed to decrypt via the
   * SDK bulk path (`decrypt_list_with_failures`). Unlike the personal-vault decryption path, the
   * Admin Console must never silently drop a collection that fails to decrypt, since admins still
   * need to see, manage, and delete it. Mirrors the fallback behavior of
   * {@link fromCollectionAccessDetails}'s catch branch.
   */
  static fromCollectionAccessDetailsDecryptionFailure(
    source: CollectionAccessDetailsResponse,
  ): CollectionAdminView {
    const view = new CollectionAdminView({ ...source, name: "[error: cannot decrypt]" });

    view.assigned = source.assigned;
    view.readOnly = source.readOnly;
    view.hidePasswords = source.hidePasswords;
    view.manage = source.manage;
    view.unmanaged = source.unmanaged;
    view.type = source.type;
    view.externalId = source.externalId;
    view.defaultUserCollectionEmail = source.defaultUserCollectionEmail;

    view.groups = source.groups
      ? source.groups.map((g) => new CollectionAccessSelectionView(g))
      : [];
    view.users = source.users ? source.users.map((g) => new CollectionAccessSelectionView(g)) : [];

    return view;
  }

  static async fromCollectionResponse(
    collection: CollectionResponse,
    encryptService: EncryptService,
    orgKey: OrgKey,
  ): Promise<CollectionAdminView> {
    let collectionName: string;
    try {
      collectionName = await encryptService.decryptString(new EncString(collection.name), orgKey);
    } catch (e) {
      // Note: This should be updated by the owning team with appropriate, domain specific behavior
      // eslint-disable-next-line no-console
      console.error(
        "[CollectionAdminView/fromCollectionResponse] Failed to decrypt the collection name",
        e,
      );
      throw e;
    }

    const collectionAdminView = new CollectionAdminView({
      id: collection.id,
      name: collectionName,
      organizationId: collection.organizationId,
    });

    collectionAdminView.externalId = collection.externalId;

    return collectionAdminView;
  }
}
