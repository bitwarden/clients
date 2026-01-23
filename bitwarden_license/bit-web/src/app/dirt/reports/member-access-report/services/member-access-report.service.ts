// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { BehaviorSubject, firstValueFrom, Observable } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  CollectionAccessSelectionView,
  CollectionAdminView,
} from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Guid, OrganizationId } from "@bitwarden/common/types/guid";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { KeyService } from "@bitwarden/key-management";
import { GroupApiService } from "@bitwarden/web-vault/app/admin-console/organizations/core/services/group/group-api.service";
import { GroupDetailsView } from "@bitwarden/web-vault/app/admin-console/organizations/core/views/group-details.view";
import {
  getPermissionList,
  convertToPermission,
} from "@bitwarden/web-vault/app/admin-console/organizations/shared/components/access-selector";

import { MemberAccessProgress, MemberAccessProgressState } from "../model/member-access-progress";
import { MemberAccessExportItem } from "../view/member-access-export.view";
import { MemberAccessReportView } from "../view/member-access-report.view";

/**
 * Internal interface for collection access tracking
 */
interface CollectionAccess {
  collectionId: string;
  collectionName: string;
  readOnly: boolean;
  hidePasswords: boolean;
  manage: boolean;
  /** Group ID if access is via group, null for direct access */
  viaGroupId: string | null;
  /** Group name if access is via group, null for direct access */
  viaGroupName: string | null;
}

/**
 * Internal interface for member data from the API
 */
interface MemberData {
  id: string;
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  resetPasswordEnrolled: boolean;
  usesKeyConnector: boolean;
  groups: string[];
  avatarColor: string | null;
}

/**
 * Lookup maps for efficient data access during member processing
 */
interface LookupMaps {
  /** Map: userId → direct collection access[] */
  userCollectionMap: Map<string, CollectionAccess[]>;
  /** Map: groupId → collection access[] */
  groupCollectionMap: Map<string, CollectionAccess[]>;
  /** Map: userId → groupId[] */
  userGroupMap: Map<string, string[]>;
  /** Map: collectionId → cipher count */
  collectionCipherCountMap: Map<string, number>;
  /** Map: groupId → group name */
  groupNameMap: Map<string, string>;
  /** Map: collectionId → collection name (decrypted) */
  collectionNameMap: Map<string, string>;
}

@Injectable({ providedIn: "root" })
export class MemberAccessReportService {
  /** Progress tracking subject for UI updates */
  private progressSubject = new BehaviorSubject<MemberAccessProgressState | null>(null);

  /** Observable for progress state updates */
  progress$: Observable<MemberAccessProgressState | null> = this.progressSubject.asObservable();

  /** Cached lookup maps for export generation */
  private cachedLookupMaps: LookupMaps | null = null;
  private cachedMembers: MemberData[] | null = null;

  constructor(
    private i18nService: I18nService,
    private encryptService: EncryptService,
    private keyService: KeyService,
    private accountService: AccountService,
    private organizationUserApiService: OrganizationUserApiService,
    private collectionAdminService: CollectionAdminService,
    private groupApiService: GroupApiService,
    private apiService: ApiService,
  ) {}

