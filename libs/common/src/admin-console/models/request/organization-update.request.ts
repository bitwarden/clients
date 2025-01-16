// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationKeysRequest } from "./organization-keys.request";

export class OrganizationUpdateRequest {
  name: string;
  businessName: string;
  billingEmail: string;
  keys: OrganizationKeysRequest;
}
