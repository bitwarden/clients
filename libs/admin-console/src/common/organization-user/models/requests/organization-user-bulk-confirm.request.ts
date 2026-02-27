import { EncString as SdkEncString } from "@bitwarden/sdk-internal";

type OrganizationUserBulkRequestEntry = {
  id: string;
  key: string;
};

export class OrganizationUserBulkConfirmRequest {
  keys: OrganizationUserBulkRequestEntry[];
  defaultUserCollectionName: SdkEncString | undefined;

  constructor(keys: OrganizationUserBulkRequestEntry[], defaultUserCollectionName?: SdkEncString) {
    this.keys = keys;
    this.defaultUserCollectionName = defaultUserCollectionName;
  }
}
