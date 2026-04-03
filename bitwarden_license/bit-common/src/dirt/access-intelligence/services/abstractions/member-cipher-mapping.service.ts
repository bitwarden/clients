import { Observable } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { MemberRegistry } from "../../models";

/**
 * Organization User View (simplified interface for type safety)
 *
 * This represents an organization member. The actual OrganizationUserView
 * may have additional fields, but we only need these for member mapping.
 */
export interface OrganizationUserView {
  id: string; // Organization user ID (userGuid)
  name: string | null;
  email: string;
}

/**
 * Group View (simplified interface for type safety)
 *
 * Represents an organization group that can be assigned to collections.
 */
export interface GroupView {
  id: string;
  name: string;
}

/**
 * Collection Access Details
 *
 * Defines which users and groups have access to a collection.
 * Used to resolve cipher-to-member relationships.
 */
export interface CollectionAccessDetails {
  collectionId: string;
  users: Set<string>; // Organization user IDs
  groups: Set<string>; // Group IDs
}

/**
 * Group Membership Details
 *
 * Defines which users are members of a group.
 */
export interface GroupMembershipDetails {
  groupId: string;
  users: Set<string>; // Organization user IDs
}

/**
 * Member Cipher Mapping Result
 *
 * Contains the cipher-to-member mapping and deduplicated member registry.
 */
export interface MemberCipherMappingResult {
  /**
   * Mapping from cipher ID to array of organization user IDs
   *
   * For each cipher, this contains the list of members who have access
   * to it via collections and groups.
   */
  mapping: Map<string, string[]>;

  /**
   * Deduplicated member registry
   *
   * Contains each unique member once, eliminating duplication across
   * applications. Members are referenced by ID from the mapping.
   */
  registry: MemberRegistry;
}

/**
 * Maps ciphers to organization members via collections and groups (client-side).
 *
 * This is a pure transformation service - it takes already-loaded organization data
 * and computes which members have access to which ciphers based on collection and
 * group assignments. No API calls are made.
 *
 * **Replaces:** Server-side `getMemberCipherDetails` API endpoint that was timing out
 * for large organizations.
 *
 * **Performance:** For a 10K member org, reduces report size from ~786MB to ~150MB
 * by eliminating duplicate member objects across applications (81% reduction).
 *
 * Platform-agnostic domain service used by ReportGenerationService.
 */
export abstract class MemberCipherMappingService {
  /**
   * Maps ciphers to organization members via collection and group resolution.
   *
   * **Resolution Logic:**
   * 1. For each cipher, find collections it belongs to (cipher.collectionIds)
   * 2. For each collection, find:
   *    - Users directly assigned to the collection
   *    - Groups assigned to the collection
   * 3. For each group, find all users who are members of that group
   * 4. Deduplicate all found users for each cipher
   * 5. Build member registry containing each unique member once
   *
   * **Important:** This is a pure transformation. The orchestrator (ReportGenerationService)
   * is responsible for fetching org data (members, groups, collections). This service
   * only computes the mapping from the provided data.
   *
   * @param ciphers - Organization ciphers to map
   * @param members - Organization users/members
   * @param collectionAccess - Collection access details (which users/groups can access each collection)
   * @param groupMemberships - Group membership details (which users are in each group)
   * @returns Observable of mapping result with cipher-to-member mapping and member registry
   *
   * @example
   * ```typescript
   * // In ReportGenerationService
   * forkJoin({
   *   ciphers: this.cipherService.getAllDecrypted(),
   *   members: this.organizationService.getMembers(orgId),
   *   collectionAccess: this.getCollectionAccess(orgId),
   *   groupMemberships: this.getGroupMemberships(orgId),
   * }).pipe(
   *   switchMap(({ ciphers, members, collectionAccess, groupMemberships }) =>
   *     this.memberMappingService.mapCiphersToMembers(
   *       ciphers,
   *       members,
   *       collectionAccess,
   *       groupMemberships
   *     )
   *   ),
   *   map(({ mapping, registry }) => {
   *     // Use mapping to build application reports
   *     // Use registry for member lookup by ID
   *   })
   * )
   * ```
   */
  abstract mapCiphersToMembers(
    ciphers: CipherView[],
    members: OrganizationUserView[],
    collectionAccess: CollectionAccessDetails[],
    groupMemberships: GroupMembershipDetails[],
  ): Observable<MemberCipherMappingResult>;

  /**
   * Builds a member registry from an array of members.
   *
   * Utility method to create a deduplicated member registry. This can be used
   * independently of the full cipher mapping when you only need to deduplicate
   * members without computing cipher relationships.
   *
   * @param members - Organization users/members to add to registry
   * @returns Observable of member registry
   *
   * @example
   * ```typescript
   * this.memberMappingService.buildMemberRegistry(allMembers).pipe(
   *   map(registry => {
   *     console.log(`Registry size: ${registry.size()}`);
   *     const alice = registry.get("user-id-123");
   *   })
   * )
   * ```
   */
  abstract buildMemberRegistry(members: OrganizationUserView[]): Observable<MemberRegistry>;
}
