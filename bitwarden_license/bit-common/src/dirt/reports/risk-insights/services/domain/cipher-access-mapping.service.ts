import { Injectable, inject } from "@angular/core";
import {
  catchError,
  combineLatest,
  concatMap,
  from,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
} from "rxjs";

import {
  CollectionAdminService,
  CollectionAdminView,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

/**
 * Represents a member's access to a cipher with permission details
 */
export interface CipherMemberAccess {
  userId: string;
  email: string | null;
  accessPaths: CipherAccessPath[];
  effectivePermissions: EffectiveCipherPermissions;
}

/**
 * Describes how a member gained access to a cipher
 */
export interface CipherAccessPath {
  type: "direct" | "group";
  collectionId: string;
  collectionName: string;
  groupId?: string;
  groupName?: string;
  permissions: {
    readOnly: boolean;
    hidePasswords: boolean;
    manage: boolean;
  };
}

/**
 * The effective permissions after combining all access paths
 */
export interface EffectiveCipherPermissions {
  canEdit: boolean; // Has at least one non-readOnly path
  canViewPasswords: boolean; // Has at least one non-hidePasswords path
  canManage: boolean; // Has at least one manage path
}

/**
 * Complete cipher with all members who have access
 */
export interface CipherWithMemberAccess {
  cipher: CipherView;
  members: CipherMemberAccess[];
  totalMemberCount: number;
  unassigned: boolean; // True if cipher has no collections
}

/**
 * Simplified mapping of cipher ID to user IDs
 */
export interface SimplifiedCipherAccessMap {
  cipherId: string;
  cipherName: string;
  userIds: Set<string>;
}

/**
 * Service for mapping organization ciphers to members who have access
 *
 * This service provides functionality to:
 * 1. Fetch all ciphers in an organization (using getAllFromApiForOrganization)
 * 2. Determine which members have access to each cipher
 * 3. Track access paths (direct collection assignment vs group-based)
 * 4. Calculate effective permissions
 *
 * Use Cases:
 * - Testing cipher access logic
 * - Auditing member access to sensitive items
 * - Generating access reports
 */
/**
 * Timing information for diagnostics
 */
export interface CipherAccessMappingTimings {
  fetchCollectionsMs: number;
  fetchUsersMs: number;
  buildGroupMemberMapMs: number;
  buildUserEmailMapMs: number;
}

/**
 * Count information for diagnostics
 */
export interface CipherAccessMappingCounts {
  cipherCount: number;
  collectionCount: number;
  groupCount: number;
  memberCount: number;
}

/**
 * Result with timing information
 */
export interface CipherAccessMappingTimedResult {
  data: CipherWithMemberAccess[];
  timings: CipherAccessMappingTimings;
  counts: CipherAccessMappingCounts;
}

/**
 * State for progressive member access loading (const object pattern per ADR-0025)
 */
export const MemberAccessLoadState = Object.freeze({
  NotStarted: "not-started",
  LoadingPrerequisites: "loading-prerequisites",
  ProcessingBatches: "processing-batches",
  Complete: "complete",
  Error: "error",
} as const);
export type MemberAccessLoadState =
  (typeof MemberAccessLoadState)[keyof typeof MemberAccessLoadState];

/**
 * Progressive result emitted as batches complete during streaming
 */
export interface CipherAccessMappingProgressiveResult {
  /** Current state of member access loading */
  state: MemberAccessLoadState;

  /** Ciphers processed so far (grows with each batch) */
  processedCiphers: CipherWithMemberAccess[];

  /** Total number of ciphers to process */
  totalCipherCount: number;

  /** Number of ciphers processed so far */
  processedCount: number;

  /** Percentage complete (0-100) */
  progressPercent: number;

  /** Timing diagnostics (partial until complete) */
  timings: Partial<CipherAccessMappingTimings>;

  /** Entity counts (partial until complete) */
  counts: Partial<CipherAccessMappingCounts>;

  /** Error message if state is Error */
  error?: string;
}

/**
 * Cached organization users data to avoid duplicate API calls
 */
interface CachedOrganizationUsers {
  organizationId: OrganizationId;
  groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>;
  userEmailMap: Map<string, string>;
  fetchedAt: number;
}

@Injectable()
export class CipherAccessMappingService {
  private readonly cipherService = inject(CipherService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly organizationUserApiService = inject(OrganizationUserApiService);
  private readonly logService = inject(LogService);

  /** Cache for organization users to avoid duplicate API calls */
  private _usersCache: CachedOrganizationUsers | null = null;
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache

  /**
   * Gets all ciphers with member access AND timing diagnostics
   */
  getAllCiphersWithMemberAccessTimed$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<CipherAccessMappingTimedResult> {
    const timings: CipherAccessMappingTimings = {
      fetchCollectionsMs: 0,
      fetchUsersMs: 0,
      buildGroupMemberMapMs: 0,
      buildUserEmailMapMs: 0,
    };

    this.logService.info(
      `[CipherAccessMappingService] Fetching all ciphers for organization ${organizationId}`,
    );

    // STEP 1: Fetch all ciphers in the organization (admin view)
    const allCiphers$ = from(this.cipherService.getAllFromApiForOrganization(organizationId)).pipe(
      tap((ciphers) =>
        this.logService.info(`[CipherAccessMappingService] Found ${ciphers.length} ciphers`),
      ),
    );

    // STEP 2: Fetch all collections with access details (users and groups)
    this.logService.info("[CipherAccessMappingService] Fetching collections with access details");
    const collectionsStart = performance.now();
    const collections$ = this.collectionAdminService
      .collectionAdminViews$(organizationId, currentUserId)
      .pipe(
        tap((collections) => {
          timings.fetchCollectionsMs = performance.now() - collectionsStart;
          this.logService.info(
            `[CipherAccessMappingService] Found ${collections.length} collections`,
          );
        }),
      );

    // STEP 3 & 4: Build group member map and user email map
    // These are async operations, so we convert to observables
    const groupStart = performance.now();
    const groupMemberMap$ = from(this.buildGroupMemberMap(organizationId)).pipe(
      tap(() => {
        timings.buildGroupMemberMapMs = performance.now() - groupStart;
      }),
    );

    const emailStart = performance.now();
    const userEmailMap$ = from(this.buildUserEmailMap(organizationId)).pipe(
      tap(() => {
        timings.buildUserEmailMapMs = performance.now() - emailStart;
        timings.fetchUsersMs = timings.buildGroupMemberMapMs + timings.buildUserEmailMapMs;
      }),
    );

    // Combine all data sources
    return combineLatest([allCiphers$, collections$, groupMemberMap$, userEmailMap$]).pipe(
      map(([allCiphers, collections, groupMemberMap, userEmailMap]) => {
        // Build collection map for quick lookup
        const collectionMap = new Map<string, CollectionAdminView>();
        collections.forEach((collection) => {
          collectionMap.set(collection.id, collection);
        });

        // STEP 5: For each cipher, determine member access
        this.logService.info("[CipherAccessMappingService] Mapping member access to ciphers");
        const ciphersWithAccess: CipherWithMemberAccess[] = [];

        for (const cipher of allCiphers) {
          const memberAccessMap = new Map<string, CipherMemberAccess>();

          // Check if cipher is unassigned (no collections)
          const isUnassigned = !cipher.collectionIds || cipher.collectionIds.length === 0;

          if (!isUnassigned) {
            // Cipher is assigned to collections
            for (const collectionId of cipher.collectionIds) {
              const collection = collectionMap.get(collectionId);
              if (!collection) {
                this.logService.warning(
                  `[CipherAccessMappingService] Collection ${collectionId} not found for cipher ${cipher.id}`,
                );
                continue;
              }

              // A) Process direct user assignments to this collection
              for (const userAccess of collection.users) {
                const userId = userAccess.id;

                if (!memberAccessMap.has(userId)) {
                  memberAccessMap.set(userId, {
                    userId,
                    email: userEmailMap.get(userId) ?? null,
                    accessPaths: [],
                    effectivePermissions: {
                      canEdit: false,
                      canViewPasswords: false,
                      canManage: false,
                    },
                  });
                }

                const memberAccess = memberAccessMap.get(userId)!;
                memberAccess.accessPaths.push({
                  type: "direct",
                  collectionId: collection.id,
                  collectionName: collection.name || "Unknown",
                  permissions: {
                    readOnly: userAccess.readOnly,
                    hidePasswords: userAccess.hidePasswords,
                    manage: userAccess.manage,
                  },
                });

                // Update effective permissions
                this.updateEffectivePermissions(memberAccess, userAccess);
              }

              // B) Process group assignments to this collection
              for (const groupAccess of collection.groups) {
                const groupId = groupAccess.id;
                const groupMemberData = groupMemberMap.get(groupId);

                if (!groupMemberData || groupMemberData.memberIds.length === 0) {
                  this.logService.warning(
                    `[CipherAccessMappingService] No members found for group ${groupId}`,
                  );
                  continue;
                }

                // Add access for each member in the group
                for (const userId of groupMemberData.memberIds) {
                  if (!memberAccessMap.has(userId)) {
                    memberAccessMap.set(userId, {
                      userId,
                      email: userEmailMap.get(userId) ?? null,
                      accessPaths: [],
                      effectivePermissions: {
                        canEdit: false,
                        canViewPasswords: false,
                        canManage: false,
                      },
                    });
                  }

                  const memberAccess = memberAccessMap.get(userId)!;
                  memberAccess.accessPaths.push({
                    type: "group",
                    collectionId: collection.id,
                    collectionName: collection.name || "Unknown",
                    groupId: groupId,
                    groupName: groupMemberData.groupName,
                    permissions: {
                      readOnly: groupAccess.readOnly,
                      hidePasswords: groupAccess.hidePasswords,
                      manage: groupAccess.manage,
                    },
                  });

                  // Update effective permissions
                  this.updateEffectivePermissions(memberAccess, groupAccess);
                }
              }
            }
          }

          // Convert the map to an array
          const members = Array.from(memberAccessMap.values());

          ciphersWithAccess.push({
            cipher,
            totalMemberCount: members.length,
            members,
            unassigned: isUnassigned,
          });
        }

        this.logService.info(
          `[CipherAccessMappingService] Completed mapping for ${ciphersWithAccess.length} ciphers`,
        );

        // Calculate counts for diagnostics
        const uniqueMembers = new Set<string>();
        ciphersWithAccess.forEach((cipher) => {
          cipher.members.forEach((member) => uniqueMembers.add(member.userId));
        });

        const counts: CipherAccessMappingCounts = {
          cipherCount: allCiphers.length,
          collectionCount: collections.length,
          groupCount: groupMemberMap.size,
          memberCount: uniqueMembers.size,
        };

        return {
          data: ciphersWithAccess,
          timings,
          counts,
        };
      }),
    );
  }

  /**
   * Gets all ciphers in an organization and maps which members have access
   *
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID (for collection fetching)
   * @returns Observable of array of ciphers with their member access details
   */
  getAllCiphersWithMemberAccess$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<CipherWithMemberAccess[]> {
    return this.getAllCiphersWithMemberAccessTimed$(organizationId, currentUserId).pipe(
      map((result) => result.data),
    );
  }

  /**
   * Simplified version that just returns cipher ID -> user IDs mapping
   *
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID
   * @returns Observable of map of cipher IDs to sets of user IDs with access
   */
  getSimplifiedCipherAccessMap$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<SimplifiedCipherAccessMap[]> {
    this.logService.info(
      `[CipherAccessMappingService] Building simplified cipher access map for ${organizationId}`,
    );

    return this.getAllCiphersWithMemberAccess$(organizationId, currentUserId).pipe(
      map((ciphersWithAccess) => {
        const result: SimplifiedCipherAccessMap[] = ciphersWithAccess.map((c) => {
          const userIds = new Set<string>(c.members.map((m) => m.userId));
          return {
            cipherId: c.cipher.id,
            cipherName: c.cipher.name,
            userIds,
          };
        });

        this.logService.info(
          `[CipherAccessMappingService] Completed simplified mapping for ${result.length} ciphers`,
        );
        return result;
      }),
    );
  }

  /**
   * Finds all ciphers a specific user has access to
   *
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID (for collection fetching)
   * @param targetUserId - The user to find ciphers for
   * @returns Observable of ciphers the target user can access
   */
  findCiphersForUser$(
    organizationId: OrganizationId,
    currentUserId: UserId,
    targetUserId: string,
  ): Observable<CipherWithMemberAccess[]> {
    return this.getAllCiphersWithMemberAccess$(organizationId, currentUserId).pipe(
      map((allCiphersWithAccess) => {
        const userCiphers = allCiphersWithAccess.filter((c) =>
          c.members.some((m) => m.userId === targetUserId),
        );

        this.logService.info(
          `[CipherAccessMappingService] User ${targetUserId} has access to ${userCiphers.length} ciphers`,
        );

        return userCiphers;
      }),
    );
  }

  /**
   * Finds all members who have access to a specific cipher
   *
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID (for collection fetching)
   * @param cipherId - The cipher to find members for
   * @returns Observable of members with access to the cipher, or null if cipher not found
   */
  findMembersForCipher$(
    organizationId: OrganizationId,
    currentUserId: UserId,
    cipherId: string,
  ): Observable<CipherMemberAccess[] | null> {
    return this.getAllCiphersWithMemberAccess$(organizationId, currentUserId).pipe(
      map((allCiphersWithAccess) => {
        const targetCipher = allCiphersWithAccess.find((c) => c.cipher.id === cipherId);

        if (!targetCipher) {
          this.logService.warning(
            `[CipherAccessMappingService] Cipher ${cipherId} not found in organization`,
          );
          return null;
        }

        this.logService.info(
          `[CipherAccessMappingService] Found ${targetCipher.totalMemberCount} members with access to cipher ${cipherId}`,
        );

        return targetCipher.members;
      }),
    );
  }

  /**
   * Generates a report of ciphers with their distinct member count
   *
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID
   * @returns Observable of array of cipher summaries sorted by member count descending
   */
  generateCipherMemberCountReport$(
    organizationId: OrganizationId,
    currentUserId: UserId,
  ): Observable<
    { cipherId: string; cipherName: string; memberCount: number; unassigned: boolean }[]
  > {
    return this.getAllCiphersWithMemberAccess$(organizationId, currentUserId).pipe(
      map((ciphersWithAccess) => {
        const report = ciphersWithAccess.map((c) => ({
          cipherId: c.cipher.id,
          cipherName: c.cipher.name,
          memberCount: c.totalMemberCount,
          unassigned: c.unassigned,
        }));

        // Sort by member count descending
        report.sort((a, b) => b.memberCount - a.memberCount);

        this.logService.info(
          `[CipherAccessMappingService] Generated report for ${report.length} ciphers`,
        );

        return report;
      }),
    );
  }

  /**
   * Exports cipher access data to JSON format
   *
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID
   * @returns Observable of JSON string of cipher access data
   */
  exportToJSON$(organizationId: OrganizationId, currentUserId: UserId): Observable<string> {
    return this.getAllCiphersWithMemberAccess$(organizationId, currentUserId).pipe(
      map((ciphersWithAccess) => {
        // Transform to a serializable format
        const exportData = ciphersWithAccess.map((c) => ({
          cipherId: c.cipher.id,
          cipherName: c.cipher.name,
          cipherType: c.cipher.type,
          organizationId: c.cipher.organizationId,
          collectionIds: c.cipher.collectionIds,
          unassigned: c.unassigned,
          totalMemberCount: c.totalMemberCount,
          members: c.members.map((m) => ({
            userId: m.userId,
            email: m.email,
            effectivePermissions: m.effectivePermissions,
            accessPaths: m.accessPaths,
          })),
        }));

        const jsonOutput = JSON.stringify(exportData, null, 2);
        this.logService.info(
          `[CipherAccessMappingService] Exported ${exportData.length} ciphers to JSON`,
        );

        return jsonOutput;
      }),
    );
  }

  /**
   * Gets ciphers with member access using progressive streaming.
   * Emits partial results as batches complete, enabling incremental UI updates.
   *
   * Key differences from getAllCiphersWithMemberAccessTimed$:
   * 1. Accepts already-fetched ciphers (decouples cipher fetch from member mapping)
   * 2. Uses single API call for users (via fetchOrganizationUsersOnce)
   * 3. Processes in batches with setTimeout(0) to yield to event loop
   * 4. Emits after each batch for progressive UI updates
   *
   * @param organizationId - The organization ID
   * @param currentUserId - The current user's ID (for collection fetching)
   * @param ciphers - Pre-fetched ciphers to process
   * @param batchSize - Number of ciphers to process per batch (default 500)
   * @returns Observable that emits progressive results after each batch
   */
  getAllCiphersWithMemberAccessProgressive$(
    organizationId: OrganizationId,
    currentUserId: UserId,
    ciphers: CipherView[],
    batchSize: number = 500,
  ): Observable<CipherAccessMappingProgressiveResult> {
    const timings: Partial<CipherAccessMappingTimings> = {};
    const counts: Partial<CipherAccessMappingCounts> = { cipherCount: ciphers.length };

    this.logService.info(
      `[CipherAccessMappingService] Starting progressive member access mapping for ${ciphers.length} ciphers`,
    );

    // Fetch prerequisites in parallel: collections and users (single API call)
    const collectionsStart = performance.now();
    const collections$ = this.collectionAdminService
      .collectionAdminViews$(organizationId, currentUserId)
      .pipe(
        take(1), // Complete after first emission (hot observable)
        tap((collections) => {
          timings.fetchCollectionsMs = performance.now() - collectionsStart;
          counts.collectionCount = collections.length;
          this.logService.info(
            `[CipherAccessMappingService] Fetched ${collections.length} collections in ${timings.fetchCollectionsMs?.toFixed(0)}ms`,
          );
        }),
      );

    const usersStart = performance.now();
    const users$ = from(this.fetchOrganizationUsersOnce(organizationId)).pipe(
      tap(({ groupMemberMap, userEmailMap }) => {
        timings.fetchUsersMs = performance.now() - usersStart;
        timings.buildGroupMemberMapMs = timings.fetchUsersMs;
        timings.buildUserEmailMapMs = 0; // Included in single call
        counts.groupCount = groupMemberMap.size;
        counts.memberCount = userEmailMap.size;
        this.logService.info(
          `[CipherAccessMappingService] Fetched users in ${timings.fetchUsersMs?.toFixed(0)}ms`,
        );
      }),
    );

    // Combine prerequisites, then process batches
    return combineLatest([collections$, users$]).pipe(
      switchMap(([collections, { groupMemberMap, userEmailMap }]) => {
        // Build collection lookup map
        const collectionMap = new Map<string, CollectionAdminView>();
        collections.forEach((c) => collectionMap.set(c.id, c));

        // Create batches
        const batches: CipherView[][] = [];
        for (let i = 0; i < ciphers.length; i += batchSize) {
          batches.push(ciphers.slice(i, i + batchSize));
        }

        this.logService.info(
          `[CipherAccessMappingService] Processing ${batches.length} batches of ~${batchSize} ciphers each`,
        );

        // Accumulate results across batches
        const processedCiphers: CipherWithMemberAccess[] = [];

        // Process batches sequentially with event loop yields
        return from(batches).pipe(
          concatMap((batch, batchIndex) => {
            return new Observable<CipherAccessMappingProgressiveResult>((observer) => {
              // Use setTimeout(0) to yield to event loop between batches
              setTimeout(() => {
                const batchResults = this.processCipherBatch(
                  batch,
                  collectionMap,
                  groupMemberMap,
                  userEmailMap,
                );

                processedCiphers.push(...batchResults);

                const processedCount = processedCiphers.length;
                const progressPercent = Math.round((processedCount / ciphers.length) * 100);

                this.logService.info(
                  `[CipherAccessMappingService] Batch ${batchIndex + 1}/${batches.length} complete: ${processedCount}/${ciphers.length} (${progressPercent}%)`,
                );

                const isLastBatch = batchIndex === batches.length - 1;

                observer.next({
                  state: isLastBatch
                    ? MemberAccessLoadState.Complete
                    : MemberAccessLoadState.ProcessingBatches,
                  processedCiphers: [...processedCiphers], // Copy for immutability
                  totalCipherCount: ciphers.length,
                  processedCount,
                  progressPercent,
                  timings,
                  counts,
                });

                observer.complete();
              }, 0);
            });
          }),
        );
      }),
      catchError((error: unknown) => {
        this.logService.error("[CipherAccessMappingService] Progressive mapping error", error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error occurred during member access mapping";
        return of({
          state: MemberAccessLoadState.Error,
          processedCiphers: [],
          totalCipherCount: ciphers.length,
          processedCount: 0,
          progressPercent: 0,
          timings,
          counts,
          error: errorMessage,
        });
      }),
    );
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Builds a map of groupId -> member user IDs and group name
   *
   * Note: The GroupDetailsView doesn't include members directly.
   * We need to fetch organization users and check their group memberships.
   */
  private async buildGroupMemberMap(
    organizationId: OrganizationId,
  ): Promise<Map<string, { groupName: string; memberIds: string[] }>> {
    const groupMemberMap = new Map<string, { groupName: string; memberIds: string[] }>();

    // Fetch all organization users with groups
    const orgUsersResponse = await this.organizationUserApiService.getAllUsers(organizationId, {
      includeGroups: true,
    });

    // Build reverse mapping: for each user, add them to their groups
    for (const orgUser of orgUsersResponse.data) {
      if (!orgUser.groups || orgUser.groups.length === 0) {
        continue;
      }

      for (const groupId of orgUser.groups) {
        let groupData = groupMemberMap.get(groupId);
        if (!groupData) {
          // Initialize group data (name will be updated if we have it)
          groupData = { groupName: "Unknown Group", memberIds: [] };
          groupMemberMap.set(groupId, groupData);
        }
        // Use orgUser.id (organization user ID) to match collection assignments and email map
        groupData.memberIds.push(orgUser.id);
      }
    }

    this.logService.info(
      `[CipherAccessMappingService] Built group member map for ${groupMemberMap.size} groups`,
    );

    return groupMemberMap;
  }

  /**
   * Builds a map of userId -> email for quick lookup
   */
  private async buildUserEmailMap(organizationId: OrganizationId): Promise<Map<string, string>> {
    const userEmailMap = new Map<string, string>();

    const orgUsersResponse = await this.organizationUserApiService.getAllUsers(organizationId);

    for (const orgUser of orgUsersResponse.data) {
      // Use orgUser.id as the key (organization user ID), not orgUser.userId which can be null
      // This is the ID that will be used in collection assignments and group member IDs
      if (orgUser.id && orgUser.email) {
        userEmailMap.set(orgUser.id, orgUser.email);
      }
    }

    this.logService.info(
      `[CipherAccessMappingService] Built user email map for ${userEmailMap.size} users`,
    );

    return userEmailMap;
  }

  /**
   * Fetches organization users ONCE and builds both maps from the same API response.
   * Eliminates the duplicate API calls that existed in the original implementation.
   * Includes caching to avoid repeated calls within a short time window.
   *
   * @param organizationId - The organization ID
   * @returns Both groupMemberMap and userEmailMap built from a single API call
   */
  private async fetchOrganizationUsersOnce(organizationId: OrganizationId): Promise<{
    groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>;
    userEmailMap: Map<string, string>;
  }> {
    // Check cache first
    if (
      this._usersCache &&
      this._usersCache.organizationId === organizationId &&
      Date.now() - this._usersCache.fetchedAt < this.CACHE_TTL_MS
    ) {
      this.logService.info(
        `[CipherAccessMappingService] Using cached user data for organization ${organizationId}`,
      );
      return {
        groupMemberMap: this._usersCache.groupMemberMap,
        userEmailMap: this._usersCache.userEmailMap,
      };
    }

    this.logService.info(
      `[CipherAccessMappingService] Fetching organization users (single API call) for ${organizationId}`,
    );

    // Single API call with includeGroups: true - gets all user data needed
    const orgUsersResponse = await this.organizationUserApiService.getAllUsers(organizationId, {
      includeGroups: true,
    });

    // Build both maps from the same response
    const groupMemberMap = new Map<string, { groupName: string; memberIds: string[] }>();
    const userEmailMap = new Map<string, string>();

    for (const orgUser of orgUsersResponse.data) {
      // Build email map
      if (orgUser.id && orgUser.email) {
        userEmailMap.set(orgUser.id, orgUser.email);
      }

      // Build group member map (reverse mapping: user -> their groups)
      if (orgUser.groups && orgUser.groups.length > 0) {
        for (const groupId of orgUser.groups) {
          let groupData = groupMemberMap.get(groupId);
          if (!groupData) {
            groupData = { groupName: "Unknown Group", memberIds: [] };
            groupMemberMap.set(groupId, groupData);
          }
          groupData.memberIds.push(orgUser.id);
        }
      }
    }

    // Update cache
    this._usersCache = {
      organizationId,
      groupMemberMap,
      userEmailMap,
      fetchedAt: Date.now(),
    };

    this.logService.info(
      `[CipherAccessMappingService] Built maps from single API call: ${userEmailMap.size} users, ${groupMemberMap.size} groups`,
    );

    return { groupMemberMap, userEmailMap };
  }

  /**
   * Processes a batch of ciphers to calculate member access.
   * Extracted as a reusable helper for both progressive and non-progressive methods.
   *
   * @param ciphers - The batch of ciphers to process
   * @param collectionMap - Map of collection ID to CollectionAdminView
   * @param groupMemberMap - Map of group ID to group data with member IDs
   * @param userEmailMap - Map of user ID to email
   * @returns Array of ciphers with member access calculated
   */
  private processCipherBatch(
    ciphers: CipherView[],
    collectionMap: Map<string, CollectionAdminView>,
    groupMemberMap: Map<string, { groupName: string; memberIds: string[] }>,
    userEmailMap: Map<string, string>,
  ): CipherWithMemberAccess[] {
    const results: CipherWithMemberAccess[] = [];

    for (const cipher of ciphers) {
      const memberAccessMap = new Map<string, CipherMemberAccess>();
      const isUnassigned = !cipher.collectionIds || cipher.collectionIds.length === 0;

      if (!isUnassigned) {
        for (const collectionId of cipher.collectionIds) {
          const collection = collectionMap.get(collectionId);
          if (!collection) {
            continue;
          }

          // Process direct user assignments
          for (const userAccess of collection.users) {
            const userId = userAccess.id;

            if (!memberAccessMap.has(userId)) {
              memberAccessMap.set(userId, {
                userId,
                email: userEmailMap.get(userId) ?? null,
                accessPaths: [],
                effectivePermissions: {
                  canEdit: false,
                  canViewPasswords: false,
                  canManage: false,
                },
              });
            }

            const memberAccess = memberAccessMap.get(userId)!;
            memberAccess.accessPaths.push({
              type: "direct",
              collectionId: collection.id,
              collectionName: collection.name || "Unknown",
              permissions: {
                readOnly: userAccess.readOnly,
                hidePasswords: userAccess.hidePasswords,
                manage: userAccess.manage,
              },
            });

            this.updateEffectivePermissions(memberAccess, userAccess);
          }

          // Process group assignments
          for (const groupAccess of collection.groups) {
            const groupId = groupAccess.id;
            const groupMemberData = groupMemberMap.get(groupId);

            if (!groupMemberData || groupMemberData.memberIds.length === 0) {
              continue;
            }

            for (const userId of groupMemberData.memberIds) {
              if (!memberAccessMap.has(userId)) {
                memberAccessMap.set(userId, {
                  userId,
                  email: userEmailMap.get(userId) ?? null,
                  accessPaths: [],
                  effectivePermissions: {
                    canEdit: false,
                    canViewPasswords: false,
                    canManage: false,
                  },
                });
              }

              const memberAccess = memberAccessMap.get(userId)!;
              memberAccess.accessPaths.push({
                type: "group",
                collectionId: collection.id,
                collectionName: collection.name || "Unknown",
                groupId: groupId,
                groupName: groupMemberData.groupName,
                permissions: {
                  readOnly: groupAccess.readOnly,
                  hidePasswords: groupAccess.hidePasswords,
                  manage: groupAccess.manage,
                },
              });

              this.updateEffectivePermissions(memberAccess, groupAccess);
            }
          }
        }
      }

      results.push({
        cipher,
        members: Array.from(memberAccessMap.values()),
        totalMemberCount: memberAccessMap.size,
        unassigned: isUnassigned,
      });
    }

    return results;
  }

  /**
   * Updates the effective permissions based on a new access path
   * Uses "most permissive" logic - if ANY path grants a permission, it's granted
   */
  private updateEffectivePermissions(
    memberAccess: CipherMemberAccess,
    accessPermissions: { readOnly: boolean; hidePasswords: boolean; manage: boolean },
  ): void {
    // Can edit if at least one path is NOT read-only
    if (!accessPermissions.readOnly) {
      memberAccess.effectivePermissions.canEdit = true;
    }

    // Can view passwords if at least one path does NOT hide passwords
    if (!accessPermissions.hidePasswords) {
      memberAccess.effectivePermissions.canViewPasswords = true;
    }

    // Can manage if at least one path grants manage permission
    if (accessPermissions.manage) {
      memberAccess.effectivePermissions.canManage = true;
    }
  }
}
