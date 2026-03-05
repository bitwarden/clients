// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PlanSponsorshipType } from "../../../../billing/enums";

export class OrganizationSponsorshipCreateRequest {
  sponsoredEmail: string;
  planSponsorshipType: PlanSponsorshipType;
  friendlyName: string;
  isAdminInitiated?: boolean;
  notes?: string;
}
