import { OrganizationKeysRequest } from "./organization-keys.request";

export interface OrganizationUpdateRequest {
  name?: string;
  billingEmail?: string;
  keys?: OrganizationKeysRequest;
}
