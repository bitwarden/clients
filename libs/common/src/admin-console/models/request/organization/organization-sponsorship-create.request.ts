import { PlanSponsorshipType } from "../../../../billing/enums";

export class OrganizationSponsorshipCreateRequest {
  sponsoredEmail: string;
  planSponsorshipType: PlanSponsorshipType;
  friendlyName: string;
  isAdminInitiated?: boolean;
  notes?: string;

  constructor(c: {
    sponsoredEmail: string;
    planSponsorshipType: PlanSponsorshipType;
    friendlyName: string;
    isAdminInitiated?: boolean;
    notes?: string;
  }) {
    this.sponsoredEmail = c.sponsoredEmail;
    this.planSponsorshipType = c.planSponsorshipType;
    this.friendlyName = c.friendlyName;
    this.isAdminInitiated = c.isAdminInitiated;
    this.notes = c.notes;
  }
}
