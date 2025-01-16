// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { View } from "@bitwarden/common/models/view/view";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

import { Collection } from "./collection";
import { CollectionAccessDetailsResponse } from "./collection.response";

export const NestingDelimiter = "/";

export class CollectionView implements View, ITreeNodeObject {
  id: string = null;
  organizationId: string = null;
  name: string = null;
  externalId: string = null;
  // readOnly applies to the items within a collection
  readOnly: boolean = null;
  hidePasswords: boolean = null;
  manage: boolean = null;
  assigned: boolean = null;

  constructor(c?: Collection | CollectionAccessDetailsResponse) {
    if (!c) {
      return;
    }

    this.id = c.id;
    this.organizationId = c.organizationId;
    this.externalId = c.externalId;
    if (c instanceof Collection) {
      this.readOnly = c.readOnly;
      this.hidePasswords = c.hidePasswords;
      this.manage = c.manage;
      this.assigned = true;
    }
    if (c instanceof CollectionAccessDetailsResponse) {
      this.assigned = c.assigned;
    }
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
  canEdit(org: Organization): boolean {
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
  canDelete(org: Organization): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    const canDeleteManagedCollections = !org?.limitCollectionDeletion || org.isAdmin;

    // Only use individual permissions, not admin permissions
    return canDeleteManagedCollections && this.manage;
  }

  /**
   * Returns true if the user can view collection info and access in a read-only state from the individual vault
   */
  canViewCollectionInfo(org: Organization | undefined): boolean {
    return false;
  }

  static fromJSON(obj: Jsonify<CollectionView>) {
    return Object.assign(new CollectionView(new Collection()), obj);
  }
}
