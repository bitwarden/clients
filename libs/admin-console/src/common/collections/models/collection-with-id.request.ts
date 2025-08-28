import { Collection } from "./collection";
import { BaseCollectionRequest } from "./collection.request";

export class CollectionWithIdRequest extends BaseCollectionRequest {
  id: string;
  name: string;

  constructor(collection: Collection) {
    if (collection == null || collection.name == null || collection.name.encryptedString == null) {
      throw new Error("CollectionWithIdRequest must contain name.");
    }
    super({
      externalId: collection.externalId,
    });
    this.name = collection.name.encryptedString;
    this.id = collection.id;
  }
}
