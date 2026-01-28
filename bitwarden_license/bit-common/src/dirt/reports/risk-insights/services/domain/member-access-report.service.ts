import { Injectable } from "@angular/core";
import { Observable, catchError, from, map, of, switchMap, tap } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import {
  EffectivePermissionLevel,
  MemberAccessDetailView,
  MemberAccessReportProgressiveResult,
  MemberAccessReportState,
  MemberAccessSummary,
  MemberCollectionAccessDetail,
} from "../../models/member-access-report.types";

import {
  CipherAccessMappingService,
  CipherAccessPath,
  CipherMemberAccess,
  CipherWithMemberAccess,
  EffectiveCipherPermissions,
  MemberAccessLoadState,
} from "./cipher-access-mapping.service";

/**
 * Internal accumulator for building member summaries as cipher batches arrive.
 * Tracks sets for deduplication and accumulates counts.
 */
interface MemberAccumulator {
  userId: string;
  email: string;
  name: string | null;
  cipherIds: Set<string>;
  collectionIds: Set<string>;
  groupIds: Set<string>;
  /** Tracks if member has at least one manage permission */
  hasManage: boolean;
  /** Tracks if member has at least one edit (non-readOnly) permission */
  hasEdit: boolean;
  /** Tracks if member can view passwords (at least one non-hidePasswords) */
  hasViewPasswords: boolean;
}

/**
 * Service for generating member-centric access reports from cipher data.
 *
 * This service provides a faster alternative to the server-side member access report
 * by leveraging the client-side CipherAccessMappingService infrastructure.
 *
 * The core algorithm pivots cipher-centric data (cipher -> members[]) to
 * member-centric data (member -> {cipherCount, collectionCount, groupCount, permission}).
 *
 * Use Cases:
 * - Faster member access reports using client-side data
 * - Progressive loading for large organizations
 * - Auditing member access across the organization
 */
@Injectable()
export class MemberAccessReportService {
  constructor(
    private readonly cipherService: CipherService,
    private readonly cipherAccessMappingService: CipherAccessMappingService,
    private readonly logService: LogService,
  ) {}

