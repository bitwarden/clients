import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserDetailsResponse,
} from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { Response } from "../../models/response";

import { ConfirmCommand } from "./confirm.command";

describe("ConfirmCommand", () => {
  let command: ConfirmCommand;
  let apiService: jest.Mocked<ApiService>;
  let keyService: jest.Mocked<KeyService>;
  let encryptService: jest.Mocked<EncryptService>;
  let organizationUserApiService: jest.Mocked<OrganizationUserApiService>;
  let accountService: jest.Mocked<AccountService>;
  let i18nService: jest.Mocked<I18nService>;

  const userId = "test-user-id" as UserId;
  const organizationId = "bf61e571-fb70-4113-b305-b331004d0f19";
  const organizationUserId = "6aa431fa-7ea1-4852-907e-b36b0030a87d";
  const mockOrgKey = {} as OrgKey;
  const mockPublicKey = "mockPublicKey";

  beforeEach(() => {
    apiService = mock<ApiService>();
    keyService = mock<KeyService>();
    encryptService = mock<EncryptService>();
    organizationUserApiService = mock<OrganizationUserApiService>();
    accountService = mock<AccountService>();
    i18nService = mock<I18nService>();

    command = new ConfirmCommand(
      apiService,
      keyService,
      encryptService,
      organizationUserApiService,
      accountService,
      i18nService,
    );

    // Default mocks
    accountService.activeAccount$ = of({ id: userId } as any);
    keyService.orgKeys$ = jest.fn().mockReturnValue(of({ [organizationId]: mockOrgKey }));
    i18nService.t.mockReturnValue("My Items");
    encryptService.encryptString.mockResolvedValue({ encryptedString: "encrypted" } as any);
    encryptService.encapsulateKeyUnsigned.mockResolvedValue({ encryptedString: "key" } as any);
    apiService.getUserPublicKey.mockResolvedValue({ publicKey: mockPublicKey } as any);
    organizationUserApiService.postOrganizationUserConfirm.mockResolvedValue();
  });

  describe("run", () => {
    it("should return bad request for unknown object", async () => {
      const response = await command.run("unknown-object", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toBe("Unknown object.");
    });

    it("should return bad request when organizationId is missing", async () => {
      const response = await command.run("org-member", organizationUserId, {});

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toBe("--organizationid <organizationid> required.");
    });

    it("should return bad request when id is not a GUID", async () => {
      const response = await command.run("org-member", "not-a-guid", {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain("is not a GUID");
    });

    it("should return bad request when organizationId is not a GUID", async () => {
      const response = await command.run("org-member", organizationUserId, {
        organizationid: "not-a-guid",
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain("is not a GUID");
    });
  });

  describe("confirmOrganizationMember - status validation", () => {
    it("should reject user with Invited status", async () => {
      const invitedUser = {
        id: organizationUserId,
        userId: null,
        status: OrganizationUserStatusType.Invited,
      } as unknown as OrganizationUserDetailsResponse;

      organizationUserApiService.getOrganizationUser.mockResolvedValue(invitedUser);

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain(
        "User must accept the invitation before they can be confirmed.",
      );
    });

    it("should reject user with Confirmed status", async () => {
      const confirmedUser = {
        id: organizationUserId,
        userId: userId,
        status: OrganizationUserStatusType.Confirmed,
      } as unknown as OrganizationUserDetailsResponse;

      organizationUserApiService.getOrganizationUser.mockResolvedValue(confirmedUser);

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain("User is already confirmed.");
    });

    it("should reject user with Revoked status", async () => {
      const revokedUser = {
        id: organizationUserId,
        userId: userId,
        status: OrganizationUserStatusType.Revoked,
      } as unknown as OrganizationUserDetailsResponse;

      organizationUserApiService.getOrganizationUser.mockResolvedValue(revokedUser);

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain("User is revoked and cannot be confirmed.");
    });

    it("should reject user with unexpected status", async () => {
      const invalidUser = {
        id: organizationUserId,
        userId: userId,
        status: 999 as OrganizationUserStatusType, // Invalid status
      } as unknown as OrganizationUserDetailsResponse;

      organizationUserApiService.getOrganizationUser.mockResolvedValue(invalidUser);

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain("User is not in a valid state to be confirmed.");
    });

    it("should successfully confirm user with Accepted status", async () => {
      const acceptedUser = {
        id: organizationUserId,
        userId: userId,
        status: OrganizationUserStatusType.Accepted,
      } as unknown as OrganizationUserDetailsResponse;

      organizationUserApiService.getOrganizationUser.mockResolvedValue(acceptedUser);

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(true);
      expect(apiService.getUserPublicKey).toHaveBeenCalledWith(userId);
      expect(organizationUserApiService.postOrganizationUserConfirm).toHaveBeenCalledWith(
        organizationId,
        organizationUserId.toLowerCase(),
        expect.objectContaining({
          key: "key",
          defaultUserCollectionName: "encrypted",
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should return error when organization key is not found", async () => {
      keyService.orgKeys$ = jest.fn().mockReturnValue(of({}));

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain("No encryption key for this organization");
    });

    it("should return error when organization user is not found", async () => {
      organizationUserApiService.getOrganizationUser.mockResolvedValue(null);

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
      expect(response.message).toContain("Member id does not exist for this organization");
    });

    it("should return error when API call fails", async () => {
      const acceptedUser = {
        id: organizationUserId,
        userId: userId,
        status: OrganizationUserStatusType.Accepted,
      } as unknown as OrganizationUserDetailsResponse;

      organizationUserApiService.getOrganizationUser.mockResolvedValue(acceptedUser);
      organizationUserApiService.postOrganizationUserConfirm.mockRejectedValue(
        new Error("API Error"),
      );

      const response = await command.run("org-member", organizationUserId, {
        organizationid: organizationId,
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.success).toBe(false);
    });
  });
});
