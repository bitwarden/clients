import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";

import { Collection } from "./collection";

export class CollectionRequest {
  name: string;
  externalId: string | undefined;
  groups: SelectionReadOnlyRequest[] = [];
  users: SelectionReadOnlyRequest[] = [];

  constructor(collection: Collection) {
    if (collection == null || collection.name == null || collection.name.encryptedString == null) {
      throw new Error("todo");
    }

    this.name = collection.name.encryptedString;
    this.externalId = collection.externalId;
  }
}
