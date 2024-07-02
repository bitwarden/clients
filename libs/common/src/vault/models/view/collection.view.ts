import { Jsonify } from "type-fest";

import { Organization } from "../../../admin-console/models/domain/organization";
import { View } from "../../../models/view/view";
import { Collection } from "../domain/collection";
import { ITreeNodeObject } from "../domain/tree-node";
import { CollectionAccessDetailsResponse } from "../response/collection.response";

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

  canEditItems(
    org: Organization,
    v1FlexibleCollections: boolean,
    restrictProviderAccess: boolean,
  ): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    return (
      org?.canEditAllCiphers(v1FlexibleCollections, restrictProviderAccess) ||
      this.manage ||
      (this.assigned && !this.readOnly)
    );
  }

  /**
   * Returns true if the user can edit a collection (including user and group access) from the individual vault.
   * After FCv1, does not include admin permissions - see {@link CollectionAdminView.canEdit}.
   */
  canEdit(org: Organization, flexibleCollectionsV1Enabled: boolean): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    if (flexibleCollectionsV1Enabled) {
      // Only use individual permissions, not admin permissions
      return this.manage;
    }

    return org?.canEditAnyCollection(flexibleCollectionsV1Enabled) || this.manage;
  }

  /**
   * Returns true if the user can delete a collection from the individual vault.
   * After FCv1, does not include admin permissions - see {@link CollectionAdminView.canDelete}.
   */
  canDelete(org: Organization, flexibleCollectionsV1Enabled: boolean): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    const canDeleteManagedCollections = !org?.limitCollectionCreationDeletion || org.isAdmin;

    if (flexibleCollectionsV1Enabled) {
      // Only use individual permissions, not admin permissions
      return canDeleteManagedCollections && this.manage;
    }

    return (
      org?.canDeleteAnyCollection(flexibleCollectionsV1Enabled) ||
      (canDeleteManagedCollections && this.manage)
    );
  }

  /**
   * Returns true if the user can view collection info and access in a read-only state from the individual vault
   */
  canViewCollectionInfo(
    org: Organization | undefined,
    flexibleCollectionsV1Enabled: boolean,
  ): boolean {
    return false;
  }

  static fromJSON(obj: Jsonify<CollectionView>) {
    if (obj == null) {
      return null;
    }

    return Object.assign(new CollectionView(new Collection()), obj);
  }
}
