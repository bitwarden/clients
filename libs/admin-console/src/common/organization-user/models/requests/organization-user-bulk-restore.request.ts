import { EncString } from "@bitwarden/sdk-internal";

export class OrganizationUserBulkRestoreRequest {
  userIds: string[];
  defaultUserCollectionName: EncString | undefined;

  constructor(userIds: string[], defaultUserCollectionName?: EncString) {
    this.userIds = userIds;
    this.defaultUserCollectionName = defaultUserCollectionName;
  }
}
