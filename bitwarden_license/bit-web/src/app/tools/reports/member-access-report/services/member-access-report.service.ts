// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { CollectionAccessSelectionView } from "@bitwarden/admin-console/common";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OrganizationId } from "@bitwarden/common/types/guid";
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
    const memberAccessData = await this.reportApiService.getMemberAccessData(organizationId);
    const memberAccessReportViewCollection = memberAccessData.map((userData) => ({
      name: userData.userName,
      email: userData.email,
      collectionsCount: userData.collectionsCount,
      groupsCount: userData.groupsCount,
      itemsCount: userData.totalItemCount,
      userGuid: userData.userGuid,
      usesKeyConnector: userData.usesKeyConnector,
    }));
    return memberAccessReportViewCollection;
  }

  async generateUserReportExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAccessExportItem[]> {
    const memberAccessReports = await this.reportApiService.getMemberAccessData(organizationId);
    const collectionNames = memberAccessReports.flatMap((item) =>
      item.accessDetails.map((dtl) => {
        if (dtl.collectionName) {
          return dtl.collectionName.encryptedString;
        }
      }),
    );
    const collectionNameMap = new Map(collectionNames.map((col) => [col, ""]));
    for await (const key of collectionNameMap.keys()) {
      const decrypted = new EncString(key);
      await decrypted.decrypt(organizationId);
      collectionNameMap.set(key, decrypted.decryptedValue);
    }

    const exportItems = memberAccessReports.flatMap((report) => {
      const userDetails = report.accessDetails.map((detail) => {
        const collectionName = collectionNameMap.get(detail.collectionName.encryptedString);
        return {
          email: report.email,
          name: report.userName,
          twoStepLogin: report.twoFactorEnabled
            ? this.i18nService.t("memberAccessReportTwoFactorEnabledTrue")
            : this.i18nService.t("memberAccessReportTwoFactorEnabledFalse"),
          accountRecovery: report.accountRecoveryEnabled
            ? this.i18nService.t("memberAccessReportAuthenticationEnabledTrue")
            : this.i18nService.t("memberAccessReportAuthenticationEnabledFalse"),
          group: detail.groupName
            ? detail.groupName
            : this.i18nService.t("memberAccessReportNoGroup"),
          collection: collectionName
            ? collectionName
            : this.i18nService.t("memberAccessReportNoCollection"),
          collectionPermission: detail.collectionId
            ? this.getPermissionText(detail)
            : this.i18nService.t("memberAccessReportNoCollectionPermission"),
          totalItems: detail.itemCount.toString(),
        };
      });
      return userDetails;
    });
    return exportItems.flat();
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
