import { CollectionView } from "@bitwarden/admin-console/common";

import { CollectionResponse } from "../../../vault/models/collection.response";
import { SelectionReadOnly } from "../selection-read-only";

export class OrganizationCollectionResponse extends CollectionResponse {
  groups: SelectionReadOnly[];
  users: SelectionReadOnly[];

  constructor(o: CollectionView, groups: SelectionReadOnly[], users: SelectionReadOnly[]) {
    super(o);
    this.object = "org-collection";
    this.groups = groups;
    this.users = users;
  }
}
