// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom, map, take } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
} from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Guid, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { KeyService } from "@bitwarden/key-management";
import {
  getPermissionList,
  convertToPermission,
} from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/access-selector";

import { MemberAccessResponse } from "../response/member-access-report.response";
import { MemberAccessExportItem } from "../view/member-access-export.view";
import { MemberAccessReportView } from "../view/member-access-report.view";

import { MemberAccessReportApiService } from "./member-access-report-api.service";

/**
 * V2 data structures for frontend member-to-cipher mapping
 */
interface MemberAccessDataV2 {
  collectionMap: Map<string, CollectionAdminView>;
  organizationUserDataMap: Map<string, OrganizationUserData>;
  groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>;
}

interface OrganizationUserData {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  twoFactorEnabled: boolean;
  usesKeyConnector: boolean;
  resetPasswordEnrolled: boolean;
}

interface MemberCipherAccess {
  userId: string;
  cipherId: string;
  collectionId: string;
  collectionName: string;
  groupId?: string;
  groupName?: string;
  accessType: "direct" | "group";
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
}

@Injectable({ providedIn: "root" })
export class MemberAccessReportService {
  constructor(
    private reportApiService: MemberAccessReportApiService,
    private i18nService: I18nService,
    private encryptService: EncryptService,
    private keyService: KeyService,
    private accountService: AccountService,
    // V2 dependencies for frontend member-to-cipher mapping
    private collectionAdminService: CollectionAdminService,
    private organizationUserApiService: OrganizationUserApiService,
    private cipherService: CipherService,
    private logService: LogService,
  ) {}
  /**
   * Transforms user data into a MemberAccessReportView.
   *
   * @deprecated Times out for large orgs
   * Use generateMemberAccessReportViewV2 instead. Will be removed after V2 rollout is complete.
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
        avatarColor: "", // V1 API doesn't provide avatarColor
        collectionsCount: collectionCount,
        groupsCount: groupCount,
        itemsCount: itemsCount,
        usesKeyConnector: userDataArray.some((data) => data.usesKeyConnector),
      };

      memberAccessReportViewCollection.push(aggregatedData);
    });

    return memberAccessReportViewCollection;
  }

  /**
   * @deprecated V1 implementation - causes timeout for large orgs (5K+ members).
   * Use generateUserReportExportItemsV2 instead. Will be removed after V2 rollout is complete.
   */
  async generateUserReportExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAccessExportItem[]> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const organizationSymmetricKey = await firstValueFrom(
      this.keyService.orgKeys$(activeUserId).pipe(map((keys) => keys[organizationId])),
    );

    const memberAccessReports = await this.reportApiService.getMemberAccessData(organizationId);
    const collectionNames = memberAccessReports.map((item) => item.collectionName.encryptedString);

