// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";

export class GroupRequest {
  name: string;
  collections: SelectionReadOnlyRequest[] = [];
  users: string[] = [];
}
