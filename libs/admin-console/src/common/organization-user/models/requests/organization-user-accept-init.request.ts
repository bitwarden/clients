// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";

export class OrganizationUserAcceptInitRequest {
  token: string;
  key: string;
  keys: OrganizationKeysRequest;
  collectionName: string;
}
