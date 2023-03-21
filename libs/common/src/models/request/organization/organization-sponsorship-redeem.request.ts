import { PlanSponsorshipType } from "../../../enums/planSponsorshipType";
import { Guid } from "../../../types/guid";

export class OrganizationSponsorshipRedeemRequest {
  planSponsorshipType: PlanSponsorshipType;
  sponsoredOrganizationId: Guid;
}
