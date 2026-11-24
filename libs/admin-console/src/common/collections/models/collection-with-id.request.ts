import { Collection } from "@bitwarden/common/admin-console/models/collections";

import { BaseCollectionRequest } from "./collection.request";

export class CollectionWithIdRequest extends BaseCollectionRequest {
  id: string;
  name: string;

  constructor(collection: Collection) {
    if (collection == null || collection.name == null || collection.name == null) {
      throw new Error("CollectionWithIdRequest must contain name.");
    }
    super({
      externalId: collection.externalId,
    });
    this.name = collection.name;
    this.id = collection.id;
  }
}
