import { Injectable } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { MemberAdoptionMemberResponse } from "../response/member-adoption-report.response";
import {
  MemberAdoptionExportItem,
  MemberAdoptionMemberView,
  MemberAdoptionReportView,
} from "../view/member-adoption-report.view";

import { MemberAdoptionReportApiService } from "./member-adoption-report-api.service";
import { MemberAdoptionReportServiceAbstraction } from "./member-adoption-report.abstraction";

@Injectable()
export class MemberAdoptionReportService implements MemberAdoptionReportServiceAbstraction {
  constructor(
    private reportApiService: MemberAdoptionReportApiService,
    private i18nService: I18nService,
  ) {}

  async getMemberAdoptionReport(organizationId: OrganizationId): Promise<MemberAdoptionReportView> {
    const response = await this.reportApiService.getMemberAdoptionData(organizationId);

    return {
      totalMemberCount: response.totalMemberCount,
      activeMemberCount: response.activeMemberCount,
      inactiveMemberCount: response.inactiveMemberCount,
      sponsoredFamiliesRedeemedCount: response.sponsoredFamiliesRedeemedCount,
      members: response.members.map((member) => this.toMemberView(member)),
    };
  }

  async getMemberAdoptionExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAdoptionExportItem[]> {
    const report = await this.getMemberAdoptionReport(organizationId);

    // Resolved once for the whole export.
    const yes = this.i18nService.t("yes");
    const no = this.i18nService.t("no");

    return report.members.map((member) => ({
      name: member.name,
      email: member.email,
      recentLogin: member.hasRecentLogin ? yes : no,
      extensionInstalled: member.hasExtensionInstalled ? yes : no,
      vaultItems: member.vaultItemCount.toString(),
      itemsSharedWithThem: member.sharedItemCount.toString(),
    }));
  }

  private toMemberView(member: MemberAdoptionMemberResponse): MemberAdoptionMemberView {
    return {
      organizationUserId: member.organizationUserId,
      userId: member.userId,
      name: member.name,
      email: member.email,
      hasRecentLogin: member.hasRecentLogin,
      hasExtensionInstalled: member.hasExtensionInstalled,
      vaultItemCount: member.vaultItemCount,
      sharedItemCount: member.sharedItemCount,
    };
  }
}
