import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  EffectivePermissionLevel,
  MemberAccessReportState,
  MemberAccessSummary,
} from "../../models/member-access-report.types";

import {
  CipherAccessMappingService,
  CipherMemberAccess,
  CipherWithMemberAccess,
  MemberAccessLoadState,
  CipherAccessMappingProgressiveResult,
} from "./cipher-access-mapping.service";
import { MemberAccessReportService } from "./member-access-report.service";

const TestOrgId = "test-org-id" as OrganizationId;
const TestUserId = "test-user-id" as UserId;

describe("MemberAccessReportService", () => {
  let service: MemberAccessReportService;
  let cipherService: MockProxy<CipherService>;
  let cipherAccessMappingService: MockProxy<CipherAccessMappingService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherAccessMappingService = mock<CipherAccessMappingService>();
    logService = mock<LogService>();

    // Create service with constructor injection
    service = new MemberAccessReportService(cipherService, cipherAccessMappingService, logService);
  });

  describe("pivotCipherDataToMemberSummaries", () => {
    it("should return empty array for empty input", () => {
      const result = service.pivotCipherDataToMemberSummaries([]);
      expect(result).toEqual([]);
    });

    it("should handle single member with direct collection access", () => {
      const ciphersWithMembers: CipherWithMemberAccess[] = [
        createCipherWithMembers("cipher-1", [
          createMemberAccess("user-1", "user1@test.com", [
            {
              type: "direct",
              collectionId: "col-1",
              collectionName: "Collection 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
      ];

      const result = service.pivotCipherDataToMemberSummaries(ciphersWithMembers);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<MemberAccessSummary>({
        userId: "user-1",
        email: "user1@test.com",
        name: null,
        cipherCount: 1,
        collectionCount: 1,
        groupCount: 0,
        highestPermission: EffectivePermissionLevel.Edit,
      });
    });

    it("should handle member with group-based access", () => {
      const ciphersWithMembers: CipherWithMemberAccess[] = [
        createCipherWithMembers("cipher-1", [
          createMemberAccess("user-1", "user1@test.com", [
            {
              type: "group",
              collectionId: "col-1",
              collectionName: "Collection 1",
              groupId: "group-1",
              groupName: "Group 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
      ];

      const result = service.pivotCipherDataToMemberSummaries(ciphersWithMembers);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<MemberAccessSummary>({
        userId: "user-1",
        email: "user1@test.com",
        name: null,
        cipherCount: 1,
        collectionCount: 1,
        groupCount: 1,
        highestPermission: EffectivePermissionLevel.Edit,
      });
    });

    it("should handle member with multiple access paths and aggregate permissions", () => {
      // Same member accessing multiple ciphers through different paths
      const ciphersWithMembers: CipherWithMemberAccess[] = [
        createCipherWithMembers("cipher-1", [
          createMemberAccess(
            "user-1",
            "user1@test.com",
            [
              {
                type: "direct",
                collectionId: "col-1",
                collectionName: "Collection 1",
                permissions: { readOnly: true, hidePasswords: false, manage: false },
              },
            ],
            { canEdit: false, canViewPasswords: true, canManage: false },
          ),
        ]),
        createCipherWithMembers("cipher-2", [
          createMemberAccess(
            "user-1",
            "user1@test.com",
            [
              {
                type: "group",
                collectionId: "col-2",
                collectionName: "Collection 2",
                groupId: "group-1",
                groupName: "Group 1",
                permissions: { readOnly: false, hidePasswords: false, manage: true },
              },
            ],
            { canEdit: true, canViewPasswords: true, canManage: true },
          ),
        ]),
        createCipherWithMembers("cipher-3", [
          createMemberAccess(
            "user-1",
            "user1@test.com",
            [
              {
                type: "group",
                collectionId: "col-3",
                collectionName: "Collection 3",
                groupId: "group-2",
                groupName: "Group 2",
                permissions: { readOnly: true, hidePasswords: true, manage: false },
              },
            ],
            { canEdit: false, canViewPasswords: false, canManage: false },
          ),
        ]),
      ];

      const result = service.pivotCipherDataToMemberSummaries(ciphersWithMembers);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual<MemberAccessSummary>({
        userId: "user-1",
        email: "user1@test.com",
        name: null,
        cipherCount: 3,
        collectionCount: 3,
        groupCount: 2,
        // Should be Manage because one path has manage permission
        highestPermission: EffectivePermissionLevel.Manage,
      });
    });

    it("should handle multiple members with different permission levels", () => {
      const ciphersWithMembers: CipherWithMemberAccess[] = [
        createCipherWithMembers("cipher-1", [
          createMemberAccess(
            "user-1",
            "user1@test.com",
            [
              {
                type: "direct",
                collectionId: "col-1",
                collectionName: "Collection 1",
                permissions: { readOnly: false, hidePasswords: false, manage: true },
              },
            ],
            { canEdit: true, canViewPasswords: true, canManage: true },
          ),
          createMemberAccess(
            "user-2",
            "user2@test.com",
            [
              {
                type: "direct",
                collectionId: "col-1",
                collectionName: "Collection 1",
                permissions: { readOnly: true, hidePasswords: false, manage: false },
              },
            ],
            { canEdit: false, canViewPasswords: true, canManage: false },
          ),
          createMemberAccess(
            "user-3",
            "user3@test.com",
            [
              {
                type: "direct",
                collectionId: "col-1",
                collectionName: "Collection 1",
                permissions: { readOnly: true, hidePasswords: true, manage: false },
              },
            ],
            { canEdit: false, canViewPasswords: false, canManage: false },
          ),
        ]),
      ];

      const result = service.pivotCipherDataToMemberSummaries(ciphersWithMembers);

      expect(result).toHaveLength(3);

      // Find each member in results
      const user1 = result.find((m) => m.userId === "user-1");
      const user2 = result.find((m) => m.userId === "user-2");
      const user3 = result.find((m) => m.userId === "user-3");

      expect(user1?.highestPermission).toBe(EffectivePermissionLevel.Manage);
      expect(user2?.highestPermission).toBe(EffectivePermissionLevel.ViewOnly);
      expect(user3?.highestPermission).toBe(EffectivePermissionLevel.HidePasswords);
    });

    it("should deduplicate collections and groups across multiple ciphers", () => {
      // Same member accessing multiple ciphers through the same collection/group
      const ciphersWithMembers: CipherWithMemberAccess[] = [
        createCipherWithMembers("cipher-1", [
          createMemberAccess("user-1", "user1@test.com", [
            {
              type: "group",
              collectionId: "col-1",
              collectionName: "Collection 1",
              groupId: "group-1",
              groupName: "Group 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
        createCipherWithMembers("cipher-2", [
          createMemberAccess("user-1", "user1@test.com", [
            {
              type: "group",
              collectionId: "col-1", // Same collection
              collectionName: "Collection 1",
              groupId: "group-1", // Same group
              groupName: "Group 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
        createCipherWithMembers("cipher-3", [
          createMemberAccess("user-1", "user1@test.com", [
            {
              type: "direct",
              collectionId: "col-1", // Same collection, direct access
              collectionName: "Collection 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
      ];

      const result = service.pivotCipherDataToMemberSummaries(ciphersWithMembers);

      expect(result).toHaveLength(1);
      expect(result[0].cipherCount).toBe(3); // 3 unique ciphers
      expect(result[0].collectionCount).toBe(1); // Only 1 unique collection
      expect(result[0].groupCount).toBe(1); // Only 1 unique group
    });

    it("should sort members by cipher count descending, then email ascending", () => {
      const ciphersWithMembers: CipherWithMemberAccess[] = [
        createCipherWithMembers("cipher-1", [
          createMemberAccess("user-a", "alice@test.com", [
            {
              type: "direct",
              collectionId: "col-1",
              collectionName: "Collection 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
          createMemberAccess("user-b", "bob@test.com", [
            {
              type: "direct",
              collectionId: "col-1",
              collectionName: "Collection 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
        createCipherWithMembers("cipher-2", [
          createMemberAccess("user-b", "bob@test.com", [
            {
              type: "direct",
              collectionId: "col-2",
              collectionName: "Collection 2",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
        createCipherWithMembers("cipher-3", [
          createMemberAccess("user-b", "bob@test.com", [
            {
              type: "direct",
              collectionId: "col-3",
              collectionName: "Collection 3",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
          createMemberAccess("user-c", "charlie@test.com", [
            {
              type: "direct",
              collectionId: "col-3",
              collectionName: "Collection 3",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
      ];

      const result = service.pivotCipherDataToMemberSummaries(ciphersWithMembers);

      expect(result).toHaveLength(3);
      // Bob has 3 ciphers, Alice and Charlie have 1 each
      expect(result[0].email).toBe("bob@test.com");
      expect(result[0].cipherCount).toBe(3);
      // Alice comes before Charlie alphabetically (both have 1 cipher)
      expect(result[1].email).toBe("alice@test.com");
      expect(result[1].cipherCount).toBe(1);
      expect(result[2].email).toBe("charlie@test.com");
      expect(result[2].cipherCount).toBe(1);
    });

    it("should handle member with null email", () => {
      const ciphersWithMembers: CipherWithMemberAccess[] = [
        createCipherWithMembers("cipher-1", [
          createMemberAccess("user-1", null, [
            {
              type: "direct",
              collectionId: "col-1",
              collectionName: "Collection 1",
              permissions: { readOnly: false, hidePasswords: false, manage: false },
            },
          ]),
        ]),
      ];

      const result = service.pivotCipherDataToMemberSummaries(ciphersWithMembers);

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe("(unknown)");
    });
  });

  describe("getMemberAccessSummariesProgressive$", () => {
    it("should return empty result for organization with no ciphers", (done) => {
      cipherService.getAllFromApiForOrganization.mockResolvedValue([]);

      const results: MemberAccessReportState[] = [];

      service.getMemberAccessSummariesProgressive$(TestOrgId, TestUserId).subscribe({
        next: (result) => {
          results.push(result.state);
          if (result.state === MemberAccessReportState.Complete) {
            expect(result.members).toEqual([]);
            expect(result.processedCipherCount).toBe(0);
            expect(result.totalCipherCount).toBe(0);
            expect(result.progressPercent).toBe(100);
            done();
          }
        },
        error: done.fail,
      });
    });

    it("should emit progressive results as batches complete", (done) => {
      const mockCiphers = [createMockCipherView("cipher-1"), createMockCipherView("cipher-2")];

      cipherService.getAllFromApiForOrganization.mockResolvedValue(mockCiphers);

      // Mock progressive results with two batches
      const progressiveResults$ = new BehaviorSubject<CipherAccessMappingProgressiveResult>({
        state: MemberAccessLoadState.ProcessingBatches,
        processedCiphers: [
          createCipherWithMembers("cipher-1", [
            createMemberAccess("user-1", "user1@test.com", [
              {
                type: "direct",
                collectionId: "col-1",
                collectionName: "Collection 1",
                permissions: { readOnly: false, hidePasswords: false, manage: false },
              },
            ]),
          ]),
        ],
        totalCipherCount: 2,
        processedCount: 1,
        progressPercent: 50,
        timings: {},
        counts: {},
      });

      cipherAccessMappingService.getAllCiphersWithMemberAccessProgressive$.mockReturnValue(
        progressiveResults$,
      );

      const results: MemberAccessReportState[] = [];

      service.getMemberAccessSummariesProgressive$(TestOrgId, TestUserId).subscribe({
        next: (result) => {
          results.push(result.state);

          if (result.state === MemberAccessReportState.ProcessingMembers) {
            // Emit the final batch
            progressiveResults$.next({
              state: MemberAccessLoadState.Complete,
              processedCiphers: [
                createCipherWithMembers("cipher-1", [
                  createMemberAccess("user-1", "user1@test.com", [
                    {
                      type: "direct",
                      collectionId: "col-1",
                      collectionName: "Collection 1",
                      permissions: { readOnly: false, hidePasswords: false, manage: false },
                    },
                  ]),
                ]),
                createCipherWithMembers("cipher-2", [
                  createMemberAccess("user-1", "user1@test.com", [
                    {
                      type: "direct",
                      collectionId: "col-2",
                      collectionName: "Collection 2",
                      permissions: { readOnly: false, hidePasswords: false, manage: false },
                    },
                  ]),
                ]),
              ],
              totalCipherCount: 2,
              processedCount: 2,
              progressPercent: 100,
              timings: {},
              counts: {},
            });
            progressiveResults$.complete();
          }

          if (result.state === MemberAccessReportState.Complete) {
            expect(result.members).toHaveLength(1);
            expect(result.members[0].cipherCount).toBe(2);
            expect(result.progressPercent).toBe(100);
            done();
          }
        },
        error: done.fail,
      });
    });

    it("should handle errors and emit error state", (done) => {
      cipherService.getAllFromApiForOrganization.mockRejectedValue(new Error("API Error"));

      service.getMemberAccessSummariesProgressive$(TestOrgId, TestUserId).subscribe({
        next: (result) => {
          if (result.state === MemberAccessReportState.Error) {
            expect(result.error).toBe("API Error");
            expect(result.members).toEqual([]);
            done();
          }
        },
        error: done.fail,
      });
    });
  });
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockCipherView(id: string): CipherView {
  const cipher = new CipherView();
  cipher.id = id;
  cipher.name = `Cipher ${id}`;
  return cipher;
}

function createMemberAccess(
  userId: string,
  email: string | null,
  accessPaths: CipherMemberAccess["accessPaths"],
  effectivePermissions?: CipherMemberAccess["effectivePermissions"],
): CipherMemberAccess {
  // Calculate default effective permissions from access paths if not provided
  const defaultPermissions = effectivePermissions ?? {
    canEdit: accessPaths.some((p) => !p.permissions.readOnly),
    canViewPasswords: accessPaths.some((p) => !p.permissions.hidePasswords),
    canManage: accessPaths.some((p) => p.permissions.manage),
  };

  return {
    userId,
    email,
    accessPaths,
    effectivePermissions: defaultPermissions,
  };
}

function createCipherWithMembers(
  cipherId: string,
  members: CipherMemberAccess[],
): CipherWithMemberAccess {
  const cipher = createMockCipherView(cipherId);
  return {
    cipher,
    members,
    totalMemberCount: members.length,
    unassigned: false,
  };
}
