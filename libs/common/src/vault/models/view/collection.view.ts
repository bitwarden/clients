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

  canEditItems(org: Organization, v1FlexibleCollections: boolean): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    if (org?.flexibleCollections) {
      return (
        org?.canEditAllCiphers(v1FlexibleCollections) ||
        this.manage ||
        (this.assigned && !this.readOnly)
      );
    }

    return org?.canEditAnyCollection(false) || (org?.canEditAssignedCollections && this.assigned);
  }

  // For editing collection details, not the items within it.
  canEdit(org: Organization, flexibleCollectionsV1Enabled: boolean): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    return org?.flexibleCollections
      ? org?.canEditAnyCollection(flexibleCollectionsV1Enabled) || this.manage
      : org?.canEditAnyCollection(flexibleCollectionsV1Enabled) || org?.canEditAssignedCollections;
  }

  // For deleting a collection, not the items within it.
  canDelete(org: Organization): boolean {
    if (org != null && org.id !== this.organizationId) {
      throw new Error(
        "Id of the organization provided does not match the org id of the collection.",
      );
    }

    return org?.flexibleCollections
      ? org?.canDeleteAnyCollection || (!org?.limitCollectionCreationDeletion && this.manage)
      : org?.canDeleteAnyCollection || org?.canDeleteAssignedCollections;
  }

  static fromJSON(obj: Jsonify<CollectionView>) {
    return Object.assign(new CollectionView(new Collection()), obj);
  }
}
