import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { MemberAccessReportApiService } from "./member-access-report-api.service";
import {
  memberAccessReportsMock,
  memberAccessWithoutAccessDetailsReportsMock,
} from "./member-access-report.mock";
import { MemberAccessReportService } from "./member-access-report.service";

describe("ImportService", () => {
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
    );
  });

  describe("generateMemberAccessReportView", () => {
    it("should generate member access report view", async () => {
      const result =
        await memberAccessReportService.generateMemberAccessReportView(mockOrganizationId);

      expect(result).toEqual([
        {
          name: "Sarah Johnson",
          email: "sjohnson@email.com",
          collectionsCount: 3,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "James Lull",
          email: "jlull@email.com",
          collectionsCount: 2,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "Beth Williams",
          email: "bwilliams@email.com",
          collectionsCount: 2,
          groupsCount: 1,
          itemsCount: 0,
          userGuid: expect.any(String),
          usesKeyConnector: expect.any(Boolean),
        },
        {
          name: "Ray Williams",
          email: "rwilliams@email.com",
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
          {
            id: collectionId1,
            name: "Test Collection",
            users: [
              { id: userId1, readOnly: false, hidePasswords: false, manage: false },
              { id: userId2, readOnly: true, hidePasswords: true, manage: false },
            ],
            groups: [],
          },
        ] as any),
      );

      // Mock organization users
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: userId1,
            email: "user1@test.com",
            name: "User One",
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [],
          },
          {
            id: userId2,
            email: "user2@test.com",
            name: "User Two",
            twoFactorEnabled: false,
            usesKeyConnector: true,
            resetPasswordEnrolled: false,
            groups: [],
          },
        ],
      } as any);

      // Mock ciphers
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        { id: cipherId1, collectionIds: [collectionId1] },
      ] as any);

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
          {
            id: collectionId1,
            name: "Group Collection",
            users: [],
            groups: [{ id: groupId1, readOnly: false, hidePasswords: false, manage: false }],
          },
        ] as any),
      );

      // Mock organization users with group membership
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: userId1,
            email: "user1@test.com",
            name: "User One",
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [groupId1],
          },
        ],
      } as any);

      // Mock ciphers
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        { id: cipherId1, collectionIds: [collectionId1] },
      ] as any);

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
          {
            id: collectionId1,
            name: "Collection 1",
            users: [{ id: userId1, readOnly: false, hidePasswords: false, manage: false }],
            groups: [],
          },
          {
            id: collectionId2,
            name: "Collection 2",
            users: [{ id: userId1, readOnly: false, hidePasswords: false, manage: false }],
            groups: [],
          },
        ] as any),
      );

      // Mock organization users
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: userId1,
            email: "user1@test.com",
            name: "User One",
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [],
          },
        ],
      } as any);

      // Mock ciphers - user has access via 2 collections
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        { id: cipherId1, collectionIds: [collectionId1] },
        { id: cipherId2, collectionIds: [collectionId1, collectionId2] },
        { id: cipherId3, collectionIds: [collectionId2] },
      ] as any);

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
        of([
          {
            id: collectionId1,
            name: "Empty Collection",
            users: [],
            groups: [],
          },
        ] as any),
      );

      // Mock organization users (user exists but has no access)
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: userId1,
            email: "user1@test.com",
            name: "User One",
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [],
          },
        ],
      } as any);

      // Mock ciphers
      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        { id: "cipher-1", collectionIds: [collectionId1] },
      ] as any);

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
          {
            id: collectionId1,
            name: "Test Collection",
            users: [{ id: userId1, readOnly: false, hidePasswords: false, manage: false }],
            groups: [],
          },
        ] as any),
      );

      // User without name
      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: userId1,
            email: "user1@test.com",
            name: null,
            twoFactorEnabled: false,
            usesKeyConnector: false,
            resetPasswordEnrolled: false,
            groups: [],
          },
        ],
      } as any);

      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        { id: "cipher-1", collectionIds: [collectionId1] },
      ] as any);

      const result =
        await memberAccessReportService.generateMemberAccessReportViewV2(mockOrganizationId);

      expect(result[0].name).toBe("user1@test.com");
    });
  });

  describe("generateUserReportExportItemsV2", () => {
    it("should generate export items with all metadata fields", async () => {
      const userId1 = "user-1";
      const collectionId1 = "collection-1";
      const cipherId1 = "cipher-1";

      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          {
            id: collectionId1,
            name: "Test Collection",
            users: [{ id: userId1, readOnly: false, hidePasswords: false, manage: true }],
            groups: [],
          },
        ] as any),
      );

      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: userId1,
            email: "user1@test.com",
            name: "User One",
            twoFactorEnabled: true,
            usesKeyConnector: false,
            resetPasswordEnrolled: true,
            groups: [],
          },
        ],
      } as any);

      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        { id: cipherId1, collectionIds: [collectionId1] },
      ] as any);

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
      const userId1 = "user-1";
      const groupId1 = "group-1";
      const collectionId1 = "collection-1";
      const cipherId1 = "cipher-1";

      mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
        of([
          {
            id: collectionId1,
            name: "Group Collection",
            users: [],
            groups: [{ id: groupId1, readOnly: false, hidePasswords: false, manage: false }],
          },
        ] as any),
      );

      mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
        data: [
          {
            id: userId1,
            email: "user1@test.com",
            name: "User One",
            twoFactorEnabled: false,
            usesKeyConnector: false,
            resetPasswordEnrolled: false,
            groups: [groupId1],
          },
        ],
      } as any);

      mockCipherService.getAllFromApiForOrganization.mockResolvedValue([
        { id: cipherId1, collectionIds: [collectionId1] },
      ] as any);

      const result =
        await memberAccessReportService.generateUserReportExportItemsV2(mockOrganizationId);

      expect(result).toHaveLength(1);
      // Group name should be empty string because we don't fetch group names in the simplified test
      expect(result[0].group).toBe("");
    });
  });
});