  /**
   * Generates the Member Access Report using frontend-driven data fetching.
   * Makes multiple lightweight API calls instead of a single heavy endpoint.
   *
   * @param organizationId - The organization to generate the report for
   * @returns Array of aggregated member access views for display
   */
  async generateMemberAccessReportView(
    organizationId: OrganizationId,
  ): Promise<MemberAccessReportView[]> {
    // Clear cached data on new report generation
    this.cachedLookupMaps = null;
    this.cachedMembers = null;

    // Step 1: Fetch members with their group memberships
    this.emitProgress(MemberAccessProgress.FetchingMembers, 0, 0);
    const members = await this.fetchMembers(organizationId);

    // Step 2: Fetch collections with access details
    this.emitProgress(MemberAccessProgress.FetchingCollections, 0, members.length);
    const collections = await this.fetchCollections(organizationId);

    // Step 3: Fetch groups with details
    this.emitProgress(MemberAccessProgress.FetchingGroups, 0, members.length);
    const groups = await this.fetchGroups(organizationId);

    // Step 4: Fetch organization ciphers for counting
    this.emitProgress(MemberAccessProgress.FetchingCipherCounts, 0, members.length);
    const ciphers = await this.fetchOrganizationCiphers(organizationId);

    // Step 5: Build lookup maps
    this.emitProgress(MemberAccessProgress.BuildingMaps, 0, members.length);
    const lookupMaps = this.buildLookupMaps(members, collections, groups, ciphers);

    // Cache for export
    this.cachedLookupMaps = lookupMaps;
    this.cachedMembers = members;

    // Step 6: Process each member with progress tracking
    // Batch progress updates to avoid RxJS backpressure (emit every ~2% or minimum every 10 members)
    const results: MemberAccessReportView[] = [];
    const progressInterval = Math.max(10, Math.floor(members.length / 50));

    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      const view = this.processMemberForView(member, lookupMaps);
      results.push(view);

      // Only emit progress at intervals to avoid flooding the UI
      if ((i + 1) % progressInterval === 0 || i === members.length - 1) {
        this.emitProgress(MemberAccessProgress.ProcessingMembers, i + 1, members.length);
      }
    }

    // Step 7: Complete
    this.emitProgress(MemberAccessProgress.Complete, members.length, members.length);

