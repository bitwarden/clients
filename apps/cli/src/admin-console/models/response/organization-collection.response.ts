import { CollectionView } from "@bitwarden/admin-console/common";

import { SelectionReadOnly } from "../selection-read-only";

import { CollectionResponse } from "./collection.response";

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
