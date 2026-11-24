import { EncString as EncString } from "@bitwarden/sdk-internal";

type OrganizationUserBulkRequestEntry = {
  id: string;
  key: string;
};

export class OrganizationUserBulkConfirmRequest {
  keys: OrganizationUserBulkRequestEntry[];
  defaultUserCollectionName: EncString | undefined;

  constructor(keys: OrganizationUserBulkRequestEntry[], defaultUserCollectionName?: EncString) {
    this.keys = keys;
    this.defaultUserCollectionName = defaultUserCollectionName;
  }
}
