import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { LogService } from "@bitwarden/logging";
import { PublicKey, UpgradeTokenAction } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { UserCryptoDialogService } from "./user-crypto-dialog.service.abstraction";
import { DefaultUserKeyRotationService } from "./user-key-rotation.service";

describe("DefaultUserKeyRotationService", () => {
  let service: DefaultUserKeyRotationService;

  let mockSdkService: MockProxy<SdkService>;
  let mockLogService: MockProxy<LogService>;
  let mockUserCryptoDialogService: MockProxy<UserCryptoDialogService>;

  const mockUserId = "mockUserId" as UserId;

  let mockUserCryptoManagement: {
    get_untrusted_memberships: jest.Mock;
    rotate_user_keys: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSdkService = mock<SdkService>();
    mockLogService = mock<LogService>();
    mockUserCryptoDialogService = mock<UserCryptoDialogService>();

    mockUserCryptoManagement = {
      get_untrusted_memberships: jest.fn(),
      rotate_user_keys: jest.fn(),
    };

    mockUserCryptoManagement.get_untrusted_memberships.mockResolvedValue({
      emergency_access_memberships: [],
      organization_memberships: [],
    });
    mockUserCryptoManagement.rotate_user_keys.mockResolvedValue(undefined);

    const mockSdkClient = {
      take: jest.fn().mockReturnValue({
        value: {
          user_crypto_management: () => mockUserCryptoManagement,
        },
        [Symbol.dispose]: jest.fn(),
      }),
    };

    mockSdkService.userClient$.mockReturnValue(of(mockSdkClient as any));

    service = new DefaultUserKeyRotationService(
      mockSdkService,
      mockLogService,
      mockUserCryptoDialogService,
    );
  });

  describe("verifyTrust", () => {
    const mockEmergencyAccessMembership = {
      id: "mockId",
      name: "mockName",
      public_key: new Uint8Array([1, 2, 3]),
      grantee_id: "mockGranteeId",
    };

    const mockOrganizationMembership = {
      organization_id: "mockOrgId",
      name: "mockOrgName",
      public_key: new Uint8Array([4, 5, 6]),
    };

    it("delegates to UserCryptoDialogService with the SDK results", async () => {
      mockUserCryptoManagement.get_untrusted_memberships.mockResolvedValue({
        emergency_access_memberships: [mockEmergencyAccessMembership],
        organization_memberships: [mockOrganizationMembership],
      });
      mockUserCryptoDialogService.verifyTrust.mockResolvedValue({
        wasTrustDenied: false,
        trustedOrganizationPublicKeys: [],
        trustedEmergencyAccessUserPublicKeys: [],
      });

      await service.verifyTrust(mockUserId);

      expect(mockUserCryptoDialogService.verifyTrust).toHaveBeenCalledWith(
        [mockOrganizationMembership],
        [mockEmergencyAccessMembership],
      );
    });

    it("propagates a denied TrustVerificationResult from the dialog service", async () => {
      mockUserCryptoManagement.get_untrusted_memberships.mockResolvedValue({
        emergency_access_memberships: [mockEmergencyAccessMembership],
        organization_memberships: [mockOrganizationMembership],
      });
      mockUserCryptoDialogService.verifyTrust.mockResolvedValue({
        wasTrustDenied: true,
        trustedOrganizationPublicKeys: [],
        trustedEmergencyAccessUserPublicKeys: [],
      });

      const result = await service.verifyTrust(mockUserId);

      expect(result).toEqual({
        wasTrustDenied: true,
        trustedOrganizationPublicKeys: [],
        trustedEmergencyAccessUserPublicKeys: [],
      });
    });

    it("propagates a trusted TrustVerificationResult from the dialog service", async () => {
      const orgKey = "orgPublicKey" as PublicKey;
      const eaKey = "eaPublicKey" as PublicKey;
      mockUserCryptoManagement.get_untrusted_memberships.mockResolvedValue({
        emergency_access_memberships: [],
        organization_memberships: [],
      });
      mockUserCryptoDialogService.verifyTrust.mockResolvedValue({
        wasTrustDenied: false,
        trustedOrganizationPublicKeys: [orgKey],
        trustedEmergencyAccessUserPublicKeys: [eaKey],
      });

      const result = await service.verifyTrust(mockUserId);

      expect(result).toEqual({
        wasTrustDenied: false,
        trustedOrganizationPublicKeys: [orgKey],
        trustedEmergencyAccessUserPublicKeys: [eaKey],
      });
      expect(mockUserCryptoDialogService.verifyTrust).toHaveBeenCalledWith([], []);
    });
  });

  describe("rotateUserKey", () => {
    const mockPasswordRotation = { Password: { password: "mockPassword" } };
    const mockUpgradeTokenAction: UpgradeTokenAction = "Skip";
    const mockOrgKey = "mockOrgPublicKey" as PublicKey;
    const mockEaKey = "mockEaPublicKey" as PublicKey;

    let verifyTrustSpy: jest.SpyInstance;

    beforeEach(() => {
      verifyTrustSpy = jest.spyOn(service, "verifyTrust").mockResolvedValue({
        wasTrustDenied: false,
        trustedOrganizationPublicKeys: [mockOrgKey],
        trustedEmergencyAccessUserPublicKeys: [mockEaKey],
      });
    });

    it("calls verifyTrust with the correct userId", async () => {
      await service.rotateUserKey(mockPasswordRotation, mockUpgradeTokenAction, mockUserId);

      expect(verifyTrustSpy).toHaveBeenCalledWith(mockUserId);
    });

    it("does not call rotate_user_keys when verifyTrust throws", async () => {
      verifyTrustSpy.mockRejectedValue(new Error("trust check failed"));

      await expect(
        service.rotateUserKey(mockPasswordRotation, mockUpgradeTokenAction, mockUserId),
      ).rejects.toThrow("trust check failed");

      expect(mockUserCryptoManagement.rotate_user_keys).not.toHaveBeenCalled();
    });

    it("returns false when trust is denied", async () => {
      verifyTrustSpy.mockResolvedValue({
        wasTrustDenied: true,
        trustedOrganizationPublicKeys: [],
        trustedEmergencyAccessUserPublicKeys: [],
      });

      const result = await service.rotateUserKey(
        mockPasswordRotation,
        mockUpgradeTokenAction,
        mockUserId,
      );

      expect(result).toBe(false);
      expect(mockUserCryptoManagement.rotate_user_keys).not.toHaveBeenCalled();
      expect(mockSdkService.userClient$).not.toHaveBeenCalled();
      expect(mockLogService.info).toHaveBeenCalledWith(
        "[UserKeyRotationService] Trust was denied by user. Aborting!",
      );
    });

    it("returns true on successful rotation", async () => {
      const result = await service.rotateUserKey(
        mockPasswordRotation,
        mockUpgradeTokenAction,
        mockUserId,
      );

      expect(result).toBe(true);
      expect(mockUserCryptoManagement.rotate_user_keys).toHaveBeenCalledWith(
        expect.objectContaining({
          key_rotation_method: mockPasswordRotation,
          trusted_organization_public_keys: [mockOrgKey],
          trusted_emergency_access_public_keys: [mockEaKey],
          upgrade_token_action: mockUpgradeTokenAction,
        }),
      );
    });

    it("forwards a CreateIfNeeded upgrade token action to the SDK request", async () => {
      const result = await service.rotateUserKey(
        mockPasswordRotation,
        "CreateIfNeeded",
        mockUserId,
      );

      expect(result).toBe(true);
      expect(mockUserCryptoManagement.rotate_user_keys).toHaveBeenCalledWith(
        expect.objectContaining({
          upgrade_token_action: "CreateIfNeeded",
        }),
      );
    });

    it("passes empty arrays when verifyTrust returns no keys", async () => {
      verifyTrustSpy.mockResolvedValue({
        wasTrustDenied: false,
        trustedOrganizationPublicKeys: [],
        trustedEmergencyAccessUserPublicKeys: [],
      });

      await service.rotateUserKey(mockPasswordRotation, mockUpgradeTokenAction, mockUserId);

      expect(mockUserCryptoManagement.rotate_user_keys).toHaveBeenCalledWith(
        expect.objectContaining({
          key_rotation_method: mockPasswordRotation,
          trusted_organization_public_keys: [],
          trusted_emergency_access_public_keys: [],
          upgrade_token_action: mockUpgradeTokenAction,
        }),
      );
    });

    it("throws when rotate_user_keys rejects", async () => {
      mockUserCryptoManagement.rotate_user_keys.mockRejectedValue(new Error("rotation failed"));

      await expect(
        service.rotateUserKey(mockPasswordRotation, mockUpgradeTokenAction, mockUserId),
      ).rejects.toThrow("rotation failed");
    });
  });
});
