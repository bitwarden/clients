import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  CollectionAdminService,
  CollectionAdminView,
  CollectionAccessSelectionView,
  OrganizationUserApiService,
  OrganizationUserUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";

import { CipherAccessMappingService } from "./cipher-access-mapping.service";

describe("CipherAccessMappingService", () => {
  let service: CipherAccessMappingService;
  let cipherService: MockProxy<CipherService>;
  let collectionAdminService: MockProxy<CollectionAdminService>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let logService: MockProxy<LogService>;

  const mockOrgId = "org123" as OrganizationId;
  const mockUserId = "user123" as UserId;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    collectionAdminService = mock<CollectionAdminService>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    logService = mock<LogService>();

    service = new CipherAccessMappingService(
      cipherService,
      collectionAdminService,
      organizationUserApiService,
      logService,
    );
  });

  // Helper function to create a collection access selection view
  function createCollectionAccessSelectionView(
    id: string,
    readOnly = false,
    hidePasswords = false,
    manage = false,
  ): CollectionAccessSelectionView {
    return {
      id,
      readOnly,
      hidePasswords,
      manage,
    } as CollectionAccessSelectionView;
  }

  // Helper function to create a mock org user response
  function createMockOrgUserResponse(
    userId: string,
    email: string,
    groups: string[] = [],
  ): OrganizationUserUserDetailsResponse {
    return {
      userId,
      email,
      groups,
    } as OrganizationUserUserDetailsResponse;
  }

  describe("getAllCiphersWithMemberAccess", () => {
    it("should map ciphers with direct user access", async () => {
      // Setup mock cipher
      const mockCipher = new CipherView();
      mockCipher.id = "cipher1";
      mockCipher.name = "Test Cipher";
      mockCipher.type = CipherType.Login;
      mockCipher.collectionIds = ["collection1"];

      // Setup mock collection
      const mockCollection = {
        id: "collection1",
        name: "Collection 1",
        users: [createCollectionAccessSelectionView("user1", false, false, true)],
        groups: [],
      } as unknown as CollectionAdminView;

      // Setup mock org user response
      const mockOrgUser = createMockOrgUserResponse("user1", "user1@example.com", []);
      const mockListResponse = {
        data: [mockOrgUser],
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([mockCipher]);
      collectionAdminService.collectionAdminViews$ = jest
        .fn()
        .mockReturnValue(of([mockCollection])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.getAllCiphersWithMemberAccess(mockOrgId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].cipher.id).toBe("cipher1");
      expect(result[0].totalMemberCount).toBe(1);
      expect(result[0].members[0].userId).toBe("user1");
      expect(result[0].members[0].email).toBe("user1@example.com");
      expect(result[0].members[0].accessPaths[0].type).toBe("direct");
      expect(result[0].members[0].effectivePermissions.canEdit).toBe(true);
      expect(result[0].members[0].effectivePermissions.canManage).toBe(true);
    });

    it("should map ciphers with group-based access", async () => {
      // Setup mock cipher
      const mockCipher = new CipherView();
      mockCipher.id = "cipher1";
      mockCipher.name = "Test Cipher";
      mockCipher.type = CipherType.Login;
      mockCipher.collectionIds = ["collection1"];

      // Setup mock collection with group access
      const mockCollection = {
        id: "collection1",
        name: "Collection 1",
        users: [],
        groups: [createCollectionAccessSelectionView("group1", true, false, false)],
      } as unknown as CollectionAdminView;

      // Setup mock org user in group
      const mockOrgUser = createMockOrgUserResponse("user2", "user2@example.com", ["group1"]);
      const mockListResponse = {
        data: [mockOrgUser],
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([mockCipher]);
      collectionAdminService.collectionAdminViews$ = jest
        .fn()
        .mockReturnValue(of([mockCollection])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.getAllCiphersWithMemberAccess(mockOrgId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].totalMemberCount).toBe(1);
      expect(result[0].members[0].userId).toBe("user2");
      expect(result[0].members[0].accessPaths[0].type).toBe("group");
      expect(result[0].members[0].accessPaths[0].groupId).toBe("group1");
      expect(result[0].members[0].effectivePermissions.canEdit).toBe(false);
      expect(result[0].members[0].effectivePermissions.canViewPasswords).toBe(true);
    });

    it("should handle unassigned ciphers", async () => {
      // Setup mock cipher with no collections
      const mockCipher = new CipherView();
      mockCipher.id = "cipher1";
      mockCipher.name = "Unassigned Cipher";
      mockCipher.type = CipherType.Login;
      mockCipher.collectionIds = [];

      const mockListResponse = {
        data: [],
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([mockCipher]);
      collectionAdminService.collectionAdminViews$ = jest.fn().mockReturnValue(of([])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.getAllCiphersWithMemberAccess(mockOrgId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].unassigned).toBe(true);
      expect(result[0].totalMemberCount).toBe(0);
      expect(result[0].members).toHaveLength(0);
    });

    it("should combine multiple access paths for same user", async () => {
      // Setup mock cipher assigned to two collections
      const mockCipher = new CipherView();
      mockCipher.id = "cipher1";
      mockCipher.name = "Test Cipher";
      mockCipher.type = CipherType.Login;
      mockCipher.collectionIds = ["collection1", "collection2"];

      // Setup two collections with same user
      const mockCollection1 = {
        id: "collection1",
        name: "Collection 1",
        users: [createCollectionAccessSelectionView("user1", true, true, false)],
        groups: [],
      } as unknown as CollectionAdminView;

      const mockCollection2 = {
        id: "collection2",
        name: "Collection 2",
        users: [createCollectionAccessSelectionView("user1", false, false, true)],
        groups: [],
      } as unknown as CollectionAdminView;

      const mockOrgUser = createMockOrgUserResponse("user1", "user1@example.com", []);
      const mockListResponse = {
        data: [mockOrgUser],
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([mockCipher]);
      collectionAdminService.collectionAdminViews$ = jest
        .fn()
        .mockReturnValue(of([mockCollection1, mockCollection2])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.getAllCiphersWithMemberAccess(mockOrgId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].totalMemberCount).toBe(1);
      expect(result[0].members[0].accessPaths).toHaveLength(2);
      // Most permissive should win
      expect(result[0].members[0].effectivePermissions.canEdit).toBe(true);
      expect(result[0].members[0].effectivePermissions.canViewPasswords).toBe(true);
      expect(result[0].members[0].effectivePermissions.canManage).toBe(true);
    });
  });

  describe("getSimplifiedCipherAccessMap", () => {
    it("should return simplified mapping of cipher IDs to user IDs", async () => {
      const mockCipher = new CipherView();
      mockCipher.id = "cipher1";
      mockCipher.name = "Test Cipher";
      mockCipher.collectionIds = ["collection1"];

      const mockCollection = {
        id: "collection1",
        users: [createCollectionAccessSelectionView("user1")],
        groups: [],
      } as unknown as CollectionAdminView;

      const mockOrgUser = createMockOrgUserResponse("user1", "user1@example.com", []);
      const mockListResponse = {
        data: [mockOrgUser],
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([mockCipher]);
      collectionAdminService.collectionAdminViews$ = jest
        .fn()
        .mockReturnValue(of([mockCollection])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.getSimplifiedCipherAccessMap(mockOrgId, mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].cipherId).toBe("cipher1");
      expect(result[0].cipherName).toBe("Test Cipher");
      expect(result[0].userIds.size).toBe(1);
      expect(result[0].userIds.has("user1")).toBe(true);
    });
  });

  describe("findMembersForCipher", () => {
    it("should return members with access to specific cipher", async () => {
      const mockCipher = new CipherView();
      mockCipher.id = "cipher1";
      mockCipher.name = "Test Cipher";
      mockCipher.collectionIds = ["collection1"];

      const mockCollection = {
        id: "collection1",
        users: [createCollectionAccessSelectionView("user1")],
        groups: [],
      } as unknown as CollectionAdminView;

      const mockOrgUser = createMockOrgUserResponse("user1", "user1@example.com", []);
      const mockListResponse = {
        data: [mockOrgUser],
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([mockCipher]);
      collectionAdminService.collectionAdminViews$ = jest
        .fn()
        .mockReturnValue(of([mockCollection])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.findMembersForCipher(mockOrgId, mockUserId, "cipher1");

      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
      expect(result![0].userId).toBe("user1");
    });

    it("should return null for non-existent cipher", async () => {
      const mockListResponse = {
        data: [],
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([]);
      collectionAdminService.collectionAdminViews$ = jest.fn().mockReturnValue(of([])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.findMembersForCipher(mockOrgId, mockUserId, "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("generateCipherMemberCountReport", () => {
    it("should generate report sorted by member count", async () => {
      const cipher1 = new CipherView();
      cipher1.id = "cipher1";
      cipher1.name = "Cipher 1";
      cipher1.collectionIds = ["collection1"];

      const cipher2 = new CipherView();
      cipher2.id = "cipher2";
      cipher2.name = "Cipher 2";
      cipher2.collectionIds = ["collection2"];

      const collection1 = {
        id: "collection1",
        users: [createCollectionAccessSelectionView("user1")],
        groups: [],
      } as unknown as CollectionAdminView;

      const collection2 = {
        id: "collection2",
        users: [
          createCollectionAccessSelectionView("user2"),
          createCollectionAccessSelectionView("user3"),
        ],
        groups: [],
      } as unknown as CollectionAdminView;

      const mockOrgUsers = [
        createMockOrgUserResponse("user1", "user1@example.com", []),
        createMockOrgUserResponse("user2", "user2@example.com", []),
        createMockOrgUserResponse("user3", "user3@example.com", []),
      ];
      const mockListResponse = {
        data: mockOrgUsers,
      } as ListResponse<OrganizationUserUserDetailsResponse>;

      cipherService.getAllFromApiForOrganization.mockResolvedValue([cipher1, cipher2]);
      collectionAdminService.collectionAdminViews$ = jest
        .fn()
        .mockReturnValue(of([collection1, collection2])) as any;
      organizationUserApiService.getAllUsers.mockResolvedValue(mockListResponse);

      const result = await service.generateCipherMemberCountReport(mockOrgId, mockUserId);

      expect(result).toHaveLength(2);
      // Should be sorted descending by member count
      expect(result[0].cipherId).toBe("cipher2");
      expect(result[0].memberCount).toBe(2);
      expect(result[1].cipherId).toBe("cipher1");
      expect(result[1].memberCount).toBe(1);
    });
  });
});