    const collectionNameMap = new Map(
      collectionNames.filter((col) => col !== null).map((col) => [col, ""]),
    );
    for await (const key of collectionNameMap.keys()) {
      const encryptedCollectionName = new EncString(key);
      const collectionName = await this.encryptService.decryptString(
        encryptedCollectionName,
        organizationSymmetricKey,
      );
      collectionNameMap.set(key, collectionName);
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
          ? this.getPermissionTextFromAccess(report)
          : this.i18nService.t("memberAccessReportNoCollectionPermission"),
        totalItems: report.cipherIds
          .filter((_) => _ != "00000000-0000-0000-0000-000000000000")
          .length.toString(),
      };
    });
    return exportItems.flat();
  }

  /**
   * Shared logic for getting permission text from access details
   * @private
   */
  private getPermissionTextFromAccess(access: {
    groupId?: string;
    collectionId: string;
    readOnly: boolean;
    hidePasswords: boolean;
    manage: boolean;
  }): string {
    const permissionList = getPermissionList();
    const collectionSelectionView = new CollectionAccessSelectionView({
      id: access.groupId ?? access.collectionId,
      readOnly: access.readOnly,
      hidePasswords: access.hidePasswords,
      manage: access.manage,
    });
    return this.i18nService.t(
      permissionList.find((p) => p.perm === convertToPermission(collectionSelectionView))?.labelId,
    );
  }

  private getDistinctCount<T>(items: T[]): number {
    const uniqueItems = new Set(items);
    return uniqueItems.size;
  }

  // ==================== V2 METHODS - Frontend Member Mapping ====================
  // These methods implement the Access Intelligence V2 pattern to avoid backend timeout issues.
  // V2 performs member-to-cipher mapping on the frontend using collection relationships,
  // eliminating the need for the problematic backend member-access endpoint for large orgs.

  /**
   * Loads organization data (collections, users, groups) for V2 member mapping
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID
   * @returns Promise containing collection map, user metadata map, and group member map
   */
  private async _loadOrganizationDataV2(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Promise<MemberAccessDataV2> {
    this.logService.debug("[MemberAccessReportService V2] Loading organization data");

    // Fetch collections and users in parallel
    const [collections, orgUsersResponse] = await Promise.all([
      firstValueFrom(
        this.collectionAdminService
          .collectionAdminViews$(organizationId, currentUserId)
          .pipe(take(1)),
      ),
      this.organizationUserApiService.getAllUsers(organizationId, { includeGroups: true }),
    ]);

    // Build collection map
    const collectionMap = new Map<string, any>();
    collections.forEach((c) => collectionMap.set(c.id, c));

    // Build user metadata and group member maps
    const organizationUserDataMap = new Map<string, OrganizationUserData>();
    const groupMemberMap = new Map<string, { groupName: string; memberIds: string[] }>();

    for (const orgUser of orgUsersResponse.data) {
      // Build user metadata map
      if (orgUser.id) {
        organizationUserDataMap.set(orgUser.id, {
          userId: orgUser.id,
          name: orgUser.name || orgUser.email,
          email: orgUser.email,
          avatarColor: orgUser.avatarColor,
          twoFactorEnabled: orgUser.twoFactorEnabled || false,
          usesKeyConnector: orgUser.usesKeyConnector || false,
          resetPasswordEnrolled: orgUser.resetPasswordEnrolled || false,
        });
      }

      // Build group member map
      if (orgUser.groups && orgUser.groups.length > 0) {
        for (const groupId of orgUser.groups) {
          let groupData = groupMemberMap.get(groupId);
          if (!groupData) {
            groupData = { groupName: "", memberIds: [] };
            groupMemberMap.set(groupId, groupData);
          }
          groupData.memberIds.push(orgUser.id);
        }
      }
    }

    this.logService.debug(
      `[MemberAccessReportService V2] Loaded ${collections.length} collections, ${organizationUserDataMap.size} users, ${groupMemberMap.size} groups`,
    );

    return { collectionMap, organizationUserDataMap, groupMemberMap };
  }

  /**
   * Maps ciphers to members using frontend collection mapping (V2)
   * @param ciphers - Array of cipher views
   * @param orgData - Organization data containing collections, users, and groups
   * @returns Array of member cipher access records
   */
  private _mapCiphersToMembersV2(
    ciphers: any[],
    orgData: MemberAccessDataV2,
  ): MemberCipherAccess[] {
    const accessList: MemberCipherAccess[] = [];

    for (const cipher of ciphers) {
      // Skip ciphers without collections or with placeholder/invalid IDs (matches V1 behavior)
      if (
        !cipher.collectionIds ||
        cipher.collectionIds.length === 0 ||
        !cipher.id ||
        cipher.id === "00000000-0000-0000-0000-000000000000"
      ) {
        continue;
      }

      for (const collectionId of cipher.collectionIds) {
        const collection = orgData.collectionMap.get(collectionId);
        if (!collection) {
          continue;
        }

        // Process direct user access
        for (const userAccess of collection.users) {
          accessList.push({
            userId: userAccess.id,
            cipherId: cipher.id,
            collectionId: collection.id,
            collectionName: collection.name,
            accessType: "direct",
            readOnly: userAccess.readOnly,
            hidePasswords: userAccess.hidePasswords,
            manage: userAccess.manage,
          });
        }

        // Process group access
        for (const groupAccess of collection.groups) {
          const groupData = orgData.groupMemberMap.get(groupAccess.id);
          if (!groupData) {
            continue;
          }

          for (const userId of groupData.memberIds) {
            accessList.push({
              userId,
              cipherId: cipher.id,
              collectionId: collection.id,
              collectionName: collection.name,
              groupId: groupAccess.id,
              groupName: groupData.groupName,
              accessType: "group",
              readOnly: groupAccess.readOnly,
              hidePasswords: groupAccess.hidePasswords,
              manage: groupAccess.manage,
            });
          }
        }
      }
    }

    this.logService.debug(
      `[MemberAccessReportService V2] Mapped ${ciphers.length} ciphers to ${accessList.length} access records`,
    );

    return accessList;
  }

  /**
   * Generate member access report using V2 frontend mapping
   *
   * @param organizationId - The organization ID
   * @returns Promise of MemberAccessReportView array
   */
  async generateMemberAccessReportViewV2(
    organizationId: OrganizationId,
  ): Promise<MemberAccessReportView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    this.logService.debug("[MemberAccessReportService V2] Starting report generation");

    // Load organization data
    const orgData = await this._loadOrganizationDataV2(organizationId, userId);

    // Get all org ciphers
    const ciphers = await this.cipherService.getAllFromApiForOrganization(organizationId);

    // Map ciphers to members
    const accessList = this._mapCiphersToMembersV2(ciphers, orgData);

    // Aggregate by user
    const userAccessMap = new Map<
      string,
      {
        collections: Set<string>;
        groups: Set<string>;
        items: Set<string>;
      }
    >();

    for (const access of accessList) {
      let userData = userAccessMap.get(access.userId);
      if (!userData) {
        userData = {
          collections: new Set(),
          groups: new Set(),
          items: new Set(),
        };
        userAccessMap.set(access.userId, userData);
      }

      userData.collections.add(access.collectionId);
      if (access.groupId) {
        userData.groups.add(access.groupId);
      }
      userData.items.add(access.cipherId);
    }

    // Build report views
    const reportViews: MemberAccessReportView[] = [];
    for (const [userId, data] of userAccessMap.entries()) {
      const metadata = orgData.organizationUserDataMap.get(userId);
      if (!metadata) {
        continue;
      }

      reportViews.push({
        userGuid: userId as Guid,
        name: metadata.name,
        email: metadata.email,
        avatarColor: metadata.avatarColor,
        collectionsCount: data.collections.size,
        groupsCount: data.groups.size,
        itemsCount: data.items.size,
        usesKeyConnector: metadata.usesKeyConnector,
      });
    }

    this.logService.debug(
      `[MemberAccessReportService V2] Generated report for ${reportViews.length} users`,
    );

    return reportViews;
  }

  /**
   * Generate export items using V2 frontend mapping
   *
   * @param organizationId  The organization ID
   * @returns Promise of MemberAccessExportItem array
   */
  async generateUserReportExportItemsV2(
    organizationId: OrganizationId,
  ): Promise<MemberAccessExportItem[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const orgData = await this._loadOrganizationDataV2(organizationId, userId);
    const ciphers = await this.cipherService.getAllFromApiForOrganization(organizationId);
    const accessList = this._mapCiphersToMembersV2(ciphers, orgData);

    // Group access records by (userId, collectionId, groupId)
    const groupedAccess = new Map<string, MemberCipherAccess[]>();
    for (const access of accessList) {
      // Use groupId if present, otherwise use "direct" to distinguish direct access
      const key = `${access.userId}|${access.collectionId}|${access.groupId ?? "direct"}`;
      if (!groupedAccess.has(key)) {
        groupedAccess.set(key, []);
      }
      groupedAccess.get(key).push(access);
    }

    // Pre-fetch i18n strings to avoid repeated lookups
    const twoFactorEnabledTrue = this.i18nService.t("memberAccessReportTwoFactorEnabledTrue");
    const twoFactorEnabledFalse = this.i18nService.t("memberAccessReportTwoFactorEnabledFalse");
    const accountRecoveryEnabledTrue = this.i18nService.t(
      "memberAccessReportAuthenticationEnabledTrue",
    );
    const accountRecoveryEnabledFalse = this.i18nService.t(
      "memberAccessReportAuthenticationEnabledFalse",
    );
    const noGroup = this.i18nService.t("memberAccessReportNoGroup");
    const noCollection = this.i18nService.t("memberAccessReportNoCollection");
    const noCollectionPermission = this.i18nService.t("memberAccessReportNoCollectionPermission");

    const exportItems: MemberAccessExportItem[] = [];
    for (const accesses of groupedAccess.values()) {
      // All records in this group share the same user/collection/group, so use the first for metadata
      const access = accesses[0];
      const metadata = orgData.organizationUserDataMap.get(access.userId);

      exportItems.push({
        email: metadata?.email ?? "",
        name: metadata?.name ?? "",
        twoStepLogin: metadata?.twoFactorEnabled ? twoFactorEnabledTrue : twoFactorEnabledFalse,
        accountRecovery: metadata?.resetPasswordEnrolled
          ? accountRecoveryEnabledTrue
          : accountRecoveryEnabledFalse,
        group: access.groupName || noGroup,
        collection: access.collectionName || noCollection,
        collectionPermission: access.collectionId
          ? this.getPermissionTextFromAccess(access)
          : noCollectionPermission,
        totalItems: accesses.length.toString(), // Count of ciphers in this access path
      });
    }

    return exportItems;
  }
}
