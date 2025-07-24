import { Jsonify } from "type-fest";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { CollectionType } from "./collection";
import { CollectionDetailsResponse } from "./collection.response";

export class CollectionData {
  id: CollectionId;
  organizationId: OrganizationId;
  name: string;
  externalId: string;
  readOnly: boolean;
  manage: boolean;
  hidePasswords: boolean;
  type: CollectionType;

  constructor(response: CollectionDetailsResponse) {
    this.id = response.id;
    this.organizationId = response.organizationId;
    this.name = response.name;
    this.externalId = response.externalId;
    this.readOnly = response.readOnly;
    this.manage = response.manage;
    this.hidePasswords = response.hidePasswords;
    this.type = response.type;
  }

  static fromJSON(obj: Jsonify<CollectionData | null>): CollectionData | null {
    if (obj == null) {
      return null;
    }
    return Object.assign(new CollectionData(new CollectionDetailsResponse({})), obj);
  }
}
