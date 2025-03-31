// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationKeysRequest } from "../../../admin-console/models/request/organization-keys.request";
import { PlanType } from "../../../billing/enums";

export class CreateClientOrganizationRequest {
  name: string;
  ownerEmail: string;
  planType: PlanType;
  seats: number;
  key: string;
  keyPair: OrganizationKeysRequest;
  collectionName: string;
}
