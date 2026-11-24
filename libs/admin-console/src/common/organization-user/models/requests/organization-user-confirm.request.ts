import { EncString } from "@bitwarden/sdk-internal";

export class OrganizationUserConfirmRequest {
  key: EncString | undefined;
  defaultUserCollectionName: EncString | undefined;
}
