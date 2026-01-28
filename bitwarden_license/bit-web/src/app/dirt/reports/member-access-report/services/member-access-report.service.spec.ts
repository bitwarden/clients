import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";
import { GroupApiService } from "@bitwarden/web-vault/app/admin-console/organizations/core/services/group/group-api.service";
import { GroupDetailsView } from "@bitwarden/web-vault/app/admin-console/organizations/core/views/group-details.view";

import { MemberAccessReportService } from "./member-access-report.service";

describe("MemberAccessReportService", () => {
  const mockOrganizationId = "mockOrgId" as OrganizationId;
  const userId = newGuid() as UserId;

  const mockOrganizationUserApiService = mock<OrganizationUserApiService>();
  const mockCollectionAdminService = mock<CollectionAdminService>();
  const mockGroupApiService = mock<GroupApiService>();
  const mockApiService = mock<ApiService>();
  const mockEncryptService = mock<EncryptService>();
  const mockAccountService = mockAccountServiceWith(userId);
  const mockKeyService = mock<KeyService>();
  const mockI18nService = mock<I18nService>({
    t(key) {
      return key;
    },
  });

  let service: MemberAccessReportService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockKeyService.orgKeys$.mockReturnValue(
      of({ mockOrgId: new SymmetricCryptoKey(new Uint8Array(64)) }),
    );

    // Mock account service
    mockAccountService.activeAccount$ = of({ id: userId } as any);

    service = new MemberAccessReportService(
      mockI18nService,
      mockEncryptService,
      mockKeyService,
      mockAccountService,
      mockOrganizationUserApiService,
      mockCollectionAdminService,
      mockGroupApiService,
      mockApiService,
    );
  });

  describe("generateUserReportExportItems", () => {
    describe("(No Name) fallback", () => {
      it("should use '(No Name)' when user has empty name string", async () => {
        // Setup mock data with empty name
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "", // Empty name
              email: "user@example.com",
              twoFactorEnabled: false,
              resetPasswordEnrolled: false,
              usesKeyConnector: false,
              groups: ["group1"],
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
          of([
            {
              id: "col1",
              name: "Test Collection",
              groups: [{ id: "group1", readOnly: false, hidePasswords: false, manage: false }],
              users: [],
            } as CollectionAdminView,
          ]),
        );

        mockGroupApiService.getAllDetails.mockResolvedValue([
          {
            id: "group1",
            name: "Test Group",
            collections: [{ id: "col1", readOnly: false, hidePasswords: false, manage: false }],
          } as GroupDetailsView,
        ]);

        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first (required before export)
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        // Verify all export items have "(No Name)" instead of empty string
        expect(result.length).toBeGreaterThan(0);
        result.forEach((item) => {
          expect(item.name).toBe("(No Name)");
        });
      });

      it("should use actual name when user has non-empty name", async () => {
        // Setup mock data with actual name
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "John Doe",
              email: "john@example.com",
              twoFactorEnabled: false,
              resetPasswordEnrolled: false,
              usesKeyConnector: false,
              groups: ["group1"],
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
          of([
            {
              id: "col1",
              name: "Test Collection",
              groups: [{ id: "group1", readOnly: false, hidePasswords: false, manage: false }],
              users: [],
            } as CollectionAdminView,
          ]),
        );

        mockGroupApiService.getAllDetails.mockResolvedValue([
          {
            id: "group1",
            name: "Test Group",
            collections: [{ id: "col1", readOnly: false, hidePasswords: false, manage: false }],
          } as GroupDetailsView,
        ]);

        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        // Verify actual name is used
        expect(result.length).toBeGreaterThan(0);
        result.forEach((item) => {
          expect(item.name).toBe("John Doe");
        });
      });

      it("should use '(No Name)' for users with no collection or group access", async () => {
        // Setup mock data with empty name and no access
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "", // Empty name
              email: "user@example.com",
              twoFactorEnabled: false,
              resetPasswordEnrolled: false,
              usesKeyConnector: false,
              groups: [], // No groups
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(of([]));
        mockGroupApiService.getAllDetails.mockResolvedValue([]);
        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        // Should have one row for user with no access
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("(No Name)");
        expect(result[0].email).toBe("user@example.com");
        expect(result[0].group).toBe("memberAccessReportNoGroup");
        expect(result[0].collection).toBe("memberAccessReportNoCollection");
      });
    });

    describe("Groups with no collections", () => {
      it("should include group membership even when group has no collections", async () => {
        // Setup: user in a group, but group has no collections
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "Jane Doe",
              email: "jane@example.com",
              twoFactorEnabled: true,
              resetPasswordEnrolled: true,
              usesKeyConnector: false,
              groups: ["group1"], // User is in group1
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        // No collections at all
        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(of([]));

        // Group exists but has no collections
        mockGroupApiService.getAllDetails.mockResolvedValue([
          {
            id: "group1",
            name: "Empty Group",
            collections: [], // No collections
          } as GroupDetailsView,
        ]);

        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        // Should have one row showing the group membership
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Jane Doe");
        expect(result[0].email).toBe("jane@example.com");
        expect(result[0].group).toBe("Empty Group");
        expect(result[0].collection).toBe("memberAccessReportNoCollection");
        expect(result[0].collectionPermission).toBe("memberAccessReportNoCollectionPermission");
        expect(result[0].totalItems).toBe("0");
      });

      it("should create separate rows for groups with collections and groups without", async () => {
        // Setup: user in two groups, one with collections and one without
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "Multi Group User",
              email: "multi@example.com",
              twoFactorEnabled: false,
              resetPasswordEnrolled: false,
              usesKeyConnector: false,
              groups: ["group1", "group2"], // In both groups
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        // One collection assigned to group1
        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
          of([
            {
              id: "col1",
              name: "Collection 1",
              groups: [{ id: "group1", readOnly: false, hidePasswords: false, manage: true }],
              users: [],
            } as CollectionAdminView,
          ]),
        );

        // group1 has collection, group2 does not
        mockGroupApiService.getAllDetails.mockResolvedValue([
          {
            id: "group1",
            name: "Group With Collection",
            collections: [{ id: "col1", readOnly: false, hidePasswords: false, manage: true }],
          } as GroupDetailsView,
          {
            id: "group2",
            name: "Group Without Collection",
            collections: [],
          } as GroupDetailsView,
        ]);

        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        // Should have 2 rows: one for group1 with collection, one for group2 without
        expect(result).toHaveLength(2);

        // Find rows by group name
        const group1Row = result.find((r) => r.group === "Group With Collection");
        const group2Row = result.find((r) => r.group === "Group Without Collection");

        expect(group1Row).toBeDefined();
        expect(group1Row?.collection).toBe("Collection 1");
        expect(group1Row?.collectionPermission).not.toBe(
          "memberAccessReportNoCollectionPermission",
        );

        expect(group2Row).toBeDefined();
        expect(group2Row?.collection).toBe("memberAccessReportNoCollection");
        expect(group2Row?.collectionPermission).toBe("memberAccessReportNoCollectionPermission");
        expect(group2Row?.totalItems).toBe("0");
      });

      it("should show multiple collections for group with collections", async () => {
        // Setup: user in group with multiple collections
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "User Name",
              email: "user@example.com",
              twoFactorEnabled: false,
              resetPasswordEnrolled: false,
              usesKeyConnector: false,
              groups: ["group1"],
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        // Two collections both assigned to group1
        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
          of([
            {
              id: "col1",
              name: "Collection 1",
              groups: [{ id: "group1", readOnly: false, hidePasswords: false, manage: false }],
              users: [],
            } as CollectionAdminView,
            {
              id: "col2",
              name: "Collection 2",
              groups: [{ id: "group1", readOnly: true, hidePasswords: false, manage: false }],
              users: [],
            } as CollectionAdminView,
          ]),
        );

        mockGroupApiService.getAllDetails.mockResolvedValue([
          {
            id: "group1",
            name: "Multi Collection Group",
            collections: [
              { id: "col1", readOnly: false, hidePasswords: false, manage: false },
              { id: "col2", readOnly: true, hidePasswords: false, manage: false },
            ],
          } as GroupDetailsView,
        ]);

        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        // Should have 2 rows, one for each collection
        expect(result).toHaveLength(2);
        expect(result[0].group).toBe("Multi Collection Group");
        expect(result[1].group).toBe("Multi Collection Group");

        const collectionNames = result.map((r) => r.collection).sort();
        expect(collectionNames).toEqual(["Collection 1", "Collection 2"]);
      });
    });

    describe("Combined scenarios", () => {
      it("should handle user with empty name in group with no collections", async () => {
        // Combines both fixes: empty name + group without collections
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "",
              email: "noname@example.com",
              twoFactorEnabled: true,
              resetPasswordEnrolled: false,
              usesKeyConnector: false,
              groups: ["group1"],
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(of([]));

        mockGroupApiService.getAllDetails.mockResolvedValue([
          {
            id: "group1",
            name: "No Collection Group",
            collections: [],
          } as GroupDetailsView,
        ]);

        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("(No Name)");
        expect(result[0].group).toBe("No Collection Group");
        expect(result[0].collection).toBe("memberAccessReportNoCollection");
      });

      it("should handle multiple users with mixed name and group scenarios", async () => {
        // Complex scenario with multiple users
        mockOrganizationUserApiService.getAllUsers.mockResolvedValue({
          data: [
            {
              id: "user1",
              name: "Alice",
              email: "alice@example.com",
              twoFactorEnabled: true,
              resetPasswordEnrolled: true,
              usesKeyConnector: false,
              groups: ["group1"],
              avatarColor: null,
            } as any,
            {
              id: "user2",
              name: "",
              email: "bob@example.com",
              twoFactorEnabled: false,
              resetPasswordEnrolled: false,
              usesKeyConnector: false,
              groups: ["group2"],
              avatarColor: null,
            } as any,
          ],
        } as ListResponse<any>);

        mockCollectionAdminService.collectionAdminViews$.mockReturnValue(
          of([
            {
              id: "col1",
              name: "Collection A",
              groups: [{ id: "group1", readOnly: false, hidePasswords: false, manage: false }],
              users: [],
            } as CollectionAdminView,
          ]),
        );

        mockGroupApiService.getAllDetails.mockResolvedValue([
          {
            id: "group1",
            name: "Group A",
            collections: [{ id: "col1", readOnly: false, hidePasswords: false, manage: false }],
          } as GroupDetailsView,
          {
            id: "group2",
            name: "Group B",
            collections: [], // No collections
          } as GroupDetailsView,
        ]);

        mockApiService.getCiphersOrganization.mockResolvedValue({
          data: [] as CipherResponse[],
        });

        // Generate report view first
        await service.generateMemberAccessReportView(mockOrganizationId);

        // Generate export
        const result = await service.generateUserReportExportItems(mockOrganizationId);

        expect(result).toHaveLength(2);

        // Alice should have actual name with collection
        const aliceRow = result.find((r) => r.email === "alice@example.com");
        expect(aliceRow?.name).toBe("Alice");
        expect(aliceRow?.group).toBe("Group A");
        expect(aliceRow?.collection).toBe("Collection A");

        // Bob should have "(No Name)" and group without collection
        const bobRow = result.find((r) => r.email === "bob@example.com");
        expect(bobRow?.name).toBe("(No Name)");
        expect(bobRow?.group).toBe("Group B");
        expect(bobRow?.collection).toBe("memberAccessReportNoCollection");
      });
    });
  });
});
