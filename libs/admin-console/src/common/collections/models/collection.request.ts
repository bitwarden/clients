// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";

import { Collection } from "./collection";

export class CollectionRequest {
  name: string;
  externalId: string;
  groups: SelectionReadOnlyRequest[] = [];
  users: SelectionReadOnlyRequest[] = [];

  constructor(collection?: Collection) {
    if (collection == null) {
      return;
    }
    this.name = collection.name ? collection.name.encryptedString : null;
    this.externalId = collection.externalId;
  }
}
