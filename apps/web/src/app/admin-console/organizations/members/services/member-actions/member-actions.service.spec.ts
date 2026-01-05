import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import {
  OrganizationUserType,
  OrganizationUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { OrganizationUserView } from "../../../core/views/organization-user.view";

import { REQUESTS_PER_BATCH, MemberActionsService } from "./member-actions.service";

describe("MemberActionsService", () => {
  let service: MemberActionsService;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationUserService: MockProxy<OrganizationUserService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let configService: MockProxy<ConfigService>;
  let accountService: FakeAccountService;
  let organizationMetadataService: MockProxy<OrganizationMetadataServiceAbstraction>;

  const userId = newGuid() as UserId;
  const organizationId = newGuid() as OrganizationId;
  const userIdToManage = newGuid();

  let mockOrganization: Organization;
  let mockOrgUser: OrganizationUserView;

  beforeEach(() => {
    organizationUserApiService = mock<OrganizationUserApiService>();
    organizationUserService = mock<OrganizationUserService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    configService = mock<ConfigService>();
    accountService = mockAccountServiceWith(userId);
    organizationMetadataService = mock<OrganizationMetadataServiceAbstraction>();

    mockOrganization = {
      id: organizationId,
      type: OrganizationUserType.Owner,
      canManageUsersPassword: true,
      hasPublicAndPrivateKeys: true,
      useResetPassword: true,
    } as Organization;

    mockOrgUser = {
      id: userIdToManage,
      userId: userIdToManage,
      type: OrganizationUserType.User,
      status: OrganizationUserStatusType.Confirmed,
      resetPasswordEnrolled: true,
    } as OrganizationUserView;

    service = new MemberActionsService(
      organizationUserApiService,
      organizationUserService,
      keyService,
      encryptService,
      configService,
      accountService,
      organizationMetadataService,
    );
  });

  describe("inviteUser", () => {
    it("should successfully invite a user", async () => {
      organizationUserApiService.postOrganizationUserInvite.mockResolvedValue(undefined);

      const result = await service.inviteUser(
        mockOrganization,
        "test@example.com",
        OrganizationUserType.User,
        {},
        [],
        [],
      );

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.postOrganizationUserInvite).toHaveBeenCalledWith(
        organizationId,
        {
          emails: ["test@example.com"],
          type: OrganizationUserType.User,
          accessSecretsManager: false,
          collections: [],
          groups: [],
          permissions: {},
        },
      );
    });

    it("should handle invite errors", async () => {
      const errorMessage = "Invitation failed";
      organizationUserApiService.postOrganizationUserInvite.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.inviteUser(
        mockOrganization,
        "test@example.com",
        OrganizationUserType.User,
      );

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("removeUser", () => {
    it("should successfully remove a user", async () => {
      organizationUserApiService.removeOrganizationUser.mockResolvedValue(undefined);

      const result = await service.removeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.removeOrganizationUser).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle remove errors", async () => {
      const errorMessage = "Remove failed";
      organizationUserApiService.removeOrganizationUser.mockRejectedValue(new Error(errorMessage));

      const result = await service.removeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("revokeUser", () => {
    it("should successfully revoke a user", async () => {
      organizationUserApiService.revokeOrganizationUser.mockResolvedValue(undefined);

      const result = await service.revokeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.revokeOrganizationUser).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle revoke errors", async () => {
      const errorMessage = "Revoke failed";
      organizationUserApiService.revokeOrganizationUser.mockRejectedValue(new Error(errorMessage));

      const result = await service.revokeUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("restoreUser", () => {
    it("should successfully restore a user", async () => {
      organizationUserApiService.restoreOrganizationUser.mockResolvedValue(undefined);

      const result = await service.restoreUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.restoreOrganizationUser).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle restore errors", async () => {
      const errorMessage = "Restore failed";
      organizationUserApiService.restoreOrganizationUser.mockRejectedValue(new Error(errorMessage));

      const result = await service.restoreUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("deleteUser", () => {
    it("should successfully delete a user", async () => {
      organizationUserApiService.deleteOrganizationUser.mockResolvedValue(undefined);

      const result = await service.deleteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.deleteOrganizationUser).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle delete errors", async () => {
      const errorMessage = "Delete failed";
      organizationUserApiService.deleteOrganizationUser.mockRejectedValue(new Error(errorMessage));

      const result = await service.deleteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("reinviteUser", () => {
    it("should successfully reinvite a user", async () => {
      organizationUserApiService.postOrganizationUserReinvite.mockResolvedValue(undefined);

      const result = await service.reinviteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: true });
      expect(organizationUserApiService.postOrganizationUserReinvite).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
      );
    });

    it("should handle reinvite errors", async () => {
      const errorMessage = "Reinvite failed";
      organizationUserApiService.postOrganizationUserReinvite.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await service.reinviteUser(mockOrganization, userIdToManage);

      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("confirmUser", () => {
    const publicKey = new Uint8Array([1, 2, 3, 4, 5]);

    it("should confirm user using new flow when feature flag is enabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      organizationUserService.confirmUser.mockReturnValue(of(undefined));

      const result = await service.confirmUser(mockOrgUser, publicKey, mockOrganization);

      expect(result).toEqual({ success: true });
      expect(organizationUserService.confirmUser).toHaveBeenCalledWith(
        mockOrganization,
        mockOrgUser.id,
        publicKey,
      );
      expect(organizationUserApiService.postOrganizationUserConfirm).not.toHaveBeenCalled();
    });

    it("should confirm user using exising flow when feature flag is disabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));

      const mockOrgKey = mock<OrgKey>();
      const mockOrgKeys = { [organizationId]: mockOrgKey };
      keyService.orgKeys$.mockReturnValue(of(mockOrgKeys));

      const mockEncryptedKey = new EncString("encrypted-key-data");
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(mockEncryptedKey);

      organizationUserApiService.postOrganizationUserConfirm.mockResolvedValue(undefined);

      const result = await service.confirmUser(mockOrgUser, publicKey, mockOrganization);

      expect(result).toEqual({ success: true });
      expect(keyService.orgKeys$).toHaveBeenCalledWith(userId);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(mockOrgKey, publicKey);
      expect(organizationUserApiService.postOrganizationUserConfirm).toHaveBeenCalledWith(
        organizationId,
        userIdToManage,
        expect.objectContaining({
          key: "encrypted-key-data",
        }),
      );
    });

    it("should handle missing organization keys", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));
      keyService.orgKeys$.mockReturnValue(of({}));

      const result = await service.confirmUser(mockOrgUser, publicKey, mockOrganization);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Organization keys not found");
    });

    it("should handle confirm errors", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(true));
      const errorMessage = "Confirm failed";
      organizationUserService.confirmUser.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const result = await service.confirmUser(mockOrgUser, publicKey, mockOrganization);

      expect(result.success).toBe(false);
      expect(result.error).toContain(errorMessage);
    });
  });

  describe("bulkReinvite", () => {
    const userIds = [newGuid() as UserId, newGuid() as UserId, newGuid() as UserId];

    describe("when feature flag is false", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(false));
      });

      it("should successfully reinvite multiple users", async () => {
        const mockResponse = new ListResponse(
          {
            data: userIds.map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite.mockResolvedValue(mockResponse);

        const result = await service.bulkReinvite(mockOrganization, userIds);

        expect(result.failed).toEqual([]);
        expect(result.successful).toBeDefined();
        expect(result.successful).toEqual(mockResponse);
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledWith(
          organizationId,
          userIds,
        );
      });

      it("should handle bulk reinvite errors", async () => {
        const errorMessage = "Bulk reinvite failed";
        organizationUserApiService.postManyOrganizationUserReinvite.mockRejectedValue(
          new Error(errorMessage),
        );

        const result = await service.bulkReinvite(mockOrganization, userIds);

        expect(result.successful).toBeUndefined();
        expect(result.failed).toHaveLength(3);
        expect(result.failed[0]).toEqual({ id: userIds[0], error: errorMessage });
      });
    });

    describe("when feature flag is true (batching behavior)", () => {
      beforeEach(() => {
        configService.getFeatureFlag$.mockReturnValue(of(true));
      });
      it("should process users in a single batch when count equals REQUESTS_PER_BATCH", async () => {
        const userIdsBatch = Array.from({ length: REQUESTS_PER_BATCH }, () => newGuid() as UserId);
        const mockResponse = new ListResponse(
          {
            data: userIdsBatch.map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite.mockResolvedValue(mockResponse);

        const result = await service.bulkReinvite(mockOrganization, userIdsBatch);

        expect(result.successful).toBeDefined();
        expect(result.successful?.response).toHaveLength(REQUESTS_PER_BATCH);
        expect(result.failed).toHaveLength(0);
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(
          1,
        );
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledWith(
          organizationId,
          userIdsBatch,
        );
      });

      it("should process users in multiple batches when count exceeds REQUESTS_PER_BATCH", async () => {
        const totalUsers = REQUESTS_PER_BATCH + 100;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);

        const mockResponse1 = new ListResponse(
          {
            data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        const mockResponse2 = new ListResponse(
          {
            data: userIdsBatch.slice(REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        const result = await service.bulkReinvite(mockOrganization, userIdsBatch);

        expect(result.successful).toBeDefined();
        expect(result.successful?.response).toHaveLength(totalUsers);
        expect(result.failed).toHaveLength(0);
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(
          2,
        );
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenNthCalledWith(
          1,
          organizationId,
          userIdsBatch.slice(0, REQUESTS_PER_BATCH),
        );
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenNthCalledWith(
          2,
          organizationId,
          userIdsBatch.slice(REQUESTS_PER_BATCH),
        );
      });

      it("should aggregate results across multiple successful batches", async () => {
        const totalUsers = REQUESTS_PER_BATCH + 50;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);

        const mockResponse1 = new ListResponse(
          {
            data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        const mockResponse2 = new ListResponse(
          {
            data: userIdsBatch.slice(REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        const result = await service.bulkReinvite(mockOrganization, userIdsBatch);

        expect(result.successful).toBeDefined();
        expect(result.successful?.response).toHaveLength(totalUsers);
        expect(result.successful?.response.slice(0, REQUESTS_PER_BATCH)).toEqual(
          mockResponse1.data,
        );
        expect(result.successful?.response.slice(REQUESTS_PER_BATCH)).toEqual(mockResponse2.data);
        expect(result.failed).toHaveLength(0);
      });

      it("should handle mixed individual errors across multiple batches", async () => {
        const totalUsers = REQUESTS_PER_BATCH + 4;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);

        const mockResponse1 = new ListResponse(
          {
            data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id, index) => ({
              id,
              error: index % 10 === 0 ? "Rate limit exceeded" : null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        const mockResponse2 = new ListResponse(
          {
            data: [
              { id: userIdsBatch[REQUESTS_PER_BATCH], error: null },
              { id: userIdsBatch[REQUESTS_PER_BATCH + 1], error: "Invalid email" },
              { id: userIdsBatch[REQUESTS_PER_BATCH + 2], error: null },
              { id: userIdsBatch[REQUESTS_PER_BATCH + 3], error: "User suspended" },
            ],
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        const result = await service.bulkReinvite(mockOrganization, userIdsBatch);

        // Count expected failures: every 10th index (0, 10, 20, ..., 490) in first batch + 2 explicit in second batch
        // Indices 0 to REQUESTS_PER_BATCH-1 where index % 10 === 0: that's floor((BATCH_SIZE-1)/10) + 1 values
        const expectedFailuresInBatch1 = Math.floor((REQUESTS_PER_BATCH - 1) / 10) + 1;
        const expectedFailuresInBatch2 = 2;
        const expectedTotalFailures = expectedFailuresInBatch1 + expectedFailuresInBatch2;
        const expectedSuccesses = totalUsers - expectedTotalFailures;

        expect(result.successful).toBeDefined();
        expect(result.successful?.response).toHaveLength(expectedSuccesses);
        expect(result.failed).toHaveLength(expectedTotalFailures);
        expect(result.failed.some((f) => f.error === "Rate limit exceeded")).toBe(true);
        expect(result.failed.some((f) => f.error === "Invalid email")).toBe(true);
        expect(result.failed.some((f) => f.error === "User suspended")).toBe(true);
      });

      it("should aggregate all failures when all batches fail", async () => {
        const totalUsers = REQUESTS_PER_BATCH + 100;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
        const errorMessage = "All batches failed";

        organizationUserApiService.postManyOrganizationUserReinvite.mockRejectedValue(
          new Error(errorMessage),
        );

        const result = await service.bulkReinvite(mockOrganization, userIdsBatch);

        expect(result.successful).toBeUndefined();
        expect(result.failed).toHaveLength(totalUsers);
        expect(result.failed.every((f) => f.error === errorMessage)).toBe(true);
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(
          2,
        );
      });

      it("should handle empty data in batch response", async () => {
        const totalUsers = REQUESTS_PER_BATCH + 50;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);

        const mockResponse1 = new ListResponse(
          {
            data: userIdsBatch.slice(0, REQUESTS_PER_BATCH).map((id) => ({
              id,
              error: null,
            })),
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        const mockResponse2 = new ListResponse(
          {
            data: [],
            continuationToken: null,
          },
          OrganizationUserBulkResponse,
        );

        organizationUserApiService.postManyOrganizationUserReinvite
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        const result = await service.bulkReinvite(mockOrganization, userIdsBatch);

        expect(result.successful).toBeDefined();
        expect(result.successful?.response).toHaveLength(REQUESTS_PER_BATCH);
        expect(result.failed).toHaveLength(0);
      });

      it("should process batches sequentially in order", async () => {
        const totalUsers = REQUESTS_PER_BATCH * 2;
        const userIdsBatch = Array.from({ length: totalUsers }, () => newGuid() as UserId);
        const callOrder: number[] = [];

        organizationUserApiService.postManyOrganizationUserReinvite.mockImplementation(
          async (orgId, ids) => {
            const batchIndex = ids.includes(userIdsBatch[0]) ? 1 : 2;
            callOrder.push(batchIndex);

            return new ListResponse(
              {
                data: ids.map((id) => ({
                  id,
                  error: null,
                })),
                continuationToken: null,
              },
              OrganizationUserBulkResponse,
            );
          },
        );

        await service.bulkReinvite(mockOrganization, userIdsBatch);

        expect(callOrder).toEqual([1, 2]);
        expect(organizationUserApiService.postManyOrganizationUserReinvite).toHaveBeenCalledTimes(
          2,
        );
      });
    });
  });

  describe("allowResetPassword", () => {
    const resetPasswordEnabled = true;

    it("should allow reset password for Owner over User", () => {
      const result = service.allowResetPassword(
        mockOrgUser,
        mockOrganization,
        resetPasswordEnabled,
      );

      expect(result).toBe(true);
    });

    it("should allow reset password for Admin over User", () => {
      const adminOrg = { ...mockOrganization, type: OrganizationUserType.Admin } as Organization;

      const result = service.allowResetPassword(mockOrgUser, adminOrg, resetPasswordEnabled);

      expect(result).toBe(true);
    });

    it("should not allow reset password for Admin over Owner", () => {
      const adminOrg = { ...mockOrganization, type: OrganizationUserType.Admin } as Organization;
      const ownerUser = {
        ...mockOrgUser,
        type: OrganizationUserType.Owner,
      } as OrganizationUserView;

      const result = service.allowResetPassword(ownerUser, adminOrg, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should allow reset password for Custom over User", () => {
      const customOrg = { ...mockOrganization, type: OrganizationUserType.Custom } as Organization;

      const result = service.allowResetPassword(mockOrgUser, customOrg, resetPasswordEnabled);

      expect(result).toBe(true);
    });

    it("should not allow reset password for Custom over Admin", () => {
      const customOrg = { ...mockOrganization, type: OrganizationUserType.Custom } as Organization;
      const adminUser = {
        ...mockOrgUser,
        type: OrganizationUserType.Admin,
      } as OrganizationUserView;

      const result = service.allowResetPassword(adminUser, customOrg, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password for Custom over Owner", () => {
      const customOrg = { ...mockOrganization, type: OrganizationUserType.Custom } as Organization;
      const ownerUser = {
        ...mockOrgUser,
        type: OrganizationUserType.Owner,
      } as OrganizationUserView;

      const result = service.allowResetPassword(ownerUser, customOrg, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when organization cannot manage users password", () => {
      const org = { ...mockOrganization, canManageUsersPassword: false } as Organization;

      const result = service.allowResetPassword(mockOrgUser, org, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when organization does not use reset password", () => {
      const org = { ...mockOrganization, useResetPassword: false } as Organization;

      const result = service.allowResetPassword(mockOrgUser, org, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when user is not enrolled in reset password", () => {
      const user = { ...mockOrgUser, resetPasswordEnrolled: false } as OrganizationUserView;

      const result = service.allowResetPassword(user, mockOrganization, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when user status is not confirmed", () => {
      const user = {
        ...mockOrgUser,
        status: OrganizationUserStatusType.Invited,
      } as OrganizationUserView;

      const result = service.allowResetPassword(user, mockOrganization, resetPasswordEnabled);

      expect(result).toBe(false);
    });
  });
});
