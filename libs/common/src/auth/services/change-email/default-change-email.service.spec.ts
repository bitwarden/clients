import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// Marked for removal when PM-30811 feature flag is unwound.
// eslint-disable-next-line no-restricted-imports
import {
  DEFAULT_KDF_CONFIG,
  KdfConfig,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";

import { DefaultChangeEmailService } from "./default-change-email.service";

describe("DefaultChangeEmailService", () => {
  let sut: DefaultChangeEmailService;

  let configService: MockProxy<ConfigService>;
  let masterPasswordService: FakeMasterPasswordService;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let apiService: MockProxy<ApiService>;
  let keyService: MockProxy<KeyService>;

  const mockUserId = newGuid() as UserId;
  const mockMasterPassword = "master-password";
  const mockNewEmail = "new@example.com";
  const mockToken = "verification-token";
  const kdfConfig: KdfConfig = DEFAULT_KDF_CONFIG;
  const existingSalt = "existing@example.com" as MasterPasswordSalt;

  beforeEach(() => {
    configService = mock<ConfigService>();
    masterPasswordService = new FakeMasterPasswordService();
    kdfConfigService = mock<KdfConfigService>();
    apiService = mock<ApiService>();
    keyService = mock<KeyService>();

    sut = new DefaultChangeEmailService(
      configService,
      masterPasswordService,
      kdfConfigService,
      apiService,
      keyService,
    );

    jest.resetAllMocks();
  });

  it("should be created", () => {
    expect(sut).toBeTruthy();
  });

  describe("requestEmailToken", () => {
    /**
     * The email token request verifies that the user knows their master password
     * by computing a hash from the password and their current (existing) salt.
     * This proves identity before allowing email change to proceed.
     */
    describe("verifies user identity with existing email credentials", () => {
      it("should use MasterPasswordService APIs", async () => {
        // Arrange: Flag enabled - use new KM APIs
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));

        const authenticationData: MasterPasswordAuthenticationData = {
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
        };
        masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue(
          authenticationData,
        );
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

        // Assert: Verifies identity using existing salt
        expect(masterPasswordService.mock.saltForUser$).toHaveBeenCalledWith(mockUserId);
        expect(
          masterPasswordService.mock.makeMasterPasswordAuthenticationData,
        ).toHaveBeenCalledWith(mockMasterPassword, kdfConfig, existingSalt);
      });

      /**
       * @deprecated Legacy path - to be removed when PM-30811 flag is unwound
       */
      it("should use KeyService APIs for legacy support", async () => {
        // Arrange: Flag disabled - use legacy KeyService
        configService.getFeatureFlag.mockResolvedValue(false);

        const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as MasterKey;
        keyService.getOrDeriveMasterKey.mockResolvedValue(mockMasterKey);
        keyService.hashMasterKey.mockResolvedValue("existing-master-key-hash");
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

        // Assert: Legacy path derives and hashes master key
        expect(keyService.getOrDeriveMasterKey).toHaveBeenCalledWith(
          mockMasterPassword,
          mockUserId,
        );
        expect(keyService.hashMasterKey).toHaveBeenCalled();
      });
    });

    /**
     * After verifying identity, the service sends a request to the server
     * to generate a verification token for the new email address.
     */
    describe("sends token request to server", () => {
      it("should send request with authentication hash", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));

        const authenticationData: MasterPasswordAuthenticationData = {
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
        };
        masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue(
          authenticationData,
        );
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

        // Assert
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/accounts/email-token",
          expect.objectContaining({
            newEmail: mockNewEmail,
            masterPasswordHash: authenticationData.masterPasswordAuthenticationHash,
          }),
          mockUserId,
          false, // hasResponse: false - server returns no body
        );
      });

      /**
       * @deprecated Legacy path - to be removed when PM-30811 flag is unwound
       */
      it("should send request with hashed master key for legacy support", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(false);

        const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as MasterKey;
        keyService.getOrDeriveMasterKey.mockResolvedValue(mockMasterKey);
        keyService.hashMasterKey.mockResolvedValue("existing-master-key-hash");
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

        // Assert
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/accounts/email-token",
          expect.objectContaining({
            newEmail: mockNewEmail,
            masterPasswordHash: "existing-master-key-hash",
          }),
          mockUserId,
          false, // hasResponse: false - server returns no body
        );
      });
    });

    /**
     * Critical preconditions must be met before attempting the operation.
     * These guard against invalid state that would cause cryptographic failures.
     */
    describe("error handling", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(true);
      });

      it("should throw if KDF config is null", async () => {
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

        await expect(
          sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId),
        ).rejects.toThrow("kdf is null or undefined.");
      });

      it("should throw if salt is null", async () => {
        masterPasswordService.mock.saltForUser$.mockReturnValue(
          of(null as unknown as MasterPasswordSalt),
        );

        await expect(
          sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId),
        ).rejects.toThrow("salt is null or undefined.");
      });
    });

    /**
     * Ensures clean separation between old and new code paths.
     * When one path is active, the other's APIs should not be invoked.
     */
    describe("API isolation", () => {
      it("should NOT call legacy KeyService APIs", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue({
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
        });
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

        // Assert
        expect(keyService.getOrDeriveMasterKey).not.toHaveBeenCalled();
        expect(keyService.hashMasterKey).not.toHaveBeenCalled();
      });

      /**
       * @deprecated To be removed when PM-30811 flag is unwound
       */
      it("should NOT call new MasterPasswordService APIs for legacy support", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(false);
        const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as MasterKey;
        keyService.getOrDeriveMasterKey.mockResolvedValue(mockMasterKey);
        keyService.hashMasterKey.mockResolvedValue("existing-master-key-hash");
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.requestEmailToken(mockMasterPassword, mockNewEmail, mockUserId);

        // Assert
        expect(
          masterPasswordService.mock.makeMasterPasswordAuthenticationData,
        ).not.toHaveBeenCalled();
      });
    });
  });

  describe("confirmEmailChange", () => {
    /**
     * The confirm request requires TWO authentication hashes:
     * 1. Existing salt hash - proves user knows their password (verification)
     * 2. New salt hash - will become the new authentication hash after email change
     *
     * This is because the master key derivation includes the email (as salt),
     * so changing email changes the derived master key.
     */
    describe("verifies user identity with existing email credentials", () => {
      it("should create auth data with EXISTING salt for verification", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));

        const newSalt = "new@example.com" as MasterPasswordSalt;
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

        const existingAuthData: MasterPasswordAuthenticationData = {
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash:
            "existing-auth-hash" as MasterPasswordAuthenticationHash,
        };
        const newAuthData: MasterPasswordAuthenticationData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "new-auth-hash" as MasterPasswordAuthenticationHash,
        };
        const newUnlockData: MasterPasswordUnlockData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterKeyWrappedUserKey: "wrapped-user-key" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData;

        masterPasswordService.mock.makeMasterPasswordAuthenticationData
          .mockResolvedValueOnce(existingAuthData)
          .mockResolvedValueOnce(newAuthData);
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue(newUnlockData);
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockResolvedValue(undefined);
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Assert: First call uses EXISTING salt for verification
        expect(
          masterPasswordService.mock.makeMasterPasswordAuthenticationData,
        ).toHaveBeenNthCalledWith(1, mockMasterPassword, kdfConfig, existingSalt);
      });

      /**
       * @deprecated Legacy path - to be removed when PM-30811 flag is unwound
       */
      it("should derive and hash master key with existing credentials for legacy support", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(false);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as MasterKey;
        const mockNewMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(2)) as MasterKey;
        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;

        keyService.getOrDeriveMasterKey.mockResolvedValue(mockMasterKey);
        keyService.hashMasterKey
          .mockResolvedValueOnce("existing-hash")
          .mockResolvedValueOnce("new-hash");
        keyService.makeMasterKey.mockResolvedValue(mockNewMasterKey);
        keyService.userKey$.mockReturnValue(of(mockUserKey));
        keyService.encryptUserKeyWithMasterKey.mockResolvedValue([
          mockUserKey,
          { encryptedString: "encrypted-user-key" } as any,
        ]);
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Assert: Legacy path derives master key from existing user
        expect(keyService.getOrDeriveMasterKey).toHaveBeenCalledWith(
          mockMasterPassword,
          mockUserId,
        );
      });
    });

    /**
     * When email changes, the salt changes (email IS the salt in Bitwarden).
     * This means the master key changes, so we must:
     * 1. Compute new authentication hash with new salt
     * 2. Re-wrap the user key with the new master key
     */
    describe("creates new credentials with new email salt", () => {
      let mockUserKey: UserKey;
      let existingAuthData: MasterPasswordAuthenticationData;
      let newAuthData: MasterPasswordAuthenticationData;
      let newUnlockData: MasterPasswordUnlockData;
      const newSalt = "new@example.com" as MasterPasswordSalt;

      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        mockUserKey = new SymmetricCryptoKey(new Uint8Array(64).fill(3) as CsprngArray) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));

        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

        existingAuthData = {
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash:
            "existing-auth-hash" as MasterPasswordAuthenticationHash,
        };
        newAuthData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "new-auth-hash" as MasterPasswordAuthenticationHash,
        };
        newUnlockData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterKeyWrappedUserKey: "wrapped-user-key" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData;

        masterPasswordService.mock.makeMasterPasswordAuthenticationData
          .mockResolvedValueOnce(existingAuthData)
          .mockResolvedValueOnce(newAuthData);
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue(newUnlockData);
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockResolvedValue(undefined);
        apiService.send.mockResolvedValue(undefined);
      });

      it("should derive new salt from new email", async () => {
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        expect(masterPasswordService.mock.emailToSalt).toHaveBeenCalledWith(mockNewEmail);
      });

      it("should create auth data with NEW salt for new password hash", async () => {
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Second call uses NEW salt for the new authentication hash
        expect(
          masterPasswordService.mock.makeMasterPasswordAuthenticationData,
        ).toHaveBeenNthCalledWith(2, mockMasterPassword, kdfConfig, newSalt);
      });

      it("should create unlock data with NEW salt to re-wrap user key", async () => {
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        expect(masterPasswordService.mock.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
          mockMasterPassword,
          kdfConfig,
          newSalt,
          mockUserKey,
        );
      });
    });

    /**
     * The confirmation request carries all the data the server needs
     * to update the user's email and re-encrypt their keys.
     */
    describe("sends confirmation request to server", () => {
      it("should send request with all required fields", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));

        const newSalt = "new@example.com" as MasterPasswordSalt;
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

        const existingAuthData: MasterPasswordAuthenticationData = {
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash:
            "existing-auth-hash" as MasterPasswordAuthenticationHash,
        };
        const newAuthData: MasterPasswordAuthenticationData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "new-auth-hash" as MasterPasswordAuthenticationHash,
        };
        const newUnlockData: MasterPasswordUnlockData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterKeyWrappedUserKey: "wrapped-user-key" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData;

        masterPasswordService.mock.makeMasterPasswordAuthenticationData
          .mockResolvedValueOnce(existingAuthData)
          .mockResolvedValueOnce(newAuthData);
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue(newUnlockData);
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockResolvedValue(undefined);
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Assert
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/accounts/email",
          expect.objectContaining({
            newEmail: mockNewEmail,
            token: mockToken,
            masterPasswordHash: existingAuthData.masterPasswordAuthenticationHash,
            newMasterPasswordHash: newAuthData.masterPasswordAuthenticationHash,
            key: newUnlockData.masterKeyWrappedUserKey,
          }),
          mockUserId,
          false, // hasResponse: false - server returns no body
        );
      });

      /**
       * @deprecated Legacy path - to be removed when PM-30811 flag is unwound
       */
      it("should send request with hashed keys for legacy support", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(false);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as MasterKey;
        const mockNewMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(2)) as MasterKey;
        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;

        keyService.getOrDeriveMasterKey.mockResolvedValue(mockMasterKey);
        keyService.hashMasterKey
          .mockResolvedValueOnce("existing-hash")
          .mockResolvedValueOnce("new-hash");
        keyService.makeMasterKey.mockResolvedValue(mockNewMasterKey);
        keyService.userKey$.mockReturnValue(of(mockUserKey));
        keyService.encryptUserKeyWithMasterKey.mockResolvedValue([
          mockUserKey,
          { encryptedString: "encrypted-user-key" } as any,
        ]);
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Assert
        expect(apiService.send).toHaveBeenCalledWith(
          "POST",
          "/accounts/email",
          expect.objectContaining({
            newEmail: mockNewEmail,
            token: mockToken,
            masterPasswordHash: "existing-hash",
            newMasterPasswordHash: "new-hash",
            key: "encrypted-user-key",
          }),
          mockUserId,
          false, // hasResponse: false - server returns no body
        );
      });
    });

    /**
     * After the server confirms the email change, we must update local state
     * so the application can continue operating with the new credentials.
     * This is a transitional requirement that will be removed in PM-30676.
     */
    describe("maintains backwards compatibility", () => {
      it("should call setLegacyMasterKeyFromUnlockData after successful change", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));

        const newSalt = "new@example.com" as MasterPasswordSalt;
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

        const existingAuthData: MasterPasswordAuthenticationData = {
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash:
            "existing-auth-hash" as MasterPasswordAuthenticationHash,
        };
        const newAuthData: MasterPasswordAuthenticationData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "new-auth-hash" as MasterPasswordAuthenticationHash,
        };
        const newUnlockData: MasterPasswordUnlockData = {
          salt: newSalt,
          kdf: kdfConfig,
          masterKeyWrappedUserKey: "wrapped-user-key" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData;

        masterPasswordService.mock.makeMasterPasswordAuthenticationData
          .mockResolvedValueOnce(existingAuthData)
          .mockResolvedValueOnce(newAuthData);
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue(newUnlockData);
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockResolvedValue(undefined);
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Assert: Sets legacy master key for backwards compat (remove in PM-30676)
        expect(masterPasswordService.mock.setLegacyMasterKeyFromUnlockData).toHaveBeenCalledWith(
          mockMasterPassword,
          newUnlockData,
          mockUserId,
        );
      });

      /**
       * The legacy master key MUST be set AFTER the API call succeeds.
       * If set before and the API fails, local state would be inconsistent with the server,
       * making the operation non-retry-able without logging out.
       */
      it("should set legacy master key AFTER the API call succeeds", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));

        const newSalt = "new@example.com" as MasterPasswordSalt;
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

        masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue({
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
        });
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue({
          salt: newSalt,
          kdf: kdfConfig,
          masterKeyWrappedUserKey: "wrapped-key" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData);
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockResolvedValue(undefined);
        apiService.send.mockResolvedValue(undefined);

        // Track call order
        const callOrder: string[] = [];
        apiService.send.mockImplementation(async () => {
          callOrder.push("apiService.send");
        });
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockImplementation(async () => {
          callOrder.push("setLegacyMasterKeyFromUnlockData");
        });

        // Act
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Assert: API call must happen BEFORE legacy key update
        expect(callOrder).toEqual(["apiService.send", "setLegacyMasterKeyFromUnlockData"]);
      });

      it("should NOT set legacy master key if API call fails", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));

        const newSalt = "new@example.com" as MasterPasswordSalt;
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

        masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue({
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
        });
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue({
          salt: newSalt,
          kdf: kdfConfig,
          masterKeyWrappedUserKey: "wrapped-key" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData);
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockResolvedValue(undefined);

        // API call fails
        apiService.send.mockRejectedValue(new Error("Server error"));

        // Act & Assert
        await expect(
          sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
        ).rejects.toThrow("Server error");

        // Legacy key should NOT have been set (preserves retry-ability)
        expect(masterPasswordService.mock.setLegacyMasterKeyFromUnlockData).not.toHaveBeenCalled();
      });
    });

    /**
     * Critical preconditions must be met before attempting the operation.
     * These guard against invalid state that would cause cryptographic failures.
     */
    describe("error handling", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(true);
      });

      it("should throw if KDF config is null", async () => {
        kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

        await expect(
          sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
        ).rejects.toThrow("kdf is null or undefined.");
      });

      it("should throw if user key is null", async () => {
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));
        keyService.userKey$.mockReturnValue(of(null));

        await expect(
          sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
        ).rejects.toThrow("userKey is null or undefined.");
      });

      it("should throw if existing salt is null", async () => {
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));
        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));
        masterPasswordService.mock.saltForUser$.mockReturnValue(
          of(null as unknown as MasterPasswordSalt),
        );

        await expect(
          sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
        ).rejects.toThrow("salt is null or undefined.");
      });

      /**
       * @deprecated Legacy error cases - to be removed when PM-30811 flag is unwound
       */
      describe("legacy path errors", () => {
        beforeEach(() => {
          configService.getFeatureFlag.mockResolvedValue(false);
        });

        it("should throw if KDF config is null", async () => {
          kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

          await expect(
            sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
          ).rejects.toThrow();
        });

        it("should throw if user key is null", async () => {
          kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

          const mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as MasterKey;
          keyService.getOrDeriveMasterKey.mockResolvedValue(mockMasterKey);
          keyService.hashMasterKey.mockResolvedValue("existing-hash");
          keyService.makeMasterKey.mockResolvedValue(mockMasterKey);
          keyService.userKey$.mockReturnValue(of(null));

          await expect(
            sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId),
          ).rejects.toThrow();
        });
      });
    });

    /**
     * Ensures clean separation between old and new code paths.
     * When one path is active, the other's APIs should not be invoked.
     */
    describe("API isolation", () => {
      it("should NOT call legacy KeyService APIs", async () => {
        // Arrange
        configService.getFeatureFlag.mockResolvedValue(true);
        kdfConfigService.getKdfConfig$.mockReturnValue(of(kdfConfig));

        const mockUserKey = new SymmetricCryptoKey(
          new Uint8Array(64).fill(3) as CsprngArray,
        ) as UserKey;
        keyService.userKey$.mockReturnValue(of(mockUserKey));

        const newSalt = "new@example.com" as MasterPasswordSalt;
        masterPasswordService.mock.saltForUser$.mockReturnValue(of(existingSalt));
        masterPasswordService.mock.emailToSalt.mockReturnValue(newSalt);

        masterPasswordService.mock.makeMasterPasswordAuthenticationData.mockResolvedValue({
          salt: existingSalt,
          kdf: kdfConfig,
          masterPasswordAuthenticationHash: "auth-hash" as MasterPasswordAuthenticationHash,
        });
        masterPasswordService.mock.makeMasterPasswordUnlockData.mockResolvedValue({
          salt: newSalt,
          kdf: kdfConfig,
          masterKeyWrappedUserKey: "wrapped-key" as MasterKeyWrappedUserKey,
        } as MasterPasswordUnlockData);
        masterPasswordService.mock.setLegacyMasterKeyFromUnlockData.mockResolvedValue(undefined);
        apiService.send.mockResolvedValue(undefined);

        // Act
        await sut.confirmEmailChange(mockMasterPassword, mockNewEmail, mockToken, mockUserId);

        // Assert
        expect(keyService.getOrDeriveMasterKey).not.toHaveBeenCalled();
        expect(keyService.makeMasterKey).not.toHaveBeenCalled();
        expect(keyService.hashMasterKey).not.toHaveBeenCalled();
        expect(keyService.encryptUserKeyWithMasterKey).not.toHaveBeenCalled();
      });
    });
  });
});
