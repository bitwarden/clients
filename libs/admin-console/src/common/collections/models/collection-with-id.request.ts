// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Collection } from "./collection";
import { CollectionRequest } from "./collection.request";

export class CollectionWithIdRequest extends CollectionRequest {
  id: string;

  constructor(collection?: Collection) {
    if (collection == null) {
      return;
    }
    super(collection);
    this.id = collection.id;
  }
}