    return results;
  }

  /**
   * Generates detailed export items with one row per user-collection-permission combination.
   *
   * @param organizationId - The organization to generate export for
   * @returns Array of export items for CSV generation
   */
  async generateUserReportExportItems(
    organizationId: OrganizationId,
  ): Promise<MemberAccessExportItem[]> {
    // Use cached data if available, otherwise fetch fresh
    let lookupMaps = this.cachedLookupMaps;
    let members = this.cachedMembers;

    if (!lookupMaps || !members) {
      // Need to fetch data - this happens if export is called without generating report first
      const freshMembers = await this.fetchMembers(organizationId);
      const collections = await this.fetchCollections(organizationId);
      const groups = await this.fetchGroups(organizationId);
      const ciphers = await this.fetchOrganizationCiphers(organizationId);
      lookupMaps = this.buildLookupMaps(freshMembers, collections, groups, ciphers);
      members = freshMembers;
    }

    return this.generateExportData(lookupMaps, members);
  }

  /**
   * Emits a progress update to subscribers
   */
  private emitProgress(
    step: (typeof MemberAccessProgress)[keyof typeof MemberAccessProgress],
    processedMembers: number,
    totalMembers: number,
  ): void {
    this.progressSubject.next({
      step,
      processedMembers,
      totalMembers,
      message: "",
    });
  }

  /**
   * Fetches all organization members with their group memberships
   */
  private async fetchMembers(organizationId: OrganizationId): Promise<MemberData[]> {
    const response = await this.organizationUserApiService.getAllUsers(organizationId, {
      includeGroups: true,
    });

    return response.data.map((user) => ({
      id: user.id,
      name: user.name || "",
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      resetPasswordEnrolled: user.resetPasswordEnrolled,
      usesKeyConnector: user.usesKeyConnector,
      groups: user.groups || [],
      avatarColor: user.avatarColor || null,
    }));
  }

  /**
   * Fetches all collections with user and group access details
   */
  private async fetchCollections(organizationId: OrganizationId): Promise<CollectionAdminView[]> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await firstValueFrom(
      this.collectionAdminService.collectionAdminViews$(organizationId, activeUserId),
    );
  }

  /**
   * Fetches all groups with their collection access
   */
  private async fetchGroups(organizationId: OrganizationId): Promise<GroupDetailsView[]> {
    return await this.groupApiService.getAllDetails(organizationId);
  }

  /**
   * Fetches all organization ciphers for counting per collection
   */
  private async fetchOrganizationCiphers(
    organizationId: OrganizationId,
  ): Promise<CipherResponse[]> {
    const response = await this.apiService.getCiphersOrganization(organizationId);
    return response.data;
  }

  /**
   * Builds efficient lookup maps from the fetched data for O(1) access during member processing
   */
  private buildLookupMaps(
    members: MemberData[],
    collections: CollectionAdminView[],
    groups: GroupDetailsView[],
    ciphers: CipherResponse[],
  ): LookupMaps {
    const userCollectionMap = new Map<string, CollectionAccess[]>();
    const groupCollectionMap = new Map<string, CollectionAccess[]>();
    const userGroupMap = new Map<string, string[]>();
    const collectionCipherCountMap = new Map<string, number>();
    const groupNameMap = new Map<string, string>();
    const collectionNameMap = new Map<string, string>();

    // Build collectionCipherCountMap by iterating ciphers and counting per collection
    // Each cipher has collectionIds[] - a cipher in 3 collections adds 1 to each collection's count
    for (const cipher of ciphers) {
      for (const collectionId of cipher.collectionIds || []) {
        const currentCount = collectionCipherCountMap.get(collectionId) || 0;
        collectionCipherCountMap.set(collectionId, currentCount + 1);
      }
    }

    // Build groupNameMap
    for (const group of groups) {
      groupNameMap.set(group.id, group.name);
    }

    // Build collectionNameMap and userCollectionMap from collections
    for (const collection of collections) {
      collectionNameMap.set(collection.id, collection.name);

      // Build userCollectionMap from collections.users
      for (const userAccess of collection.users || []) {
        const existing = userCollectionMap.get(userAccess.id) || [];
        existing.push({
          collectionId: collection.id,
          collectionName: collection.name,
          readOnly: userAccess.readOnly,
          hidePasswords: userAccess.hidePasswords,
          manage: userAccess.manage,
          viaGroupId: null,
          viaGroupName: null,
        });
        userCollectionMap.set(userAccess.id, existing);
      }

      // Build groupCollectionMap from collections.groups
      for (const groupAccess of collection.groups || []) {
        const existing = groupCollectionMap.get(groupAccess.id) || [];
        existing.push({
          collectionId: collection.id,
          collectionName: collection.name,
          readOnly: groupAccess.readOnly,
          hidePasswords: groupAccess.hidePasswords,
          manage: groupAccess.manage,
          viaGroupId: groupAccess.id,
          viaGroupName: groupNameMap.get(groupAccess.id) || null,
        });
        groupCollectionMap.set(groupAccess.id, existing);
      }
    }

    // Build userGroupMap from members.groups
    for (const member of members) {
      if (member.groups?.length) {
        userGroupMap.set(member.id, member.groups);
      }
    }

    return {
      userCollectionMap,
      groupCollectionMap,
      userGroupMap,
      collectionCipherCountMap,
      groupNameMap,
      collectionNameMap,
    };
  }

  /**
   * Processes a single member to calculate their aggregated access for the table view
   */
  private processMemberForView(member: MemberData, lookupMaps: LookupMaps): MemberAccessReportView {
    const { userCollectionMap, groupCollectionMap, userGroupMap, collectionCipherCountMap } =
      lookupMaps;

    // Get direct collection access
    const directAccess = userCollectionMap.get(member.id) || [];

    // Get group-based collection access
    const memberGroups = userGroupMap.get(member.id) || [];
    const groupAccess: CollectionAccess[] = [];
    for (const groupId of memberGroups) {
      const groupCollections = groupCollectionMap.get(groupId) || [];
      groupAccess.push(...groupCollections);
    }

    // Get unique collection IDs (direct access takes precedence in case of overlap)
    const allCollectionIds = new Set([
      ...directAccess.map((a) => a.collectionId),
      ...groupAccess.map((a) => a.collectionId),
    ]);

    // Calculate total items by summing cipher counts for all accessible collections
    let totalItems = 0;
    for (const collectionId of allCollectionIds) {
      totalItems += collectionCipherCountMap.get(collectionId) || 0;
    }

    return {
      userGuid: member.id as Guid,
      name: member.name,
      email: member.email,
      collectionsCount: allCollectionIds.size,
      groupsCount: memberGroups.length,
      itemsCount: totalItems,
      usesKeyConnector: member.usesKeyConnector,
      avatarColor: member.avatarColor,
    };
  }

  /**
   * Generates detailed export data with one row per user-collection access
   */
  private generateExportData(
    lookupMaps: LookupMaps,
    members: MemberData[],
  ): MemberAccessExportItem[] {
    const {
      userCollectionMap,
      groupCollectionMap,
      userGroupMap,
      collectionCipherCountMap,
      groupNameMap,
    } = lookupMaps;

    const exportItems: MemberAccessExportItem[] = [];

    for (const member of members) {
      const directAccess = userCollectionMap.get(member.id) || [];
      const memberGroups = userGroupMap.get(member.id) || [];

      // Track which collections have been exported for this member to handle deduplication
      const exportedCollections = new Set<string>();

      // Export direct collection access (group = "No Group")
      for (const access of directAccess) {
        exportItems.push({
          email: member.email,
          name: member.name,
          twoStepLogin: member.twoFactorEnabled
            ? this.i18nService.t("memberAccessReportTwoFactorEnabledTrue")
            : this.i18nService.t("memberAccessReportTwoFactorEnabledFalse"),
          accountRecovery: member.resetPasswordEnrolled
            ? this.i18nService.t("memberAccessReportAuthenticationEnabledTrue")
            : this.i18nService.t("memberAccessReportAuthenticationEnabledFalse"),
          group: this.i18nService.t("memberAccessReportNoGroup"),
          collection: access.collectionName || this.i18nService.t("memberAccessReportNoCollection"),
          collectionPermission: this.getPermissionText(access),
          totalItems: String(collectionCipherCountMap.get(access.collectionId) || 0),
        });
        exportedCollections.add(access.collectionId);
      }

      // Export group-based collection access
      for (const groupId of memberGroups) {
        const groupCollections = groupCollectionMap.get(groupId) || [];
        const groupName = groupNameMap.get(groupId) || "Unknown Group";

        for (const access of groupCollections) {
          exportItems.push({
            email: member.email,
            name: member.name,
            twoStepLogin: member.twoFactorEnabled
              ? this.i18nService.t("memberAccessReportTwoFactorEnabledTrue")
              : this.i18nService.t("memberAccessReportTwoFactorEnabledFalse"),
            accountRecovery: member.resetPasswordEnrolled
              ? this.i18nService.t("memberAccessReportAuthenticationEnabledTrue")
              : this.i18nService.t("memberAccessReportAuthenticationEnabledFalse"),
            group: groupName,
            collection:
              access.collectionName || this.i18nService.t("memberAccessReportNoCollection"),
            collectionPermission: this.getPermissionText(access),
            totalItems: String(collectionCipherCountMap.get(access.collectionId) || 0),
          });
        }
      }

      // If member has no collection access at all, add a single row showing that
      if (directAccess.length === 0 && memberGroups.length === 0) {
        exportItems.push({
          email: member.email,
          name: member.name,
          twoStepLogin: member.twoFactorEnabled
            ? this.i18nService.t("memberAccessReportTwoFactorEnabledTrue")
            : this.i18nService.t("memberAccessReportTwoFactorEnabledFalse"),
          accountRecovery: member.resetPasswordEnrolled
            ? this.i18nService.t("memberAccessReportAuthenticationEnabledTrue")
            : this.i18nService.t("memberAccessReportAuthenticationEnabledFalse"),
          group: this.i18nService.t("memberAccessReportNoGroup"),
          collection: this.i18nService.t("memberAccessReportNoCollection"),
          collectionPermission: this.i18nService.t("memberAccessReportNoCollectionPermission"),
          totalItems: "0",
        });
      }
    }

    return exportItems;
  }

  /**
   * Converts collection access permissions to localized display text
   */
  private getPermissionText(access: CollectionAccess): string {
    const permissionList = getPermissionList();
    const collectionSelectionView = new CollectionAccessSelectionView({
      id: access.collectionId,
      readOnly: access.readOnly,
      hidePasswords: access.hidePasswords,
      manage: access.manage,
    });
    return this.i18nService.t(
      permissionList.find((p) => p.perm === convertToPermission(collectionSelectionView))?.labelId,
    );
  }
}
