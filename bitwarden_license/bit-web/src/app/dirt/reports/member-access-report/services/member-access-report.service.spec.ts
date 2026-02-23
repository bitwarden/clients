import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
  OrganizationUserUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
import {
  GroupApiService,
  GroupView,
} from "@bitwarden/web-vault/app/admin-console/organizations/core";

import { MemberAccessReportApiService } from "./member-access-report-api.service";
import {
  memberAccessReportsMock,
  memberAccessWithoutAccessDetailsReportsMock,
} from "./member-access-report.mock";
import { MemberAccessReportService } from "./member-access-report.service";

describe("MemberAccessReportService", () => {
  const mockOrganizationId = "mockOrgId" as OrganizationId;
  const reportApiService = mock<MemberAccessReportApiService>();
  const mockEncryptService = mock<EncryptService>();
  const userId = newGuid() as UserId;
  const mockAccountService = mockAccountServiceWith(userId);
  const mockKeyService = mock<KeyService>();
  const mockCollectionAdminService = mock<CollectionAdminService>();
  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockCipherService = mock<CipherService>();
  const mockLogService = mock<LogService>();
  const mockGroupApiService = mock<GroupApiService>();
  let memberAccessReportService: MemberAccessReportService;
  const i18nMock = mock<I18nService>({
    t(key) {
      return key;
    },
  });

  beforeEach(() => {
    mockKeyService.orgKeys$.mockReturnValue(
      of({ mockOrgId: new SymmetricCryptoKey(new Uint8Array(64)) }),
    );
    reportApiService.getMemberAccessData.mockImplementation(() =>
      Promise.resolve(memberAccessReportsMock),
    );
    // Default: mock groups as empty array (tests can override)
    mockGroupApiService.getAll.mockResolvedValue([]);
    memberAccessReportService = new MemberAccessReportService(
      reportApiService,
      i18nMock,
      mockEncryptService,
      mockKeyService,
      mockAccountService,
      mockCollectionAdminService,
      mockOrganizationUserApiService,
      mockCipherService,
      mockLogService,
      mockGroupApiService,
    );
  });

  // Helper functions to create properly typed test data
  const createMockCollection = (
    id: string,
    name: string,
    users: Array<{ id: string; readOnly: boolean; hidePasswords: boolean; manage: boolean }> = [],
    groups: Array<{ id: string; readOnly: boolean; hidePasswords: boolean; manage: boolean }> = [],
  ): Partial<CollectionAdminView> =>
    ({
      id,
      name,
      users,
      groups,
    }) as Partial<CollectionAdminView>;

  const createMockOrganizationUser = (
    id: string,
    email: string,
    name: string | null | undefined,
    options: {
      twoFactorEnabled?: boolean;
      usesKeyConnector?: boolean;
      resetPasswordEnrolled?: boolean;
      groups?: string[];
      avatarColor?: string;
    } = {},
  ): Partial<OrganizationUserUserDetailsResponse> => ({
    id,
    email,
    name: name ?? undefined, // Convert null to undefined to match expected type
    twoFactorEnabled: options.twoFactorEnabled ?? false,
    usesKeyConnector: options.usesKeyConnector ?? false,
    resetPasswordEnrolled: options.resetPasswordEnrolled ?? false,
    groups: options.groups ?? [],
    avatarColor: options.avatarColor,
  });

  const createMockCipher = (id: string, collectionIds: string[]): Partial<CipherView> => ({
    id,
    collectionIds,
  });

  const createMockGroup = (id: string, name: string): GroupView => {
    const group = new GroupView();
    group.id = id;
    group.organizationId = mockOrganizationId;
    group.name = name;
    group.externalId = "";
    return group;
  };

  // Scenario helpers to reduce test duplication
  const setupSingleUserWithDirectAccess = (
    userId: string,
    collectionId: string,
    cipherIds: string[],
    userOptions: {
      email?: string;
      name?: string;
      twoFactorEnabled?: boolean;
      usesKeyConnector?: boolean;
      resetPasswordEnrolled?: boolean;
    } = {},
  ) => {
    mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
      of([
        createMockCollection(collectionId, "Test Collection", [
          { id: userId, readOnly: false, hidePasswords: false, manage: false },
        ]),
      ] as CollectionAdminView[]),
    );

    mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
      data: [
        createMockOrganizationUser(
          userId,
          userOptions.email ?? "user@test.com",
          userOptions.name ?? "User",
          {
            twoFactorEnabled: userOptions.twoFactorEnabled ?? false,
            usesKeyConnector: userOptions.usesKeyConnector ?? false,
            resetPasswordEnrolled: userOptions.resetPasswordEnrolled ?? false,
            groups: [],
          },
        ),
      ],
    } as ListResponse<OrganizationUserUserDetailsResponse>);

    mockCipherService.getAllFromApiForOrganization.mockResolvedValue(
      cipherIds.map((id) => createMockCipher(id, [collectionId])) as CipherView[],
    );
  };

  const setupUserWithGroupAccess = (
    userId: string,
    groupId: string,
    collectionId: string,
    cipherIds: string[],
    userOptions: {
      email?: string;
      name?: string;
      groupName?: string;
    } = {},
  ) => {
    mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
      of([
        createMockCollection(
          collectionId,
          "Group Collection",
          [],
          [{ id: groupId, readOnly: false, hidePasswords: false, manage: false }],
        ),
      ] as CollectionAdminView[]),
    );

    mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
      data: [
        createMockOrganizationUser(
          userId,
          userOptions.email ?? "user@test.com",
          userOptions.name ?? "User",
          {
            groups: [groupId],
          },
        ),
      ],
    } as ListResponse<OrganizationUserUserDetailsResponse>);

    // Mock group data with actual group name
    mockGroupApiService.getAll.mockResolvedValue([
      createMockGroup(groupId, userOptions.groupName ?? "Test Group"),
    ]);

    mockCipherService.getAllFromApiForOrganization.mockResolvedValue(
      cipherIds.map((id) => createMockCipher(id, [collectionId])) as CipherView[],
    );
  };

  describe("generateMemberAccessReportView", () => {
    it("should generate member access report view", async () => {
      const result =
        await memberAccessReportService.generateMemberAccessReportView(mockOrganizationId);

      expect(result).toEqual([
        {
          name: "Sarah Johnson",
          email: "sjohnson@email.com",
          avatarColor: "",
          collectionsCount: 3,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "James Lull",
          email: "jlull@email.com",
          avatarColor: "",
          collectionsCount: 2,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "Beth Williams",
          email: "bwilliams@email.com",
          avatarColor: "",
          collectionsCount: 2,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "Ray Williams",
          email: "rwilliams@email.com",
          avatarColor: "",
          collectionsCount: 3,
          groupsCount: 3,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
      ]);
    });
  });

  describe("generateUserReportExportItems", () => {
    it("should generate user report export items", async () => {
      const result =
        await memberAccessReportService.generateUserReportExportItems(mockOrganizationId);

      const filteredReportItems = result
        .filter(
          (item) =>
            (item.name === "Sarah Johnson" &&
              item.group === "Group 1" &&
              item.totalItems === "0") ||
            (item.name === "James Lull" && item.group === "Group 4" && item.totalItems === "0"),
        )
        .map((item) => ({
          name: item.name,
          email: item.email,
          group: item.group,
          totalItems: item.totalItems,
          accountRecovery: item.accountRecovery,
          twoStepLogin: item.twoStepLogin,
        }));

      expect(filteredReportItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: "sjohnson@email.com",
            name: "Sarah Johnson",
            twoStepLogin: "memberAccessReportTwoFactorEnabledTrue",
            accountRecovery: "memberAccessReportAuthenticationEnabledTrue",
            group: "Group 1",
            totalItems: "0",
          }),
          expect.objectContaining({
            email: "jlull@email.com",
            name: "James Lull",
            twoStepLogin: "memberAccessReportTwoFactorEnabledFalse",
            accountRecovery: "memberAccessReportAuthenticationEnabledFalse",
            group: "Group 4",
            totalItems: "0",
          }),
        ]),
      );
    });

    it("should generate user report export items and include users with no access", async () => {
      reportApiService.getMemberAccessData.mockImplementation(() =>
        Promise.resolve(memberAccessWithoutAccessDetailsReportsMock),
      );
      const result =
        await memberAccessReportService.generateUserReportExportItems(mockOrganizationId);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: "asmith@email.com",
            name: "Alice Smith",
            twoStepLogin: "memberAccessReportTwoFactorEnabledTrue",
            accountRecovery: "memberAccessReportAuthenticationEnabledTrue",
            group: "Alice Group 1",
            totalItems: "0",
          }),
          expect.objectContaining({
            email: "rbrown@email.com",
            name: "Robert Brown",
            twoStepLogin: "memberAccessReportTwoFactorEnabledFalse",
            accountRecovery: "memberAccessReportAuthenticationEnabledFalse",
            group: "memberAccessReportNoGroup",
            totalItems: "0",
          }),
        ]),
      );
    });
  });

  describe("generateMemberAccessReportViewV2", () => {
    it("should generate report using frontend mapping with direct user access", async () => {
      const userId1 = "user-1";
      const userId2 = "user-2";
      const collectionId1 = "collection-1";
      const cipherId1 = "cipher-1";

      // Mock collections with direct user access
      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(
            collectionId1,
            "Test Collection",
            [
              { id: userId1, readOnly: false, hidePasswords: false, manage: false },
              { id: userId2, readOnly: true, hidePasswords: true, manage: false },
            ],
            [],
          ),
        ] as CollectionAdminView[]),
      );

      // Mock organization users
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", "User One", {
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [],
          }),
          createMockOrganizationUser(userId2, "user2@test.com", "User Two", {
            twoFactorEnabled: false,
            usesKeyConnector: true,
            resetPasswordEnrolled: false,
            groups: [],
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      // Mock ciphers
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher(cipherId1, [collectionId1]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateMemberAccessReportViewV2(mockOrganizationId);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: "user1@test.com",
            name: "User One",
            collectionsCount: 1,
            groupsCount: 0,
            itemsCount: 1,
            usesKeyConnector: false,
          }),
          expect.objectContaining({
            email: "user2@test.com",
            name: "User Two",
            collectionsCount: 1,
            groupsCount: 0,
            itemsCount: 1,
            usesKeyConnector: true,
          }),
        ]),
      );
    });

    it("should handle group-based access correctly", async () => {
      const userId1 = "user-1";
      const groupId1 = "group-1";
      const collectionId1 = "collection-1";
      const cipherId1 = "cipher-1";

      // Mock collections with group access
      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(
            collectionId1,
            "Group Collection",
            [],
            [{ id: groupId1, readOnly: false, hidePasswords: false, manage: false }],
          ),
        ] as CollectionAdminView[]),
      );

      // Mock organization users with group membership
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", "User One", {
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [groupId1],
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      // Mock groups with actual group name
      mockGroupApiService.getAll.mockResolvedValue([createMockGroup(groupId1, "Test Group")]);

      // Mock ciphers
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher(cipherId1, [collectionId1]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateMemberAccessReportViewV2(mockOrganizationId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: "user1@test.com",
        name: "User One",
        collectionsCount: 1,
        groupsCount: 1,
        itemsCount: 1,
      });
    });

    it("should aggregate multiple ciphers and collections correctly", async () => {
      const userId1 = "user-1";
      const collectionId1 = "collection-1";
      const collectionId2 = "collection-2";
      const cipherId1 = "cipher-1";
      const cipherId2 = "cipher-2";
      const cipherId3 = "cipher-3";

      // Mock collections
      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(collectionId1, "Collection 1", [
            { id: userId1, readOnly: false, hidePasswords: false, manage: false },
          ]),
          createMockCollection(collectionId2, "Collection 2", [
            { id: userId1, readOnly: false, hidePasswords: false, manage: false },
          ]),
        ] as CollectionAdminView[]),
      );

      // Mock organization users
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", "User One", {
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [],
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      // Mock ciphers - user has access via 2 collections
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher(cipherId1, [collectionId1]),
        createMockCipher(cipherId2, [collectionId1, collectionId2]),
        createMockCipher(cipherId3, [collectionId2]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateMemberAccessReportViewV2(mockOrganizationId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: "user1@test.com",
        collectionsCount: 2, // Distinct collections
        groupsCount: 0,
        itemsCount: 3, // Distinct ciphers
      });
    });

    it("should handle users with no access correctly", async () => {
      const userId1 = "user-1";
      const collectionId1 = "collection-1";

      // Mock collection with no user assignments
      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([createMockCollection(collectionId1, "Empty Collection")] as CollectionAdminView[]),
      );

      // Mock organization users (user exists but has no access)
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", "User One", {
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [],
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      // Mock ciphers
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher("cipher-1", [collectionId1]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateMemberAccessReportViewV2(mockOrganizationId);

      // User has no access, so shouldn't appear in report
      expect(result).toHaveLength(0);
    });

    it("should use email as name fallback when name is not available", async () => {
      const userId1 = "user-1";
      const collectionId1 = "collection-1";

      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(collectionId1, "Test Collection", [
            { id: userId1, readOnly: false, hidePasswords: false, manage: false },
          ]),
        ] as CollectionAdminView[]),
      );

      // User without name
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", null, {
            twoFactorEnabled: false,
            usesKeyConnector: false,
            resetPasswordEnrolled: false,
            groups: [],
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher("cipher-1", [collectionId1]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateMemberAccessReportViewV2(mockOrganizationId);

      expect(result[0].name).toBe("user1@test.com");
    });
  });

  describe("generateUserReportExportItemsV2", () => {
    it("should generate export items with all metadata fields", async () => {
      setupSingleUserWithDirectAccess("user-1", "collection-1", ["cipher-1"], {
        email: "user1@test.com",
        name: "User One",
        twoFactorEnabled: true,
        resetPasswordEnrolled: true,
      });

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: "user1@test.com",
        name: "User One",
        twoStepLogin: "memberAccessReportTwoFactorEnabledTrue",
        accountRecovery: "memberAccessReportAuthenticationEnabledTrue",
        collection: "Test Collection",
        totalItems: "1",
      });
    });

    it("should include group information in export when access is via group", async () => {
      setupUserWithGroupAccess("user-1", "group-1", "collection-1", ["cipher-1"], {
        email: "user1@test.com",
        name: "User One",
        groupName: "Engineering Team",
      });

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      expect(result).toHaveLength(1);
      // Group name should be populated from API
      expect(result[0].group).toBe("Engineering Team");
    });

    it("should group multiple ciphers and count totalItems correctly", async () => {
      setupSingleUserWithDirectAccess(
        "user-1",
        "collection-1",
        ["cipher-1", "cipher-2", "cipher-3"],
        {
          email: "user1@test.com",
          name: "User One",
        },
      );

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      // Should produce 1 row (not 3) with totalItems = 3
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: "user1@test.com",
        name: "User One",
        collection: "Test Collection",
        totalItems: "3", // Grouped count
      });
    });

    it("should create separate rows for different access paths (group vs direct)", async () => {
      const userId1 = "user-1";
      const groupId1 = "group-1";
      const collectionId1 = "collection-1";
      const cipherId1 = "cipher-1";
      const cipherId2 = "cipher-2";

      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(
            collectionId1,
            "Mixed Access Collection",
            [{ id: userId1, readOnly: false, hidePasswords: false, manage: false }],
            [{ id: groupId1, readOnly: false, hidePasswords: false, manage: false }],
          ),
        ] as CollectionAdminView[]),
      );

      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", "User One", {
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [groupId1], // User has both direct AND group access
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      // Mock groups
      mockGroupApiService.getAll.mockResolvedValue([
        createMockGroup(groupId1, "Mixed Access Group"),
      ]);

      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher(cipherId1, [collectionId1]),
        createMockCipher(cipherId2, [collectionId1]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      // Should produce 2 rows: one for direct access, one for group access
      // Each with 2 ciphers
      expect(result).toHaveLength(2);
      expect(result.every((item) => item.totalItems === "2")).toBe(true);
    });

    it("should handle edge cases with empty/missing data", async () => {
      const userId1 = "user-1";
      const collectionId1 = "collection-1";
      const cipherId1 = "cipher-1";

      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(
            collectionId1,
            "", // Empty collection name
            [{ id: userId1, readOnly: false, hidePasswords: false, manage: false }],
          ),
        ] as CollectionAdminView[]),
      );

      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(
            userId1,
            "user1@test.com",
            "", // Empty name
            {
              twoFactorEnabled: false,
              usesKeyConnector: false,
              resetPasswordEnrolled: false,
              groups: [],
            },
          ),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher(cipherId1, [collectionId1]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: "user1@test.com", // Falls back to email
        collection: "memberAccessReportNoCollection", // Falls back to translation key
        group: "memberAccessReportNoGroup", // Falls back to translation key
      });
    });

    it("should populate group names from GroupApiService", async () => {
      const userId1 = "user-1";
      const groupId1 = "group-1";
      const groupId2 = "group-2";
      const collectionId1 = "collection-1";
      const collectionId2 = "collection-2";

      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(
            collectionId1,
            "Engineering Collection",
            [],
            [{ id: groupId1, readOnly: false, hidePasswords: false, manage: false }],
          ),
          createMockCollection(
            collectionId2,
            "Marketing Collection",
            [],
            [{ id: groupId2, readOnly: false, hidePasswords: false, manage: false }],
          ),
        ] as CollectionAdminView[]),
      );

      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", "User One", {
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [groupId1, groupId2],
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      // Mock groups with actual names
      mockGroupApiService.getAll.mockResolvedValue([
        createMockGroup(groupId1, "Engineering Team"),
        createMockGroup(groupId2, "Marketing Team"),
      ]);

      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher("cipher-1", [collectionId1]),
        createMockCipher("cipher-2", [collectionId2]),
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      // Should have 2 rows, one per group
      expect(result).toHaveLength(2);

      // Verify group names are populated correctly
      const groups = result.map((item) => item.group).sort();
      expect(groups).toEqual(["Engineering Team", "Marketing Team"]);

      // Verify collections match groups
      expect(result.find((item) => item.group === "Engineering Team")?.collection).toBe(
        "Engineering Collection",
      );
      expect(result.find((item) => item.group === "Marketing Team")?.collection).toBe(
        "Marketing Collection",
      );
    });

    it("should skip ciphers with zero GUID", async () => {
      const userId1 = "user-1";
      const collectionId1 = "collection-1";
      const validCipherId = "cipher-1";
      const zeroGuid = "00000000-0000-0000-0000-000000000000";

      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          createMockCollection(collectionId1, "Test Collection", [
            { id: userId1, readOnly: false, hidePasswords: false, manage: false },
          ]),
        ] as CollectionAdminView[]),
      );

      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          createMockOrganizationUser(userId1, "user1@test.com", "User One", {
            twoFactorEnabled: false,
            usesKeyConnector: false,
            resetPasswordEnrolled: false,
            groups: [],
          }),
        ],
      } as ListResponse<OrganizationUserUserDetailsResponse>);

      // Mock ciphers including one with zero GUID
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        createMockCipher(validCipherId, [collectionId1]),
        createMockCipher(zeroGuid, [collectionId1]), // Should be filtered out
      ] as CipherView[]);

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      expect(result).toHaveLength(1);
      expect(result[0].totalItems).toBe("1"); // Only counts valid cipher
    });
  });
});
