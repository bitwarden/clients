import { firstValueFrom } from "rxjs";

import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  CollectionAccessDetails,
  GroupMembershipDetails,
  OrganizationUserView,
} from "../../abstractions/member-cipher-mapping.service";

import { DefaultMemberCipherMappingService } from "./default-member-cipher-mapping.service";

describe("DefaultMemberCipherMappingService", () => {
  let service: DefaultMemberCipherMappingService;

  beforeEach(() => {
    service = new DefaultMemberCipherMappingService();
  });

  // Test helpers

  const createCipher = (id: string, collectionIds: string[]): CipherView => {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.type = CipherType.Login;
    cipher.collectionIds = collectionIds;
    return cipher;
  };

  const createMember = (id: string, name: string, email: string): OrganizationUserView => ({
    id,
    name,
    email,
  });

  const createCollectionAccess = (
    collectionId: string,
    userIds: string[],
    groupIds: string[],
  ): CollectionAccessDetails => ({
    collectionId,
    users: new Set(userIds),
    groups: new Set(groupIds),
  });

  const createGroupMembership = (groupId: string, userIds: string[]): GroupMembershipDetails => ({
    groupId,
    users: new Set(userIds),
  });

  // Tests

  describe("mapCiphersToMembers$", () => {
    it("should map cipher to directly assigned users", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1"])];
      const members = [
        createMember("user-1", "Alice", "alice@example.com"),
        createMember("user-2", "Bob", "bob@example.com"),
      ];
      const collectionAccess = [createCollectionAccess("collection-1", ["user-1", "user-2"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.mapping.get("cipher-1")).toEqual(expect.arrayContaining(["user-1", "user-2"]));
      expect(result.mapping.get("cipher-1")?.length).toBe(2);
      expect(Object.keys(result.registry).length).toBe(2);
      expect(result.registry["user-1"]).toEqual({
        id: "user-1",
        userName: "Alice",
        email: "alice@example.com",
      });
    });

    it("should map cipher to users via group membership", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1"])];
      const members = [
        createMember("user-1", "Alice", "alice@example.com"),
        createMember("user-2", "Bob", "bob@example.com"),
      ];
      const collectionAccess = [createCollectionAccess("collection-1", [], ["group-1"])];
      const groupMemberships = [createGroupMembership("group-1", ["user-1", "user-2"])];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.mapping.get("cipher-1")).toEqual(expect.arrayContaining(["user-1", "user-2"]));
      expect(result.mapping.get("cipher-1")?.length).toBe(2);
      expect(Object.keys(result.registry).length).toBe(2);
    });

    it("should combine direct users and group members", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1"])];
      const members = [
        createMember("user-1", "Alice", "alice@example.com"),
        createMember("user-2", "Bob", "bob@example.com"),
        createMember("user-3", "Charlie", "charlie@example.com"),
      ];
      const collectionAccess = [createCollectionAccess("collection-1", ["user-1"], ["group-1"])];
      const groupMemberships = [createGroupMembership("group-1", ["user-2", "user-3"])];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.mapping.get("cipher-1")).toEqual(
        expect.arrayContaining(["user-1", "user-2", "user-3"]),
      );
      expect(result.mapping.get("cipher-1")?.length).toBe(3);
      expect(Object.keys(result.registry).length).toBe(3);
    });

    it("should deduplicate users across multiple collections", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1", "collection-2"])];
      const members = [createMember("user-1", "Alice", "alice@example.com")];
      const collectionAccess = [
        createCollectionAccess("collection-1", ["user-1"], []),
        createCollectionAccess("collection-2", ["user-1"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      // User should appear only once despite being in multiple collections
      expect(result.mapping.get("cipher-1")).toEqual(["user-1"]);
      expect(result.mapping.get("cipher-1")?.length).toBe(1);
      expect(Object.keys(result.registry).length).toBe(1);
    });

    it("should deduplicate users from direct access and group membership", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1"])];
      const members = [createMember("user-1", "Alice", "alice@example.com")];
      const collectionAccess = [createCollectionAccess("collection-1", ["user-1"], ["group-1"])];
      const groupMemberships = [createGroupMembership("group-1", ["user-1"])];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      // User should appear only once despite having both direct and group access
      expect(result.mapping.get("cipher-1")).toEqual(["user-1"]);
      expect(result.mapping.get("cipher-1")?.length).toBe(1);
      expect(Object.keys(result.registry).length).toBe(1);
    });

    it("should handle multiple ciphers with different member access", async () => {
      const ciphers = [
        createCipher("cipher-1", ["collection-1"]),
        createCipher("cipher-2", ["collection-2"]),
      ];
      const members = [
        createMember("user-1", "Alice", "alice@example.com"),
        createMember("user-2", "Bob", "bob@example.com"),
      ];
      const collectionAccess = [
        createCollectionAccess("collection-1", ["user-1"], []),
        createCollectionAccess("collection-2", ["user-2"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.mapping.get("cipher-1")).toEqual(["user-1"]);
      expect(result.mapping.get("cipher-2")).toEqual(["user-2"]);
      expect(Object.keys(result.registry).length).toBe(2);
    });

    it("should handle multiple ciphers with overlapping member access", async () => {
      const ciphers = [
        createCipher("cipher-1", ["collection-1"]),
        createCipher("cipher-2", ["collection-2"]),
      ];
      const members = [
        createMember("user-1", "Alice", "alice@example.com"),
        createMember("user-2", "Bob", "bob@example.com"),
      ];
      const collectionAccess = [
        createCollectionAccess("collection-1", ["user-1", "user-2"], []),
        createCollectionAccess("collection-2", ["user-2"], []),
      ];
      const groupMemberships: GroupMembershipDetails[] = [];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.mapping.get("cipher-1")).toEqual(expect.arrayContaining(["user-1", "user-2"]));
      expect(result.mapping.get("cipher-2")).toEqual(["user-2"]);
      // Registry should contain both users (deduplicated)
      expect(Object.keys(result.registry).length).toBe(2);
    });

    it("should handle cipher with no collections", async () => {
      const ciphers = [createCipher("cipher-1", [])];
      const members = [createMember("user-1", "Alice", "alice@example.com")];
      const collectionAccess: CollectionAccessDetails[] = [];
      const groupMemberships: GroupMembershipDetails[] = [];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.mapping.get("cipher-1")).toEqual([]);
      expect(Object.keys(result.registry).length).toBe(0);
    });

    it("should handle cipher with collection but no access defined", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1"])];
      const members = [createMember("user-1", "Alice", "alice@example.com")];
      const collectionAccess: CollectionAccessDetails[] = []; // No access defined
      const groupMemberships: GroupMembershipDetails[] = [];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.mapping.get("cipher-1")).toEqual([]);
      expect(Object.keys(result.registry).length).toBe(0);
    });

    it("should handle empty inputs", async () => {
      const result = await firstValueFrom(service.mapCiphersToMembers$([], [], [], []));

      expect(result.mapping.size).toBe(0);
      expect(Object.keys(result.registry).length).toBe(0);
    });

    it("should handle member with null name", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1"])];
      const members = [createMember("user-1", null as any, "alice@example.com")];
      const collectionAccess = [createCollectionAccess("collection-1", ["user-1"], [])];
      const groupMemberships: GroupMembershipDetails[] = [];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      expect(result.registry["user-1"]?.userName).toBeUndefined();
    });

    it("should handle complex scenario with multiple groups and collections", async () => {
      const ciphers = [createCipher("cipher-1", ["collection-1", "collection-2"])];
      const members = [
        createMember("user-1", "Alice", "alice@example.com"),
        createMember("user-2", "Bob", "bob@example.com"),
        createMember("user-3", "Charlie", "charlie@example.com"),
        createMember("user-4", "David", "david@example.com"),
      ];
      const collectionAccess = [
        // Collection 1: user-1 directly + group-1 (user-2, user-3)
        createCollectionAccess("collection-1", ["user-1"], ["group-1"]),
        // Collection 2: user-1 directly + group-2 (user-3, user-4)
        createCollectionAccess("collection-2", ["user-1"], ["group-2"]),
      ];
      const groupMemberships = [
        createGroupMembership("group-1", ["user-2", "user-3"]),
        createGroupMembership("group-2", ["user-3", "user-4"]),
      ];

      const result = await firstValueFrom(
        service.mapCiphersToMembers$(ciphers, members, collectionAccess, groupMemberships),
      );

      // Cipher should have access for all 4 users (deduplicated)
      // user-1: direct access to both collections
      // user-2: group-1 → collection-1
      // user-3: group-1 → collection-1, group-2 → collection-2
      // user-4: group-2 → collection-2
      expect(result.mapping.get("cipher-1")).toEqual(
        expect.arrayContaining(["user-1", "user-2", "user-3", "user-4"]),
      );
      expect(result.mapping.get("cipher-1")?.length).toBe(4);
      expect(Object.keys(result.registry).length).toBe(4);
    });
  });

  describe("buildMemberRegistry$", () => {
    it("should build registry from members", async () => {
      const members = [
        createMember("user-1", "Alice", "alice@example.com"),
        createMember("user-2", "Bob", "bob@example.com"),
      ];

      const registry = await firstValueFrom(service.buildMemberRegistry$(members));

      expect(Object.keys(registry).length).toBe(2);
      expect(registry["user-1"]).toEqual({
        id: "user-1",
        userName: "Alice",
        email: "alice@example.com",
      });
      expect(registry["user-2"]).toEqual({
        id: "user-2",
        userName: "Bob",
        email: "bob@example.com",
      });
    });

    it("should handle empty members array", async () => {
      const registry = await firstValueFrom(service.buildMemberRegistry$([]));

      expect(Object.keys(registry).length).toBe(0);
    });

    it("should handle member with null name", async () => {
      const members = [createMember("user-1", null as any, "alice@example.com")];

      const registry = await firstValueFrom(service.buildMemberRegistry$(members));

      expect(registry["user-1"]?.userName).toBeUndefined();
    });
  });
});
