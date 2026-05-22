import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { DialogService } from "@bitwarden/components";
import {
  AccountRecoveryTrustComponent,
  EmergencyAccessTrustComponent,
  KeyRotationTrustInfoComponent,
} from "@bitwarden/key-management-ui";
import { LogService } from "@bitwarden/logging";
import { PublicKey } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { DefaultUserKeyRotationService } from "./user-key-rotation.service";

// Mock dialog open functions
const initialPromptedOpenTrue = jest.fn();
initialPromptedOpenTrue.mockReturnValue({ closed: new BehaviorSubject(true) });

const initialPromptedOpenFalse = jest.fn();
initialPromptedOpenFalse.mockReturnValue({ closed: new BehaviorSubject(false) });

const emergencyAccessTrustOpenTrusted = jest.fn();
emergencyAccessTrustOpenTrusted.mockReturnValue({
  closed: new BehaviorSubject(true),
});

const emergencyAccessTrustOpenUntrusted = jest.fn();
emergencyAccessTrustOpenUntrusted.mockReturnValue({
  closed: new BehaviorSubject(false),
});

const accountRecoveryTrustOpenTrusted = jest.fn();
accountRecoveryTrustOpenTrusted.mockReturnValue({
  closed: new BehaviorSubject(true),
});

const accountRecoveryTrustOpenUntrusted = jest.fn();
accountRecoveryTrustOpenUntrusted.mockReturnValue({
  closed: new BehaviorSubject(false),
});

// Mock the key-management-ui module before importing components
jest.mock("@bitwarden/key-management-ui", () => ({
  KeyRotationTrustInfoComponent: {
    open: jest.fn(),
  },
  EmergencyAccessTrustComponent: {
    open: jest.fn(),
  },
  AccountRecoveryTrustComponent: {
    open: jest.fn(),
  },
}));

