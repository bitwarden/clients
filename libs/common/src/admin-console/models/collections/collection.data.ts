import { Jsonify } from "type-fest";

import {
  CollectionDetailsResponse,
  CollectionType,
  CollectionTypes,
} from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

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
  }

  static fromJSON(obj: Jsonify<CollectionData | null>): CollectionData | null {
    if (obj == null) {
      return null;
    }
    return Object.assign(new CollectionData(new CollectionDetailsResponse({})), obj);
  }
}
