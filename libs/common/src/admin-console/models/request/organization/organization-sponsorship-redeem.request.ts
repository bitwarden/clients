import { PlanSponsorshipType } from "../../../../billing/enums";

export class OrganizationSponsorshipRedeemRequest {
  planSponsorshipType: PlanSponsorshipType;
  sponsoredOrganizationId: string;

  constructor(c: { planSponsorshipType: PlanSponsorshipType; sponsoredOrganizationId: string }) {
    this.planSponsorshipType = c.planSponsorshipType;
    this.sponsoredOrganizationId = c.sponsoredOrganizationId;
  }
}