  /**
   * Generates member access summaries with progressive loading.
   * Emits partial results as cipher batches are processed.
   *
   * @param organizationId - The organization to generate the report for
   * @param currentUserId - The current user's ID (for collection fetching)
   * @returns Observable that emits progressive results after each batch
   */
  getMemberAccessSummariesProgressive$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<MemberAccessReportProgressiveResult> {
    this.logService.info(
      `[MemberAccessReportService] Starting progressive member access report for org ${organizationId}`,
    );

    // Phase 1: Fetch all ciphers
    return from(this.cipherService.getAllFromApiForOrganization(organizationId)).pipe(
      tap((ciphers) => {
        this.logService.info(
          `[MemberAccessReportService] Fetched ${ciphers.length} ciphers for org ${organizationId}`,
        );
      }),
      // Phase 2: Stream cipher-member mapping and pivot to member summaries
      switchMap((ciphers) => {
        if (ciphers.length === 0) {
          // No ciphers, return empty result immediately
          return of<MemberAccessReportProgressiveResult>({
            state: MemberAccessReportState.Complete,
            members: [],
            processedCipherCount: 0,
            totalCipherCount: 0,
            progressPercent: 100,
          });
        }

        // Accumulator persists across batches to build complete member data
        const memberAccumulators = new Map<string, MemberAccumulator>();

        return this.cipherAccessMappingService
          .getAllCiphersWithMemberAccessProgressive$(organizationId, currentUserId, ciphers, 500)
          .pipe(
            map((progressResult) => {
              // Process the latest batch of ciphers into member accumulators
              this.processCipherBatchIntoAccumulators(
                progressResult.processedCiphers,
                memberAccumulators,
              );

              // Convert accumulators to summaries
              const members = this.convertAccumulatorsToSummaries(memberAccumulators);

              // Map states
              let state: MemberAccessReportState;
              if (progressResult.state === MemberAccessLoadState.Complete) {
                state = MemberAccessReportState.Complete;
              } else if (progressResult.state === MemberAccessLoadState.Error) {
                state = MemberAccessReportState.Error;
              } else {
                state = MemberAccessReportState.ProcessingMembers;
              }

              const result: MemberAccessReportProgressiveResult = {
                state,
                members,
                processedCipherCount: progressResult.processedCount,
                totalCipherCount: progressResult.totalCipherCount,
                progressPercent: progressResult.progressPercent,
                error: progressResult.error,
              };

              if (state === MemberAccessReportState.Complete) {
                this.logService.info(
                  `[MemberAccessReportService] Report complete: ${members.length} members across ${progressResult.totalCipherCount} ciphers`,
                );
              }

              return result;
            }),
          );
      }),
      catchError((error: unknown) => {
        this.logService.error("[MemberAccessReportService] Error generating report", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error occurred during member access report generation";

        return of<MemberAccessReportProgressiveResult>({
          state: MemberAccessReportState.Error,
          members: [],
          processedCipherCount: 0,
          totalCipherCount: 0,
          progressPercent: 0,
          error: errorMessage,
        });
      }),
    );
  }

  /**
   * Generates member access summaries (non-progressive, complete result only).
   * Waits for all cipher batches to complete before returning.
   *
   * @param organizationId - The organization to generate the report for
   * @param currentUserId - The current user's ID (for collection fetching)
   * @returns Observable that emits the complete member summary list
   */
  getMemberAccessSummaries$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<MemberAccessSummary[]> {
    return this.getMemberAccessSummariesProgressive$(organizationId, currentUserId).pipe(
      // Only emit when complete
      map((result) => {
        if (result.state === MemberAccessReportState.Complete) {
          return result.members;
        }
        // Return empty array for intermediate states (will be filtered by last())
        return [];
      }),
      // Filter to only get the final complete result
      map((members, index) => {
        // We rely on the final emission from the progressive stream
        return members;
      }),
    );
  }

  /**
   * Retrieves detailed access information for a specific member.
   * Returns collection-level breakdown with cipher counts and permissions.
   *
   * @param organizationId - The organization to query
   * @param currentUserId - The current user's ID (for collection fetching)
   * @param targetUserId - The member's user ID to get details for
   * @returns Observable that emits the detail view, or null if member not found
   */
  getMemberAccessDetail$(
    organizationId: OrganizationId,
    currentUserId: UserId,
    targetUserId: string,
  ): Observable<MemberAccessDetailView | null> {
    this.logService.info(
      `[MemberAccessReportService] Getting access detail for user ${targetUserId} in org ${organizationId}`,
    );

    return this.cipherAccessMappingService
      .findCiphersForUser$(organizationId, currentUserId, targetUserId)
      .pipe(
        map((userCiphers) => {
          if (userCiphers.length === 0) {
            this.logService.info(
              `[MemberAccessReportService] No ciphers found for user ${targetUserId}`,
            );
            return null;
          }

          return this.transformToDetailView(userCiphers, targetUserId);
        }),
        catchError((error: unknown) => {
          this.logService.error(
            `[MemberAccessReportService] Error getting member detail for ${targetUserId}`,
            error,
          );
          return of(null);
        }),
      );
  }

  /**
   * Pivots an array of cipher-member data to member summaries.
   * This is the core transformation logic, exposed for direct use or testing.
   *
   * @param ciphersWithMembers - Array of ciphers with their member access data
   * @returns Array of member access summaries
   */
  pivotCipherDataToMemberSummaries(
    ciphersWithMembers: CipherWithMemberAccess[],
  ): MemberAccessSummary[] {
    const memberAccumulators = new Map<string, MemberAccumulator>();
    this.processCipherBatchIntoAccumulators(ciphersWithMembers, memberAccumulators);
    return this.convertAccumulatorsToSummaries(memberAccumulators);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Processes a batch of ciphers with member access data into the accumulator map.
   * Updates existing accumulators or creates new ones as needed.
   *
   * @param ciphersWithMembers - Batch of ciphers with member access
   * @param accumulators - Map to accumulate member data into
   */
  private processCipherBatchIntoAccumulators(
    ciphersWithMembers: CipherWithMemberAccess[],
    accumulators: Map<string, MemberAccumulator>,
  ): void {
    for (const cipherData of ciphersWithMembers) {
      const cipherId = cipherData.cipher.id;

      for (const memberAccess of cipherData.members) {
        this.updateAccumulatorFromMemberAccess(accumulators, cipherId, memberAccess);
      }
    }
  }

  /**
   * Updates or creates an accumulator for a member based on their access to a cipher.
   *
   * @param accumulators - The accumulator map
   * @param cipherId - The cipher ID being processed
   * @param memberAccess - The member's access data for this cipher
   */
  private updateAccumulatorFromMemberAccess(
    accumulators: Map<string, MemberAccumulator>,
    cipherId: string,
    memberAccess: CipherMemberAccess,
  ): void {
    const userId = memberAccess.userId;

    // Get or create accumulator
    let accumulator = accumulators.get(userId);
    if (!accumulator) {
      accumulator = {
        userId,
        email: memberAccess.email ?? "(unknown)",
        name: null, // Name is not available in CipherMemberAccess
        cipherIds: new Set<string>(),
        collectionIds: new Set<string>(),
        groupIds: new Set<string>(),
        hasManage: false,
        hasEdit: false,
        hasViewPasswords: false,
      };
      accumulators.set(userId, accumulator);
    }

    // Add cipher to the set (deduplication)
    accumulator.cipherIds.add(cipherId);

    // Process access paths to collect collections and groups
    for (const accessPath of memberAccess.accessPaths) {
      this.processAccessPath(accumulator, accessPath);
    }

    // Update permission flags from effective permissions
    this.updatePermissionFlags(accumulator, memberAccess.effectivePermissions);
  }

  /**
   * Processes a single access path to extract collection and group IDs.
   *
   * @param accumulator - The member accumulator to update
   * @param accessPath - The access path to process
   */
  private processAccessPath(accumulator: MemberAccumulator, accessPath: CipherAccessPath): void {
    // Always add collection
    accumulator.collectionIds.add(accessPath.collectionId);

    // Add group if this is a group-based access path
    if (accessPath.type === "group" && accessPath.groupId) {
      accumulator.groupIds.add(accessPath.groupId);
    }
  }

  /**
   * Updates permission flags based on effective permissions.
   * Uses "most permissive" logic - if any path grants a permission, it's tracked.
   *
   * @param accumulator - The member accumulator to update
   * @param permissions - The effective permissions for this cipher access
   */
  private updatePermissionFlags(
    accumulator: MemberAccumulator,
    permissions: EffectiveCipherPermissions,
  ): void {
    if (permissions.canManage) {
      accumulator.hasManage = true;
    }
    if (permissions.canEdit) {
      accumulator.hasEdit = true;
    }
    if (permissions.canViewPasswords) {
      accumulator.hasViewPasswords = true;
    }
  }

  /**
   * Converts accumulator map to sorted array of member summaries.
   *
   * @param accumulators - Map of member accumulators
   * @returns Sorted array of member access summaries
   */
  private convertAccumulatorsToSummaries(
    accumulators: Map<string, MemberAccumulator>,
  ): MemberAccessSummary[] {
    const summaries: MemberAccessSummary[] = [];

    for (const accumulator of accumulators.values()) {
      summaries.push({
        userId: accumulator.userId,
        email: accumulator.email,
        name: accumulator.name,
        cipherCount: accumulator.cipherIds.size,
        collectionCount: accumulator.collectionIds.size,
        groupCount: accumulator.groupIds.size,
        highestPermission: this.calculateHighestPermission(accumulator),
      });
    }

    // Sort by cipher count descending, then by email ascending
    summaries.sort((a, b) => {
      if (b.cipherCount !== a.cipherCount) {
        return b.cipherCount - a.cipherCount;
      }
      return a.email.localeCompare(b.email);
    });

    return summaries;
  }

  /**
   * Calculates the highest permission level from accumulated flags.
   *
   * Permission hierarchy (highest to lowest):
   * 1. Manage - Full control including delete
   * 2. Edit - Can modify but not manage
   * 3. ViewOnly - Can view but not modify (readOnly: true, hidePasswords: false)
   * 4. HidePasswords - Most restricted (readOnly: true, hidePasswords: true)
   *
   * @param accumulator - The member accumulator with permission flags
   * @returns The highest effective permission level
   */
  private calculateHighestPermission(accumulator: MemberAccumulator): EffectivePermissionLevel {
    // Check in order of priority (highest to lowest)
    if (accumulator.hasManage) {
      return EffectivePermissionLevel.Manage;
    }
    if (accumulator.hasEdit) {
      return EffectivePermissionLevel.Edit;
    }
    if (accumulator.hasViewPasswords) {
      return EffectivePermissionLevel.ViewOnly;
    }
    // Default to most restricted if none of the above
    return EffectivePermissionLevel.HidePasswords;
  }

  /**
   * Transforms cipher access data into a member detail view.
   * Groups ciphers by collection+accessType+groupId to create access path summaries.
   *
   * @param userCiphers - Array of ciphers the user has access to
   * @param targetUserId - The user ID to extract details for
   * @returns MemberAccessDetailView with collection breakdown
   */
  private transformToDetailView(
    userCiphers: CipherWithMemberAccess[],
    targetUserId: string,
  ): MemberAccessDetailView {
    // Extract user info from first cipher's member data
    let email = "(unknown)";
    const name: string | null = null;

    for (const cipherData of userCiphers) {
      const memberData = cipherData.members.find((m) => m.userId === targetUserId);
      if (memberData?.email) {
        email = memberData.email;
        break;
      }
    }

    // Build a map keyed by "collectionId|accessType|groupId" to group ciphers by access path
    const accessPathMap = new Map<
      string,
      {
        collectionId: string;
        collectionName: string;
        accessType: "direct" | "group";
        groupId: string | null;
        groupName: string | null;
        permissions: { readOnly: boolean; hidePasswords: boolean; manage: boolean };
        cipherIds: Set<string>;
      }
    >();

    // Process each cipher and its access paths for this user
    for (const cipherData of userCiphers) {
      const memberData = cipherData.members.find((m) => m.userId === targetUserId);
      if (!memberData) {
        continue;
      }

      for (const accessPath of memberData.accessPaths) {
        const groupId = accessPath.type === "group" ? (accessPath.groupId ?? null) : null;
        const key = `${accessPath.collectionId}|${accessPath.type}|${groupId ?? ""}`;

        let pathData = accessPathMap.get(key);
        if (!pathData) {
          pathData = {
            collectionId: accessPath.collectionId,
            collectionName: accessPath.collectionName,
            accessType: accessPath.type,
            groupId: groupId,
            groupName: accessPath.type === "group" ? (accessPath.groupName ?? null) : null,
            permissions: { ...accessPath.permissions },
            cipherIds: new Set<string>(),
          };
          accessPathMap.set(key, pathData);
        }

        pathData.cipherIds.add(cipherData.cipher.id);
      }
    }

    // Convert to MemberCollectionAccessDetail array
    const collectionDetails: MemberCollectionAccessDetail[] = [];
    for (const pathData of accessPathMap.values()) {
      collectionDetails.push({
        collectionId: pathData.collectionId,
        collectionName: pathData.collectionName,
        cipherCount: pathData.cipherIds.size,
        permission: this.calculatePermissionFromFlags(pathData.permissions),
        accessType: pathData.accessType,
        groupName: pathData.groupName,
        groupId: pathData.groupId,
      });
    }

    // Sort by collection name, then by access type (direct first)
    collectionDetails.sort((a, b) => {
      const nameCompare = a.collectionName.localeCompare(b.collectionName);
      if (nameCompare !== 0) {
        return nameCompare;
      }
      // Direct access before group access
      if (a.accessType !== b.accessType) {
        return a.accessType === "direct" ? -1 : 1;
      }
      // If both are group access, sort by group name
      if (a.groupName && b.groupName) {
        return a.groupName.localeCompare(b.groupName);
      }
      return 0;
    });

    // Count unique ciphers
    const uniqueCipherIds = new Set<string>();
    for (const cipherData of userCiphers) {
      uniqueCipherIds.add(cipherData.cipher.id);
    }

    this.logService.info(
      `[MemberAccessReportService] Built detail view for ${email}: ${uniqueCipherIds.size} ciphers, ${collectionDetails.length} access paths`,
    );

    return {
      userId: targetUserId,
      email,
      name,
      totalCipherCount: uniqueCipherIds.size,
      collectionDetails,
    };
  }

  /**
   * Calculates permission level from raw permission flags.
   *
   * @param permissions - Raw permission flags from access path
   * @returns The effective permission level
   */
  private calculatePermissionFromFlags(permissions: {
    readOnly: boolean;
    hidePasswords: boolean;
    manage: boolean;
  }): EffectivePermissionLevel {
    if (permissions.manage) {
      return EffectivePermissionLevel.Manage;
    }
    if (!permissions.readOnly) {
      return EffectivePermissionLevel.Edit;
    }
    if (!permissions.hidePasswords) {
      return EffectivePermissionLevel.ViewOnly;
    }
    return EffectivePermissionLevel.HidePasswords;
  }
}
