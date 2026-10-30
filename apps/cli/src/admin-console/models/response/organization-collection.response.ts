import { CollectionView } from "@bitwarden/common/admin-console/models/collections";

import { SelectionReadOnly } from "../selection-read-only";

import { CollectionResponse } from "./collection.response";

export class OrganizationCollectionResponse extends CollectionResponse {
  groups: SelectionReadOnly[];
  users: SelectionReadOnly[];

  constructor(
    o: CollectionView,
    groups: SelectionReadOnly[],
    users: SelectionReadOnly[],
    useSharedFoldersTerm = false,
  ) {
    super(o);
    this.object = useSharedFoldersTerm ? "org-shared-folder" : "org-collection";
    this.groups = groups;
    this.users = users;
  }
}
