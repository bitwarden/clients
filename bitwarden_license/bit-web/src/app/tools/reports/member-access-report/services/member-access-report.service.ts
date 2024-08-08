import { Injectable } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CollectionAccessSelectionView } from "@bitwarden/web-vault/app/admin-console/organizations/core/views";
import {
  getPermissionList,
  convertToPermission,
} from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/access-selector";

import { MemberAccessDetails } from "../response/member-access-report.response";
import { MemberAccessExportItem } from "../view/member-access-export.view";
import { MemberAccessReportView } from "../view/member-access-report.view";

import { MemberAccessReportApiService } from "./member-access-report-api.service";



@Injectable({ providedIn: "root" })
export class MemberAccessReportService {
  constructor(
    private reportApiService: MemberAccessReportApiService,
    private i18nService: I18nService,
  ) {}
  /**
   * Transforms user data into a MemberAccessReportView.
   *
   * @param {UserData} userData - The user data to aggregate.
   * @param {ReportCollection[]} collections - An array of collections, each with an ID and a total number of items.
   * @returns {MemberAccessReportView} The aggregated report view.
   */
  async generateMemberAccessReportView(
    organizationId: OrganizationId,
  ): Promise<MemberAccessReportView[]> {
    const memberAccessReportViewCollection: MemberAccessReportView[] = [];
    const memberAccessData = await this.reportApiService.getMemberAccessData(organizationId);
    memberAccessData.forEach((userData) => {
      memberAccessReportViewCollection.push({
        name: userData.userName,
        email: userData.email,
        collectionsCount: userData.collectionsCount,
        groupsCount: userData.groupsCount,
        itemsCount: userData.totalItemCount,
      });
    });
    return memberAccessReportViewCollection;
  }

  async generateUserReportExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAccessExportItem[]> {
    const memberAccessReports = await this.reportApiService.getMemberAccessData(organizationId);
    const exportItems = memberAccessReports.flatMap(async (report) => {
      const userDetails = report.accessDetails.map(async (detail) => {
        const collectionName = await detail.collectionName.decrypt(organizationId);
        return {
          email: report.email,
          name: report.userName,
          twoStepLogin: report.twoFactorEnabled ? "On" : "Off",
          accountRecovery: report.accountRecoveryEnabled ? "On" : "Off",
          group: detail.groupName,
          collection: collectionName,
          collectionPermission: this.getPermissionText(detail),
          totalItems: detail.itemCount.toString(),
        };
      });
      return Promise.all(userDetails);
    });
    const resolvedItems = await Promise.all(exportItems);
    return resolvedItems.flat();
  }

  private getPermissionText(accessDetails: MemberAccessDetails): string {
    const permissionList = getPermissionList();
    const collectionSelectionView = new CollectionAccessSelectionView({
      id: accessDetails.groupId ?? accessDetails.collectionId,
      readOnly: accessDetails.readOnly,
      hidePasswords: accessDetails.hidePasswords,
      manage: accessDetails.manage,
    });
    return this.i18nService.t(
      permissionList.find((p) => p.perm === convertToPermission(collectionSelectionView))?.labelId,
    );
  }
}
