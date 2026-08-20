import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";

export class BulkCollectionAccessRequest {
  collectionIds: string[] = [];
  users: SelectionReadOnlyRequest[] = [];
  groups: SelectionReadOnlyRequest[] = [];
}
