import { OrganizationKeysRequest } from "@bitwarden/common/admin-console/models/request/organization-keys.request";

export class OrganizationUserAcceptInitRequest {
  token: string;
  key: string;
  keys: OrganizationKeysRequest;
  collectionName: string;

  constructor(token: string, key: string, keys: OrganizationKeysRequest, collectionName: string) {
    if (!token) {
      throw new Error("Token is required");
    }
    if (!key) {
      throw new Error("Organization key is required");
    }
    if (!keys) {
      throw new Error("Organization keys are required");
    }
    if (!collectionName) {
      throw new Error("Collection name is required");
    }
    this.token = token;
    this.key = key;
    this.keys = keys;
    this.collectionName = collectionName;
  }
}
