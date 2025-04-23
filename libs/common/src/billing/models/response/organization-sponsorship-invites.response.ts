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
    this.friendlyName = this.getResponseProperty("friendlyName");
    this.offeredToEmail = this.getResponseProperty("offeredToEmail");
    this.planSponsorshipType = this.getResponseProperty("planSponsorshipType");
    this.lastSyncDate = this.getResponseProperty("lastSyncDate");
    this.validUntil = this.getResponseProperty("validUntil");
    this.toDelete = this.getResponseProperty("toDelete") ?? false;
    this.isAdminInitiated = this.getResponseProperty("isAdminInitiated");
    this.notes = this.getResponseProperty("notes");
    this.statusMessage = this.getResponseProperty("statusMessage");
    this.statusClass = this.getResponseProperty("statusClass");
  }
}
