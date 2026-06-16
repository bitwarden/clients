import { EncString } from "@bitwarden/sdk-internal";

export class OrganizationUserBulkRestoreRequest {
  ids: string[];
  defaultUserCollectionName: EncString | undefined;

  constructor(ids: string[], defaultUserCollectionName?: EncString) {
    this.ids = ids;
    this.defaultUserCollectionName = defaultUserCollectionName;
  }
}
