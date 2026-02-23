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
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { KeyService } from "@bitwarden/key-management";
import { GroupApiService } from "@bitwarden/web-vault/app/admin-console/organizations/core";
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
    private groupApiService: GroupApiService,
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
   * @deprecated Use getPermissionTextCached with pre-built lookup map for better performance
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

  /**
   * Get permission text using cached lookup map (performance optimized)
   * @param access - Access details
   * @param permissionLookup - Pre-built map of permission to label ID
   * @private
   */
  private getPermissionTextCached(
    access: {
      groupId?: string;
      collectionId: string;
      readOnly: boolean;
      hidePasswords: boolean;
      manage: boolean;
    },
    permissionLookup: Map<string, string>,
  ): string {
    const collectionSelectionView = new CollectionAccessSelectionView({
      id: access.groupId ?? access.collectionId,
      readOnly: access.readOnly,
      hidePasswords: access.hidePasswords,
      manage: access.manage,
    });
    const perm = convertToPermission(collectionSelectionView);
    const labelId = permissionLookup.get(perm);
    return this.i18nService.t(labelId ?? "");
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

    // Fetch collections, users, and groups in parallel
    const [collections, orgUsersResponse, groups] = await Promise.all([
      firstValueFrom(
        this.collectionAdminService
          .collectionAdminViews$(organizationId, currentUserId)
          .pipe(take(1)),
      ),
      this.organizationUserApiService.getAllUsers(organizationId, { includeGroups: true }),
      this.groupApiService.getAll(organizationId),
    ]);

    // Build collection map
    const collectionMap = new Map<string, CollectionAdminView>();
    collections.forEach((c) => collectionMap.set(c.id, c));

    // Build group name lookup map
    const groupNameMap = new Map<string, string>();
    groups.forEach((g) => groupNameMap.set(g.id, g.name));

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
            groupData = {
              groupName: groupNameMap.get(groupId) || "",
              memberIds: [],
            };
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
   *
   * Groups by (user, collection, group) access path and tracks cipher IDs in Sets
   * to avoid creating redundant objects for large organizations.
   *
   * @param ciphers - Array of cipher views
   * @param orgData - Organization data containing collections, users, and groups
   * @returns Map of access paths with cipher ID sets
   */
  private _mapCiphersToMembersV2(
    ciphers: CipherView[],
    orgData: MemberAccessDataV2,
  ): Map<string, { access: MemberCipherAccess; cipherIds: Set<string> }> {
    const accessMap = new Map<string, { access: MemberCipherAccess; cipherIds: Set<string> }>();

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
          const key = `${userAccess.id}|${collection.id}|direct`;
          let entry = accessMap.get(key);

          if (!entry) {
            // First cipher for this access path - create new entry
            entry = {
              access: {
                userId: userAccess.id,
                cipherId: cipher.id, // Representative cipher (for backward compatibility)
                collectionId: collection.id,
                collectionName: collection.name,
                accessType: "direct",
                readOnly: userAccess.readOnly,
                hidePasswords: userAccess.hidePasswords,
                manage: userAccess.manage,
              },
              cipherIds: new Set([cipher.id]),
            };
            accessMap.set(key, entry);
          } else {
            // Add cipher to existing access path
            entry.cipherIds.add(cipher.id);
          }
        }

        // Process group access
        for (const groupAccess of collection.groups) {
          const groupData = orgData.groupMemberMap.get(groupAccess.id);
          if (!groupData) {
            continue;
          }

          for (const userId of groupData.memberIds) {
            const key = `${userId}|${collection.id}|${groupAccess.id}`;
            let entry = accessMap.get(key);

            if (!entry) {
              // First cipher for this access path - create new entry
              entry = {
                access: {
                  userId,
                  cipherId: cipher.id, // Representative cipher (for backward compatibility)
                  collectionId: collection.id,
                  collectionName: collection.name,
                  groupId: groupAccess.id,
                  groupName: groupData.groupName,
                  accessType: "group",
                  readOnly: groupAccess.readOnly,
                  hidePasswords: groupAccess.hidePasswords,
                  manage: groupAccess.manage,
                },
                cipherIds: new Set([cipher.id]),
              };
              accessMap.set(key, entry);
            } else {
              // Add cipher to existing access path
              entry.cipherIds.add(cipher.id);
            }
          }
        }
      }
    }

    this.logService.debug(
      `[MemberAccessReportService V2] Mapped ${ciphers.length} ciphers to ${accessMap.size} access paths`,
    );

    return accessMap;
  }

  /**
   * Fetch ciphers with 5-minute timeout protection
   * @private
   */
  private async _fetchCiphersWithTimeout(organizationId: OrganizationId): Promise<CipherView[]> {
    const TIMEOUT_MS = 300000; // 5 minutes
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            "Cipher fetch timed out after 5 minutes. Organization may be too large for this report. Please contact support.",
          ),
        );
      }, TIMEOUT_MS);
    });

    const fetchPromise = this.cipherService.getAllFromApiForOrganization(organizationId);

    return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
      clearTimeout(timeoutId);
    });
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

    // Log organization complexity
    this.logService.info(
      `[MemberAccessReport V2] Organization size: ${orgData.organizationUserDataMap.size} users, ${orgData.collectionMap.size} collections`,
    );

    // Get all org ciphers with timeout protection
    const ciphers = await this._fetchCiphersWithTimeout(organizationId);

    this.logService.info(`[MemberAccessReport V2] Fetched ${ciphers.length} ciphers`);

    // Map ciphers to members
    const accessMap = this._mapCiphersToMembersV2(ciphers, orgData);

    // Aggregate by user
    const userAccessMap = new Map<
      string,
      {
        collections: Set<string>;
        groups: Set<string>;
        items: Set<string>;
      }
    >();

    for (const { access, cipherIds } of accessMap.values()) {
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
      // Add all ciphers from this access path
      for (const cipherId of cipherIds) {
        userData.items.add(cipherId);
      }
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
    const ciphers = await this._fetchCiphersWithTimeout(organizationId);
    const accessMap = this._mapCiphersToMembersV2(ciphers, orgData);

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

    // Build permission lookup map once instead of calling getPermissionList() for each item
    const permissionList = getPermissionList();
    const permissionLookup = new Map<string, string>();
    permissionList.forEach((p) => {
      permissionLookup.set(p.perm, p.labelId);
    });

    const exportItems: MemberAccessExportItem[] = [];
    for (const { access, cipherIds } of accessMap.values()) {
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
          ? this.getPermissionTextCached(access, permissionLookup)
          : noCollectionPermission,
        totalItems: cipherIds.size.toString(),
      });
    }

    return exportItems;
  }
}
