import { BaseResponse } from "../../../models/response/base.response";
import { PlanSponsorshipType } from "../../enums";

export class OrganizationSponsorshipInvitesResponse extends BaseResponse {
  sponsoringOrganizationUserId: string;
  friendlyName: string;
  offeredToEmail: string;
  planSponsorshipType: PlanSponsorshipType;
  lastSyncDate?: Date;
  validUntil?: Date;
  toDelete = false;
  isAdminInitiated: boolean;
  notes: string;
  statusMessage?: string;
  statusClass?: string;

  constructor(response: any) {
    super(response);
    this.sponsoringOrganizationUserId = this.getResponseProperty("SponsoringOrganizationUserId");
    this.friendlyName = this.getResponseProperty("FriendlyName");
    this.offeredToEmail = this.getResponseProperty("OfferedToEmail");
    this.planSponsorshipType = this.getResponseProperty("PlanSponsorshipType");
    this.lastSyncDate = this.getResponseProperty("LastSyncDate");
    this.validUntil = this.getResponseProperty("ValidUntil");
    this.toDelete = this.getResponseProperty("ToDelete") ?? false;
    this.isAdminInitiated = this.getResponseProperty("IsAdminInitiated");
    this.notes = this.getResponseProperty("Notes");
    this.statusMessage = this.getResponseProperty("StatusMessage");
    this.statusClass = this.getResponseProperty("StatusClass");
  }
}
