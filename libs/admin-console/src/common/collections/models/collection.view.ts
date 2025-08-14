import { Jsonify } from "type-fest";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { View } from "@bitwarden/common/models/view/view";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

import { Collection, CollectionType, CollectionTypes } from "./collection";
import { CollectionAccessDetailsResponse } from "./collection.response";

export const NestingDelimiter = "/";

export class CollectionView implements View, ITreeNodeObject {
  id: CollectionId;
  organizationId: OrganizationId;
  name: string;
  externalId: string | undefined;
  // readOnly applies to the items within a collection
  readOnly: boolean = false;
  hidePasswords: boolean = false;
  manage: boolean = false;
  assigned: boolean = false;
  type: CollectionType = CollectionTypes.SharedCollection;

  constructor(c: { id: CollectionId; organizationId: OrganizationId; name: string }) {
    this.id = c.id;
    this.organizationId = c.organizationId;
    this.name = c.name;
  }

  canEditItems(org: Organization): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    return org?.canEditAllCiphers || this.manage || (this.assigned && !this.readOnly);
  }

  /**
   * Returns true if the user can edit a collection (including user and group access) from the individual vault.
   * Does not include admin permissions - see {@link CollectionAdminView.canEdit}.
   */
  canEdit(org: Organization | undefined): boolean {
    if (this.isDefaultCollection) {
      return false;
    }

    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    return this.manage;
  }

  /**
   * Returns true if the user can delete a collection from the individual vault.
   * Does not include admin permissions - see {@link CollectionAdminView.canDelete}.
   */
  canDelete(org: Organization | undefined): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    const canDeleteManagedCollections = !org?.limitCollectionDeletion || org.isAdmin;

    // Only use individual permissions, not admin permissions
    return canDeleteManagedCollections && this.manage && !this.isDefaultCollection;
  }

  /**
   * Returns true if the user can view collection info and access in a read-only state from the individual vault
   */
  canViewCollectionInfo(org: Organization | undefined): boolean {
    return false;
  }

  get isDefaultCollection() {
    return this.type == CollectionTypes.DefaultUserCollection;
  }

  // FIXME: we should not use a CollectionView object for the vault filter header because it is not a real
  // CollectionView and this violates ts-strict rules.
  static vaultFilterHead(): CollectionView {
    return new CollectionView({
      id: "" as CollectionId,
      organizationId: "" as OrganizationId,
      name: "",
    });
  }

  static async fromCollection(
    collection: Collection,
    encryptService: EncryptService,
    key: OrgKey,
  ): Promise<CollectionView> {
    const view: CollectionView = Object.assign(
      new CollectionView({ ...collection, name: "" }),
      collection,
    );
    view.name = await encryptService.decryptString(collection.name, key);
    view.assigned = true;
    return view;
  }

  static async fromCollectionAccessDetails(
    collection: CollectionAccessDetailsResponse,
    encryptService: EncryptService,
    orgKey: OrgKey,
  ): Promise<CollectionView> {
    const view = new CollectionView({ ...collection });

    view.name = await encryptService.decryptString(new EncString(collection.name), orgKey);
    view.externalId = collection.externalId;
    view.type = collection.type;
    view.assigned = collection.assigned;
    return view;
  }

  static fromJSON(obj: Jsonify<CollectionView>) {
    return Object.assign(new CollectionView({ ...obj }), obj);
  }

  encrypt(orgKey: OrgKey, encryptService: EncryptService): Promise<Collection> {
    return Collection.fromCollectionView(this, encryptService, orgKey);
  }
}
