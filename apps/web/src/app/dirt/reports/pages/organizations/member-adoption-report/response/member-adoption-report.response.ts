import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Guid, UserId } from "@bitwarden/common/types/guid";

export class MemberAdoptionMemberResponse extends BaseResponse {
  organizationUserId: Guid;
  userId: UserId | null;
  name: string;
  email: string;
  hasRecentLogin: boolean;
  hasExtensionInstalled: boolean;
  vaultItemCount: number;
  sharedItemCount: number;

  constructor(response: unknown) {
    super(response);
    this.organizationUserId = this.getResponseProperty("OrganizationUserId");
    this.userId = this.getResponseProperty("UserId") ?? null;
    this.name = this.getResponseProperty("Name") ?? "";
    this.email = this.getResponseProperty("Email") ?? "";
    this.hasRecentLogin = this.getResponseProperty("HasRecentLogin") ?? false;
    this.hasExtensionInstalled = this.getResponseProperty("HasExtensionInstalled") ?? false;
    this.vaultItemCount = this.getResponseProperty("VaultItemCount") ?? 0;
    this.sharedItemCount = this.getResponseProperty("SharedItemCount") ?? 0;
  }
}

/** The member list is complete: the report paginates it client-side. */
export class MemberAdoptionReportResponse extends BaseResponse {
  totalMemberCount: number;
  activeMemberCount: number;
  inactiveMemberCount: number;
  sponsoredFamiliesRedeemedCount: number;
  members: MemberAdoptionMemberResponse[];

  constructor(response: unknown) {
    super(response);
    this.totalMemberCount = this.getResponseProperty("TotalMemberCount") ?? 0;
    this.activeMemberCount = this.getResponseProperty("ActiveMemberCount") ?? 0;
    this.inactiveMemberCount = this.getResponseProperty("InactiveMemberCount") ?? 0;
    this.sponsoredFamiliesRedeemedCount =
      this.getResponseProperty("SponsoredFamiliesRedeemedCount") ?? 0;

    const members = this.getResponseProperty("Members");
    this.members = Array.isArray(members)
      ? members.map((member) => new MemberAdoptionMemberResponse(member))
      : [];
  }
}
