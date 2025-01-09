import { Jsonify } from "type-fest";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { CollectionDetailsResponse } from "./collection.response";

export class CollectionData {
  id: CollectionId;
  organizationId: OrganizationId;
  name: string;
  externalId: string;
  readOnly: boolean;
  manage: boolean;
  hidePasswords: boolean;

  constructor(response: CollectionDetailsResponse) {
    this.id = response.id;
    this.organizationId = response.organizationId;
    this.name = response.name;
    this.externalId = response.externalId;
    this.readOnly = response.readOnly;
    this.manage = response.manage;
    this.hidePasswords = response.hidePasswords;
  }

  static fromJSON(obj: Jsonify<CollectionData>) {
    return Object.assign(new CollectionData(new CollectionDetailsResponse({})), obj);
  }
}
