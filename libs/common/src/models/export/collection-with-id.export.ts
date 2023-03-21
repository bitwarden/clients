import { Guid } from "../../types/guid";
import { Collection as CollectionDomain } from "../domain/collection";
import { CollectionView } from "../view/collection.view";

import { CollectionExport } from "./collection.export";

export class CollectionWithIdExport extends CollectionExport {
  id: Guid;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CollectionView | CollectionDomain) {
    this.id = o.id;
    super.build(o);
  }
}
