import { Guid } from "../../types/guid";
import { CollectionDetailsResponse } from "../response/collection.response";

export class CollectionData {
  id: Guid;
  organizationId: Guid;
  name: string;
  externalId: string;
  readOnly: boolean;

  constructor(response: CollectionDetailsResponse) {
    this.id = response.id;
    this.organizationId = response.organizationId;
    this.name = response.name;
    this.externalId = response.externalId;
    this.readOnly = response.readOnly;
  }
}
