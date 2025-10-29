// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { CollectionAccessSelectionView } from "@bitwarden/admin-console/common";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Guid, OrganizationId } from "@bitwarden/common/types/guid";
import {
  getPermissionList,
  convertToPermission,
} from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/access-selector";

import { MemberAccessResponse } from "../response/member-access-report.response";
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

    // group member access data by userGuid
    const userMap = new Map<Guid, MemberAccessResponse[]>();
    memberAccessData.forEach((userData) => {
      const userGuid = userData.userGuid;
      if (!userMap.has(userGuid)) {
        userMap.set(userGuid, []);
      }
      userMap.get(userGuid)?.push(userData);
    });

    // aggregate user data
    const memberAccessReportViewCollection: MemberAccessReportView[] = [];
    userMap.forEach((userDataArray, userGuid) => {
      const collectionCount = this.getDistinctCount<string>(
        userDataArray.map((data) => data.collectionId).filter((id) => !!id),
      );
      const groupCount = this.getDistinctCount<string>(
        userDataArray.map((data) => data.groupId).filter((id) => !!id),
      );
      const itemsCount = this.getDistinctCount<Guid>(
        userDataArray
          .flatMap((data) => data.cipherIds)
          .filter((id) => id !== "00000000-0000-0000-0000-000000000000"),
      );
      const aggregatedData = {
        userGuid: userGuid,
        name: userDataArray[0].userName,
        email: userDataArray[0].email,
        collectionsCount: collectionCount,
        groupsCount: groupCount,
        itemsCount: itemsCount,
        usesKeyConnector: userDataArray.some((data) => data.usesKeyConnector),
      };

      memberAccessReportViewCollection.push(aggregatedData);
    });

    return memberAccessReportViewCollection;
  }

  async generateUserReportExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAccessExportItem[]> {
    const memberAccessReports = await this.reportApiService.getMemberAccessData(organizationId);
    const collectionNames = memberAccessReports.map((item) => item.collectionName.encryptedString);

    const collectionNameMap = new Map(collectionNames.map((col) => [col, ""]));
    for await (const key of collectionNameMap.keys()) {
      const decrypted = new EncString(key);
      await decrypted.decrypt(organizationId);
      collectionNameMap.set(
        key,
        decrypted.decryptedValue === "[error: cannot decrypt]" ? null : decrypted.decryptedValue,
      );
    }

    const exportItems = memberAccessReports.map((report) => {
      const collectionName = collectionNameMap.get(report.collectionName.encryptedString);
      return {
        email: report.email,
        name: report.userName,
        twoStepLogin: report.twoFactorEnabled
          ? this.i18nService.t("memberAccessReportTwoFactorEnabledTrue")
          : this.i18nService.t("memberAccessReportTwoFactorEnabledFalse"),
        accountRecovery: report.accountRecoveryEnabled
          ? this.i18nService.t("memberAccessReportAuthenticationEnabledTrue")
          : this.i18nService.t("memberAccessReportAuthenticationEnabledFalse"),
        group: report.groupName
          ? report.groupName
          : this.i18nService.t("memberAccessReportNoGroup"),
        collection: collectionName
          ? collectionName
          : this.i18nService.t("memberAccessReportNoCollection"),
        collectionPermission: report.collectionId
          ? this.getPermissionText(report)
          : this.i18nService.t("memberAccessReportNoCollectionPermission"),
        totalItems: report.cipherIds
          .filter((_) => _ != "00000000-0000-0000-0000-000000000000")
          .length.toString(),
      };
    });
    return exportItems.flat();
  }

  private getPermissionText(accessDetails: MemberAccessResponse): string {
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

  private getDistinctCount<T>(items: T[]): number {
    const uniqueItems = new Set(items);
    return uniqueItems.size;
  }
}
