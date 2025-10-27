import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserBulkResponse,
} from "@bitwarden/admin-console/common";
import {
  OrganizationUserType,
  OrganizationUserStatusType,
} from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
import { KeyService } from "@bitwarden/key-management";

import { BillingConstraintService } from "../../../../../billing/members/billing-constraint/billing-constraint.service";
import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { OrganizationUserService } from "../organization-user/organization-user.service";

import { MemberActionsService } from "./member-actions.service";

describe("MemberActionsService", () => {
  let service: MemberActionsService;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationUserService: MockProxy<OrganizationUserService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let configService: MockProxy<ConfigService>;
  let accountService: FakeAccountService;
  let billingConstraintService: MockProxy<BillingConstraintService>;

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
    billingConstraintService = mock<BillingConstraintService>();

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
      billingConstraintService,
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
        mockOrgUser,
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
    const userIds = [newGuid(), newGuid(), newGuid()];

    it("should successfully reinvite multiple users", async () => {
      const mockResponse = {
        data: userIds.map((id) => ({
          id,
          error: null,
        })),
        continuationToken: null,
      } as ListResponse<OrganizationUserBulkResponse>;
      organizationUserApiService.postManyOrganizationUserReinvite.mockResolvedValue(mockResponse);

      const result = await service.bulkReinvite(mockOrganization, userIds);

      expect(result).toEqual({
        successful: mockResponse,
        failed: [],
      });
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

    it("should not allow reset password when organization lacks public and private keys", () => {
      const org = { ...mockOrganization, hasPublicAndPrivateKeys: false } as Organization;

      const result = service.allowResetPassword(mockOrgUser, org, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when user is not enrolled in reset password", () => {
      const user = { ...mockOrgUser, resetPasswordEnrolled: false } as OrganizationUserView;

      const result = service.allowResetPassword(user, mockOrganization, resetPasswordEnabled);

      expect(result).toBe(false);
    });

    it("should not allow reset password when reset password is disabled", () => {
      const result = service.allowResetPassword(mockOrgUser, mockOrganization, false);

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
