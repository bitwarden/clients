import { Jsonify } from "type-fest";

import { CollectionId, OrganizationId } from "../../../types/guid";

import { CollectionDetailsResponse, CollectionType, CollectionTypes } from ".";

export class CollectionData {
  id: CollectionId;
  organizationId: OrganizationId;
  name: string;
  defaultUserCollectionEmail: string | undefined;
  externalId: string | undefined;
  readOnly: boolean = false;
  manage: boolean = false;
  hidePasswords: boolean = false;
  type: CollectionType = CollectionTypes.SharedCollection;
  /**
   * True when the collection is governed by an access rule that is currently enabled, meaning its
   * items are gated behind PAM leasing. Server-derived: the association alone is not enough,
   * because a disabled rule gates nothing.
   */
  hasEnabledAccessRule: boolean = false;

  constructor(response: CollectionDetailsResponse) {
    this.id = response.id;
    this.organizationId = response.organizationId;
    this.name = response.name;
    this.externalId = response.externalId;
    this.readOnly = response.readOnly;
    this.manage = response.manage;
    this.hidePasswords = response.hidePasswords;
    this.type = response.type;
    this.defaultUserCollectionEmail = response.defaultUserCollectionEmail;
    this.hasEnabledAccessRule = response.hasEnabledAccessRule;
  }

  static fromJSON(obj: Jsonify<CollectionData | null>): CollectionData | null {
    if (obj == null) {
      return null;
    }
    return Object.assign(new CollectionData(new CollectionDetailsResponse({})), obj);
  }
}
