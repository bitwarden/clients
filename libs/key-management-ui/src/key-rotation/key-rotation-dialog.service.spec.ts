import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import {
  LogoutService,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ToastService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

import { KeyRotationDialogService } from "./key-rotation-dialog.service";

describe("KeyRotationDialogService", () => {
  let sut: KeyRotationDialogService;

  let mockCipherService: MockProxy<CipherService>;
  let mockUserKeyRotationService: MockProxy<UserKeyRotationServiceAbstraction>;
  let mockToastService: MockProxy<ToastService>;
  let mockI18nService: MockProxy<I18nService>;
  let mockLogoutService: MockProxy<LogoutService>;
  let mockMasterPasswordUnlockService: MockProxy<MasterPasswordUnlockService>;
  let mockUserDecryptionOptionsService: MockProxy<UserDecryptionOptionsServiceAbstraction>;

  const mockUserId = "mockUserId" as UserId;
  const masterPassword = "mockPassword";
  const mockKeyConnectorUrl = "https://key-connector.example.com";

  beforeEach(() => {
    jest.clearAllMocks();
    mockCipherService = mock<CipherService>();
    mockUserKeyRotationService = mock<UserKeyRotationServiceAbstraction>();
    mockToastService = mock<ToastService>();
    mockI18nService = mock<I18nService>();
    mockLogoutService = mock<LogoutService>();
    mockMasterPasswordUnlockService = mock<MasterPasswordUnlockService>();
    mockUserDecryptionOptionsService = mock<UserDecryptionOptionsServiceAbstraction>();

    mockI18nService.t.mockImplementation((key) => `${key}-used-i18n`);

    TestBed.configureTestingModule({
      providers: [
        { provide: CipherService, useValue: mockCipherService },
        { provide: UserKeyRotationServiceAbstraction, useValue: mockUserKeyRotationService },
        { provide: ToastService, useValue: mockToastService },
        { provide: I18nService, useValue: mockI18nService },
        { provide: LogoutService, useValue: mockLogoutService },
        { provide: MasterPasswordUnlockService, useValue: mockMasterPasswordUnlockService },
        {
          provide: UserDecryptionOptionsServiceAbstraction,
          useValue: mockUserDecryptionOptionsService,
        },
      ],
    });

    sut = TestBed.inject(KeyRotationDialogService);
  });

  describe("rotateKeys", () => {
    beforeEach(() => {
      mockMasterPasswordUnlockService.proofOfDecryption.mockResolvedValue(true);
    });

    it("shows error toast when proof of decryption fails", async () => {
      mockMasterPasswordUnlockService.proofOfDecryption.mockResolvedValue(false);

      const result = await sut.rotateKeys(masterPassword, mockUserId);

      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        message: "incorrectPassword-used-i18n",
      });
      expect(result).toBe(false);
      expect(mockUserKeyRotationService.rotateUserKey).not.toHaveBeenCalled();
      expect(mockLogoutService.logout).not.toHaveBeenCalled();
    });

    it("shows success toast and logs out when rotation succeeds", async () => {
      mockUserKeyRotationService.rotateUserKey.mockResolvedValue(true);

      const result = await sut.rotateKeys(masterPassword, mockUserId);

      expect(mockUserKeyRotationService.rotateUserKey).toHaveBeenCalledWith(
        { Password: { password: masterPassword } },
        "Skip",
        mockUserId,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: "accountEncryptionKeyRotated-used-i18n",
        timeout: 15000,
      });
      expect(mockLogoutService.logout).toHaveBeenCalledWith(mockUserId);
      expect(result).toBe(true);
    });

    it("does not show success toast or logout when rotation returns false", async () => {
      mockUserKeyRotationService.rotateUserKey.mockResolvedValue(false);

      const result = await sut.rotateKeys(masterPassword, mockUserId);

      expect(mockToastService.showToast).not.toHaveBeenCalled();
      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("rotateKeysForKeyConnector", () => {
    beforeEach(() => {
      mockUserDecryptionOptionsService.userDecryptionOptionsById$.mockReturnValue(
        of({
          keyConnectorOption: { keyConnectorUrl: mockKeyConnectorUrl },
        } as UserDecryptionOptions),
      );
    });

    it("shows success toast and logs out when rotation succeeds", async () => {
      mockUserKeyRotationService.rotateUserKey.mockResolvedValue(true);

      const result = await sut.rotateKeysForKeyConnector(mockUserId);

      expect(mockUserKeyRotationService.rotateUserKey).toHaveBeenCalledWith(
        { KeyConnector: { key_connector_url: mockKeyConnectorUrl } },
        "Skip",
        mockUserId,
      );
      expect(mockToastService.showToast).toHaveBeenCalledWith({
        variant: "success",
        title: "",
        message: "accountEncryptionKeyRotated-used-i18n",
        timeout: 15000,
      });
      expect(mockLogoutService.logout).toHaveBeenCalledWith(mockUserId);
      expect(result).toBe(true);
    });

    it("does not show success toast or logout when rotation returns false", async () => {
      mockUserKeyRotationService.rotateUserKey.mockResolvedValue(false);

      const result = await sut.rotateKeysForKeyConnector(mockUserId);

      expect(mockToastService.showToast).not.toHaveBeenCalled();
      expect(mockLogoutService.logout).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe("hasLegacyCipherAttachments", () => {
    it("returns false when ciphers array is null", async () => {
      mockCipherService.getAllDecrypted.mockResolvedValue(null as any);

      const result = await sut.hasLegacyCipherAttachments(mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when ciphers array is empty", async () => {
      mockCipherService.getAllDecrypted.mockResolvedValue([]);

      const result = await sut.hasLegacyCipherAttachments(mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when no ciphers have old attachments", async () => {
      mockCipherService.getAllDecrypted.mockResolvedValue([
        { organizationId: null, hasOldAttachments: false } as any,
        { organizationId: null, hasOldAttachments: false } as any,
      ]);

      const result = await sut.hasLegacyCipherAttachments(mockUserId);

      expect(result).toBe(false);
    });

    it("returns false when cipher has old attachments but belongs to an organization", async () => {
      mockCipherService.getAllDecrypted.mockResolvedValue([
        { organizationId: "orgId", hasOldAttachments: true } as any,
      ]);

      const result = await sut.hasLegacyCipherAttachments(mockUserId);

      expect(result).toBe(false);
    });

    it("returns true when a personal cipher has old attachments", async () => {
      mockCipherService.getAllDecrypted.mockResolvedValue([
        { organizationId: null, hasOldAttachments: true } as any,
      ]);

      const result = await sut.hasLegacyCipherAttachments(mockUserId);

      expect(result).toBe(true);
    });

    it("returns true when only one of multiple ciphers has legacy attachments", async () => {
      mockCipherService.getAllDecrypted.mockResolvedValue([
        { organizationId: "orgId", hasOldAttachments: true } as any,
        { organizationId: null, hasOldAttachments: false } as any,
        { organizationId: null, hasOldAttachments: true } as any,
      ]);

      const result = await sut.hasLegacyCipherAttachments(mockUserId);

      expect(result).toBe(true);
    });
  });
});
