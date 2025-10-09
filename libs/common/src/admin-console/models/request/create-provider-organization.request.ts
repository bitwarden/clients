// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PlanType } from "../../../billing/enums";

import { OrganizationKeysRequest } from "./organization-keys.request";

export class CreateProviderOrganizationRequest {
  name: string;
  ownerEmail: string;
  planType: PlanType;
  seats: number;
  key: string;
  keyPair: OrganizationKeysRequest;
  collectionName: string;
}