describe("DefaultUserKeyRotationService", () => {
  let service: DefaultUserKeyRotationService;

  let mockSdkService: MockProxy<SdkService>;
  let mockLogService: MockProxy<LogService>;
  let mockDialogService: MockProxy<DialogService>;

  const mockUserId = "mockUserId" as UserId;

  let mockUserCryptoManagement: {
    get_untrusted_emergency_access_public_keys: jest.Mock;
    get_untrusted_organization_public_keys: jest.Mock;
    rotate_user_keys: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSdkService = mock<SdkService>();
    mockLogService = mock<LogService>();
    mockDialogService = mock<DialogService>();

    mockUserCryptoManagement = {
      get_untrusted_emergency_access_public_keys: jest.fn(),
      get_untrusted_organization_public_keys: jest.fn(),
      rotate_user_keys: jest.fn(),
    };

    mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([]);
    mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([]);
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

    service = new DefaultUserKeyRotationService(mockSdkService, mockLogService, mockDialogService);

    KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
    EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
    AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
  });

  describe("verifyTrust", () => {
    const mockEmergencyAccessMembership = {
      id: "mockId",
      name: "mockName",
      public_key: new Uint8Array([1, 2, 3]),
    };

    const mockOrganizationMembership = {
      organization_id: "mockOrgId",
      name: "mockOrgName",
      public_key: new Uint8Array([4, 5, 6]),
    };

    it("returns empty arrays if initial dialog is closed", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenFalse;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([
        mockEmergencyAccessMembership,
      ]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([
        mockOrganizationMembership,
      ]);

      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await service.verifyTrust(mockUserId);

      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([]);
      expect(wasTrustDenied).toBe(true);
    });

    it("returns empty arrays if account recovery dialog is closed", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenUntrusted;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([
        mockEmergencyAccessMembership,
      ]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([
        mockOrganizationMembership,
      ]);

      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await service.verifyTrust(mockUserId);

      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([]);
      expect(wasTrustDenied).toBe(true);
    });

    it("returns empty arrays if emergency access dialog is closed", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenUntrusted;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([
        mockEmergencyAccessMembership,
      ]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([]);

      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await service.verifyTrust(mockUserId);

      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([]);
      expect(wasTrustDenied).toBe(true);
    });

    it("returns trusted keys when all dialogs are confirmed with only emergency access users", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([
        mockEmergencyAccessMembership,
      ]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([]);

      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await service.verifyTrust(mockUserId);

      expect(wasTrustDenied).toBe(false);
      expect(trustedEmergencyAccessUsers).toEqual([mockEmergencyAccessMembership.public_key]);
      expect(trustedOrgs).toEqual([]);
    });

    it("returns trusted keys when all dialogs are confirmed with only organizations", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([
        mockOrganizationMembership,
      ]);

      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await service.verifyTrust(mockUserId);

      expect(wasTrustDenied).toBe(false);
      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([mockOrganizationMembership.public_key]);
    });

    it("returns empty arrays when no organizations or emergency access users exist", async () => {
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([]);

      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await service.verifyTrust(mockUserId);

      expect(wasTrustDenied).toBe(false);
      expect(trustedEmergencyAccessUsers).toEqual([]);
      expect(trustedOrgs).toEqual([]);
    });

    it("returns trusted keys when all dialogs are confirmed with both organizations and emergency access users", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([
        mockEmergencyAccessMembership,
      ]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([
        mockOrganizationMembership,
      ]);

      const {
        wasTrustDenied,
        trustedOrganizationPublicKeys: trustedOrgs,
        trustedEmergencyAccessUserPublicKeys: trustedEmergencyAccessUsers,
      } = await service.verifyTrust(mockUserId);

      expect(wasTrustDenied).toBe(false);
      expect(trustedEmergencyAccessUsers).toEqual([mockEmergencyAccessMembership.public_key]);
      expect(trustedOrgs).toEqual([mockOrganizationMembership.public_key]);
    });

    it("does not show initial dialog when no organizations or emergency access users exist", async () => {
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([]);

      await service.verifyTrust(mockUserId);

      expect(KeyRotationTrustInfoComponent.open).not.toHaveBeenCalled();
    });

    it("shows initial dialog when organizations exist", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      AccountRecoveryTrustComponent.open = accountRecoveryTrustOpenTrusted;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([
        mockOrganizationMembership,
      ]);

      await service.verifyTrust(mockUserId);

      expect(KeyRotationTrustInfoComponent.open).toHaveBeenCalledWith(mockDialogService, {
        numberOfEmergencyAccessUsers: 0,
        orgName: mockOrganizationMembership.name,
      });
    });

    it("shows initial dialog when emergency access users exist", async () => {
      KeyRotationTrustInfoComponent.open = initialPromptedOpenTrue;
      EmergencyAccessTrustComponent.open = emergencyAccessTrustOpenTrusted;
      mockUserCryptoManagement.get_untrusted_emergency_access_public_keys.mockResolvedValue([
        mockEmergencyAccessMembership,
      ]);
      mockUserCryptoManagement.get_untrusted_organization_public_keys.mockResolvedValue([]);

      await service.verifyTrust(mockUserId);

      expect(KeyRotationTrustInfoComponent.open).toHaveBeenCalledWith(mockDialogService, {
        numberOfEmergencyAccessUsers: 1,
        orgName: undefined,
      });
    });
  });

  describe("rotateUserKey", () => {
    const mockPasswordRotation = { Password: { password: "mockPassword" } };
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
      await service.rotateUserKey(mockPasswordRotation, mockUserId);

      expect(verifyTrustSpy).toHaveBeenCalledWith(mockUserId);
    });

    it("does not call rotate_user_keys when verifyTrust throws", async () => {
      verifyTrustSpy.mockRejectedValue(new Error("trust check failed"));

      await expect(service.rotateUserKey(mockPasswordRotation, mockUserId)).rejects.toThrow(
        "trust check failed",
      );

      expect(mockUserCryptoManagement.rotate_user_keys).not.toHaveBeenCalled();
    });

    it("returns false when trust is denied", async () => {
      verifyTrustSpy.mockResolvedValue({
        wasTrustDenied: true,
        trustedOrganizationPublicKeys: [],
        trustedEmergencyAccessUserPublicKeys: [],
      });

      const result = await service.rotateUserKey(mockPasswordRotation, mockUserId);

      expect(result).toBe(false);
      expect(mockUserCryptoManagement.rotate_user_keys).not.toHaveBeenCalled();
      expect(mockSdkService.userClient$).not.toHaveBeenCalled();
      expect(mockLogService.info).toHaveBeenCalledWith(
        "[UserKeyRotationService] Trust was denied by user. Aborting!",
      );
    });

    it("returns true on successful rotation", async () => {
      const result = await service.rotateUserKey(mockPasswordRotation, mockUserId);

      expect(result).toBe(true);
      expect(mockUserCryptoManagement.rotate_user_keys).toHaveBeenCalledWith(
        expect.objectContaining({
          key_rotation_method: mockPasswordRotation,
          trusted_organization_public_keys: [mockOrgKey],
          trusted_emergency_access_public_keys: [mockEaKey],
        }),
      );
    });

    it("passes empty arrays when verifyTrust returns no keys", async () => {
      verifyTrustSpy.mockResolvedValue({
        wasTrustDenied: false,
        trustedOrganizationPublicKeys: [],
        trustedEmergencyAccessUserPublicKeys: [],
      });

      await service.rotateUserKey(mockPasswordRotation, mockUserId);

      expect(mockUserCryptoManagement.rotate_user_keys).toHaveBeenCalledWith(
        expect.objectContaining({
          key_rotation_method: mockPasswordRotation,
          trusted_organization_public_keys: [],
          trusted_emergency_access_public_keys: [],
        }),
      );
    });

    it("throws when the SDK client is null", async () => {
      mockSdkService.userClient$.mockReturnValue(of(null) as any);

      await expect(service.rotateUserKey(mockPasswordRotation, mockUserId)).rejects.toThrow(
        "SDK not available",
      );
      expect(mockUserCryptoManagement.rotate_user_keys).not.toHaveBeenCalled();
    });

    it("throws when rotate_user_keys rejects", async () => {
      mockUserCryptoManagement.rotate_user_keys.mockRejectedValue(new Error("rotation failed"));

      await expect(service.rotateUserKey(mockPasswordRotation, mockUserId)).rejects.toThrow(
        "rotation failed",
      );
    });
  });
});
