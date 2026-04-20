import { Observable, of } from "rxjs";

import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { MemberRegistryEntryView, MemberRegistry } from "../../../models";
import {
  CollectionAccessDetails,
  GroupMembershipDetails,
  MemberCipherMappingResult,
  MemberCipherMappingService,
  OrganizationUserView,
} from "../../abstractions/member-cipher-mapping.service";

/**
 * Default implementation of MemberCipherMappingService
 *
 * Computes cipher-to-member mappings client-side via collection and group resolution.
 * This is a pure transformation service with no external dependencies.
 */
export class DefaultMemberCipherMappingService extends MemberCipherMappingService {
  /**
   * Maps ciphers to organization members via collection and group resolution.
   *
   * This is a synchronous operation wrapped in an Observable for consistency
   * with the service pattern. No async operations are performed.
   */
  mapCiphersToMembers$(
    ciphers: CipherView[],
    members: OrganizationUserView[],
    collectionAccess: CollectionAccessDetails[],
    groupMemberships: GroupMembershipDetails[],
  ): Observable<MemberCipherMappingResult> {
    // Build lookup maps for O(1) access
    const collectionAccessMap = this.buildCollectionAccessMap(collectionAccess);
    const groupMembershipMap = this.buildGroupMembershipMap(groupMemberships);
    const memberMap = this.buildMemberMap(members);

    // Mapping from cipher ID to set of member IDs (using Set for automatic deduplication)
    const cipherToMembersMap = new Map<string, Set<string>>();

    // Set of all unique member IDs across all ciphers (for registry building)
    const allMemberIds = new Set<string>();

    // Process each cipher
    for (const cipher of ciphers) {
      const memberIds = this.resolveCipherMembers(cipher, collectionAccessMap, groupMembershipMap);

      cipherToMembersMap.set(cipher.id, memberIds);

      // Add all member IDs to the global set for registry building
      memberIds.forEach((id) => allMemberIds.add(id));
    }

    // Build the member registry from all unique member IDs
    const registry: MemberRegistry = {};
    allMemberIds.forEach((id) => {
      const member = memberMap.get(id);
      if (member) {
        registry[id] = MemberRegistryEntryView.fromData({
          id: member.id,
          userName: member.name || undefined,
          email: member.email,
        });
      }
    });

    // Convert Set to Array for the final mapping
    const mapping = new Map<string, string[]>();
    cipherToMembersMap.forEach((memberIds, cipherId) => {
      mapping.set(cipherId, Array.from(memberIds));
    });

    return of({ mapping, registry });
  }

  /**
   * Builds a member registry from an array of members.
   */
  buildMemberRegistry$(members: OrganizationUserView[]): Observable<MemberRegistry> {
    const registry: MemberRegistry = {};

    members.forEach((member) => {
      registry[member.id] = MemberRegistryEntryView.fromData({
        id: member.id,
        userName: member.name || undefined,
        email: member.email,
      });
    });

    return of(registry);
  }

  /**
   * Resolves which members have access to a cipher via collections and groups.
   *
   * Resolution logic:
   * 1. Find all collections the cipher belongs to (cipher.collectionIds)
   * 2. For each collection, find:
   *    - Users directly assigned to the collection
   *    - Groups assigned to the collection
   * 3. For each group, find all users who are members of that group
   * 4. Return deduplicated set of member IDs
   *
   * @param cipher - The cipher to resolve members for
   * @param collectionAccessMap - Map of collection ID to access details
   * @param groupMembershipMap - Map of group ID to membership details
   * @returns Set of organization user IDs who have access to this cipher
   */
  private resolveCipherMembers(
    cipher: CipherView,
    collectionAccessMap: Map<string, CollectionAccessDetails>,
    groupMembershipMap: Map<string, GroupMembershipDetails>,
  ): Set<string> {
    const memberIds = new Set<string>();

    // If cipher has no collections, no one has access (except owner, but that's not tracked here)
    if (!cipher.collectionIds || cipher.collectionIds.length === 0) {
      return memberIds;
    }

    // For each collection the cipher belongs to
    for (const collectionId of cipher.collectionIds) {
      const access = collectionAccessMap.get(collectionId);
      if (!access) {
        continue;
      }

      // Add all users directly assigned to this collection
      access.users.forEach((userId) => memberIds.add(userId));

      // For each group assigned to this collection
      for (const groupId of access.groups) {
        const membership = groupMembershipMap.get(groupId);
        if (!membership) {
          continue;
        }

        // Add all users who are members of this group
        membership.users.forEach((userId) => memberIds.add(userId));
      }
    }

    return memberIds;
  }

  /**
   * Builds a lookup map from collection ID to access details for O(1) access.
   */
  private buildCollectionAccessMap(
    collectionAccess: CollectionAccessDetails[],
  ): Map<string, CollectionAccessDetails> {
    const map = new Map<string, CollectionAccessDetails>();
    collectionAccess.forEach((access) => {
      map.set(access.collectionId, access);
    });
    return map;
  }

  /**
   * Builds a lookup map from group ID to membership details for O(1) access.
   */
  private buildGroupMembershipMap(
    groupMemberships: GroupMembershipDetails[],
  ): Map<string, GroupMembershipDetails> {
    const map = new Map<string, GroupMembershipDetails>();
    groupMemberships.forEach((membership) => {
      map.set(membership.groupId, membership);
    });
    return map;
  }

  /**
   * Builds a lookup map from member ID to member object for O(1) access.
   */
  private buildMemberMap(members: OrganizationUserView[]): Map<string, OrganizationUserView> {
    const map = new Map<string, OrganizationUserView>();
    members.forEach((member) => {
      map.set(member.id, member);
    });
    return map;
  }
}
