import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KdfConfigService } from "@bitwarden/key-management";

import {
  FakeAccountService,
  FakeStateProvider,
  makeSymmetricCryptoKey,
  mockAccountServiceWith,
} from "../../../../spec";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { KeyGenerationService } from "../../../platform/abstractions/key-generation.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { HashPurpose } from "../../../platform/enums";
import { Utils } from "../../../platform/misc/utils";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { MasterKey } from "../../../types/key";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";
import { EncryptService } from "../../crypto/abstractions/encrypt.service";

import {
  FORCE_SET_PASSWORD_REASON,
  MASTER_KEY,
  MASTER_KEY_ENCRYPTED_USER_KEY,
  MASTER_KEY_HASH,
  MasterPasswordService,
} from "./master-password.service";

describe("MasterPasswordService", () => {
  let sut: MasterPasswordService;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let encryptService: MockProxy<EncryptService>;
  let logService: MockProxy<LogService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;

  const userId = "user-id" as UserId;

  const testUserKey: SymmetricCryptoKey = makeSymmetricCryptoKey(64, 1);
  const testMasterKey: MasterKey = makeSymmetricCryptoKey(32, 2);
  const testStretchedMasterKey: SymmetricCryptoKey = makeSymmetricCryptoKey(64, 3);
  const testMasterKeyEncryptedKey =
    "0.gbauOANURUHqvhLTDnva1A==|nSW+fPumiuTaDB/s12+JO88uemV6rhwRSR+YR1ZzGr5j6Ei3/h+XEli2Unpz652NlZ9NTuRpHxeOqkYYJtp7J+lPMoclgteXuAzUu9kqlRc=";
  const testStretchedMasterKeyEncryptedKey =
    "2.gbauOANURUHqvhLTDnva1A==|nSW+fPumiuTaDB/s12+JO88uemV6rhwRSR+YR1ZzGr5j6Ei3/h+XEli2Unpz652NlZ9NTuRpHxeOqkYYJtp7J+lPMoclgteXuAzUu9kqlRc=|DeUFkhIwgkGdZA08bDnDqMMNmZk21D+H5g8IostPKAY=";

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    keyGenerationService = mock<KeyGenerationService>();
    encryptService = mock<EncryptService>();
    logService = mock<LogService>();
    kdfConfigService = mock<KdfConfigService>();
    cryptoFunctionService = mock<CryptoFunctionService>();

    sut = new MasterPasswordService(
      stateProvider,
      keyGenerationService,
      encryptService,
      logService,
      accountService,
      kdfConfigService,
      cryptoFunctionService,
    );

    encryptService.unwrapSymmetricKey.mockResolvedValue(makeSymmetricCryptoKey(64, 1));
    keyGenerationService.stretchKey.mockResolvedValue(makeSymmetricCryptoKey(64, 3));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("setForceSetPasswordReason", () => {
    it("calls stateProvider with the provided reason and user ID", async () => {
      const reason = ForceSetPasswordReason.WeakMasterPassword;

      await sut.setForceSetPasswordReason(reason, userId);

      const state = await firstValueFrom(
        stateProvider.getUser(userId, FORCE_SET_PASSWORD_REASON).state$,
      );
      expect(state).toEqual(reason);
    });

    it("throws an error if reason is null", async () => {
      await expect(
        sut.setForceSetPasswordReason(null as unknown as ForceSetPasswordReason, userId),
      ).rejects.toThrow("Reason is required.");
    });

    it("throws an error if user ID is null", async () => {
      await expect(
        sut.setForceSetPasswordReason(ForceSetPasswordReason.None, null as unknown as UserId),
      ).rejects.toThrow("User ID is required.");
    });

    it("does not overwrite AdminForcePasswordReset with other reasons except None", async () => {
      stateProvider.singleUser
        .getFake(userId, FORCE_SET_PASSWORD_REASON)
        .nextState(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.WeakMasterPassword, userId);

      const state = await firstValueFrom(
        stateProvider.getUser(userId, FORCE_SET_PASSWORD_REASON).state$,
      );
      expect(state).toEqual(ForceSetPasswordReason.AdminForcePasswordReset);
    });

    it("allows overwriting AdminForcePasswordReset with None", async () => {
      stateProvider.singleUser
        .getFake(userId, FORCE_SET_PASSWORD_REASON)
        .nextState(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

      const state = await firstValueFrom(
        stateProvider.getUser(userId, FORCE_SET_PASSWORD_REASON).state$,
      );
      expect(state).toEqual(ForceSetPasswordReason.None);
    });
  });
  describe("decryptUserKeyWithMasterKey", () => {
    it("decrypts a userkey wrapped in AES256-CBC", async () => {
      encryptService.unwrapSymmetricKey.mockResolvedValue(testUserKey);
      await sut.decryptUserKeyWithMasterKey(
        testMasterKey,
        userId,
        new EncString(testMasterKeyEncryptedKey),
      );
      expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(
        new EncString(testMasterKeyEncryptedKey),
        testMasterKey,
      );
    });
    it("decrypts a userkey wrapped in AES256-CBC-HMAC", async () => {
      encryptService.unwrapSymmetricKey.mockResolvedValue(testUserKey);
      keyGenerationService.stretchKey.mockResolvedValue(testStretchedMasterKey);
      await sut.decryptUserKeyWithMasterKey(
        testMasterKey,
        userId,
        new EncString(testStretchedMasterKeyEncryptedKey),
      );
      expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(
        new EncString(testStretchedMasterKeyEncryptedKey),
        testStretchedMasterKey,
      );
      expect(keyGenerationService.stretchKey).toHaveBeenCalledWith(testMasterKey);
    });
    it("returns null if failed to decrypt", async () => {
      encryptService.unwrapSymmetricKey.mockResolvedValue(null);
      const result = await sut.decryptUserKeyWithMasterKey(
        testMasterKey,
        userId,
        new EncString(testStretchedMasterKeyEncryptedKey),
      );
      expect(result).toBeNull();
    });
  });

  describe("setMasterKeyEncryptedUserKey", () => {
    test.each([null as unknown as EncString, undefined as unknown as EncString])(
      "throws when the provided encryptedKey is %s",
      async (encryptedKey) => {
        await expect(sut.setMasterKeyEncryptedUserKey(encryptedKey, userId)).rejects.toThrow(
          "Encrypted Key is required.",
        );
      },
    );

    it("throws an error if encryptedKey is malformed null", async () => {
      await expect(
        sut.setMasterKeyEncryptedUserKey(new EncString(null as unknown as string), userId),
      ).rejects.toThrow("Encrypted Key is required.");
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(
          sut.setMasterKeyEncryptedUserKey(new EncString(testMasterKeyEncryptedKey), userId),
        ).rejects.toThrow("User ID is required.");
      },
    );

    it("calls stateProvider with the provided encryptedKey and user ID", async () => {
      const encryptedKey = new EncString(testMasterKeyEncryptedKey);

      await sut.setMasterKeyEncryptedUserKey(encryptedKey, userId);

      const state = await firstValueFrom(
        stateProvider.getUser(userId, MASTER_KEY_ENCRYPTED_USER_KEY).state$,
      );
      expect(state).toEqual(encryptedKey.toJSON());
    });
  });

  describe("getOrDeriveMasterKey", () => {
    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(sut.getOrDeriveMasterKey("password", userId)).rejects.toThrow(
          "User ID is required.",
        );
      },
    );

    it("returns the master key if it is already available", async () => {
      stateProvider.singleUser.getFake(userId, MASTER_KEY).nextState(testMasterKey);
      const result = await sut.getOrDeriveMasterKey("password", userId);

      expect(result).toEqual(testMasterKey);
    });

    it("throws an error if user's email is not available", async () => {
      stateProvider.singleUser.getFake(userId, MASTER_KEY).nextState(null);
      accountService.accounts$ = of({} as any);

      await expect(sut.getOrDeriveMasterKey("password", userId)).rejects.toThrow(
        "No email found for user " + userId,
      );
      expect(kdfConfigService.getKdfConfig$).not.toHaveBeenCalled();
    });

    it("throws an error if user's KDF is not available", async () => {
      stateProvider.singleUser.getFake(userId, MASTER_KEY).nextState(null);

      const accountInfo = {
        email: "email",
        emailVerified: true,
        name: "name",
      };
      accountService.accounts$ = of({ [userId]: accountInfo });
      kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

      await expect(sut.getOrDeriveMasterKey("password", userId)).rejects.toThrow(
        "No kdf found for user " + userId,
      );
      expect(kdfConfigService.getKdfConfig$).toHaveBeenCalledWith(userId);
    });

    it("derives the master key if it is not available", async () => {
      jest.spyOn(sut, "makeMasterKey").mockResolvedValue("mockMasterKey" as any);
      sut.masterKey$ = jest.fn().mockReturnValue(of(null as any));
      const accountInfo = {
        email: "email",
        emailVerified: true,
        name: "name",
      };
      accountService.accounts$ = of({ [userId]: accountInfo });
      kdfConfigService.getKdfConfig$.mockReturnValue(of("kdfConfig" as any));

      const result = await sut.getOrDeriveMasterKey("password", userId);

      expect(sut.masterKey$).toHaveBeenCalledWith(userId);
      expect(kdfConfigService.getKdfConfig$).toHaveBeenCalledWith(userId);
      expect(sut.makeMasterKey).toHaveBeenCalledWith("password", "email", "kdfConfig");
      expect(result).toEqual("mockMasterKey");
    });
  });

  describe("makeMasterKey", () => {
    const password = "testPassword";
    let email = "test@example.com";
    const kdfConfig = mock<KdfConfig>();

    it("derives a master key from password and email", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(testMasterKey);

      const result = await sut.makeMasterKey(password, email, kdfConfig);

      expect(result).toEqual(testMasterKey);
    });

    it("trims and lowercases the email for key generation call", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(testMasterKey);
      email = "  TEST@EXAMPLE.COM  ";

      await sut.makeMasterKey(password, email, kdfConfig);

      expect(keyGenerationService.deriveKeyFromPassword).toHaveBeenCalledWith(
        password,
        email.trim().toLowerCase(),
        kdfConfig,
      );
    });

    it("should log the time taken to derive the master key", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(testMasterKey);
      jest.spyOn(Date.prototype, "getTime").mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      await sut.makeMasterKey(password, email, kdfConfig);

      expect(logService.info).toHaveBeenCalledWith(
        "[MasterPasswordService] Deriving master key took 500ms",
      );
    });
  });

  describe("hashMasterKey", () => {
    const password = "testPassword";
    const masterKey = makeSymmetricCryptoKey(32) as MasterKey;

    test.each([null as unknown as string, undefined as unknown as string])(
      "throws when the provided password is %s",
      async (password) => {
        await expect(sut.hashMasterKey(password, masterKey)).rejects.toThrow(
          "password is required.",
        );
      },
    );

    test.each([null as unknown as MasterKey, undefined as unknown as MasterKey])(
      "throws when the provided key is %s",
      async (key) => {
        await expect(sut.hashMasterKey("password", key)).rejects.toThrow("key is required.");
      },
    );

    it("hashes master key with default iterations when no hashPurpose is provided", async () => {
      const mockReturnedHashB64 = "bXlfaGFzaA==";
      cryptoFunctionService.pbkdf2.mockResolvedValue(Utils.fromB64ToArray(mockReturnedHashB64));

      const result = await sut.hashMasterKey(password, masterKey);

      expect(cryptoFunctionService.pbkdf2).toHaveBeenCalledWith(
        masterKey.inner().encryptionKey,
        password,
        "sha256",
        1,
      );
      expect(result).toBe(mockReturnedHashB64);
    });

    test.each([
      [2, HashPurpose.LocalAuthorization],
      [1, HashPurpose.ServerAuthorization],
    ])(
      "hashes master key with %s iterations when hashPurpose is %s",
      async (expectedIterations, hashPurpose) => {
        const mockReturnedHashB64 = "bXlfaGFzaA==";
        cryptoFunctionService.pbkdf2.mockResolvedValue(Utils.fromB64ToArray(mockReturnedHashB64));

        const result = await sut.hashMasterKey(password, masterKey, hashPurpose);

        expect(cryptoFunctionService.pbkdf2).toHaveBeenCalledWith(
          masterKey.inner().encryptionKey,
          password,
          "sha256",
          expectedIterations,
        );
        expect(result).toBe(mockReturnedHashB64);
      },
    );
  });

  describe("compareKeyHash", () => {
    type TestCase = {
      masterKey: MasterKey;
      masterPassword: string | null;
      storedMasterKeyHash: string | null;
      mockReturnedHash: string;
      expectedToMatch: boolean;
    };

    const data: TestCase[] = [
      {
        masterKey: makeSymmetricCryptoKey(32),
        masterPassword: "my_master_password",
        storedMasterKeyHash: "bXlfaGFzaA==",
        mockReturnedHash: "bXlfaGFzaA==",
        expectedToMatch: true,
      },
      {
        masterKey: makeSymmetricCryptoKey(32),
        masterPassword: null,
        storedMasterKeyHash: "bXlfaGFzaA==",
        mockReturnedHash: "bXlfaGFzaA==",
        expectedToMatch: false,
      },
      {
        masterKey: makeSymmetricCryptoKey(32),
        masterPassword: null,
        storedMasterKeyHash: null,
        mockReturnedHash: "bXlfaGFzaA==",
        expectedToMatch: false,
      },
      {
        masterKey: makeSymmetricCryptoKey(32),
        masterPassword: "my_master_password",
        storedMasterKeyHash: "bXlfaGFzaA==",
        mockReturnedHash: "zxccbXlfaGFzaA==",
        expectedToMatch: false,
      },
    ];

    it.each(data)(
      "returns expected match value when calculated hash equals stored hash",
      async ({
        masterKey,
        masterPassword,
        storedMasterKeyHash,
        mockReturnedHash,
        expectedToMatch,
      }) => {
        stateProvider.singleUser.getFake(userId, MASTER_KEY_HASH).nextState(storedMasterKeyHash);

        cryptoFunctionService.pbkdf2
          .calledWith(masterKey.inner().encryptionKey, masterPassword as string, "sha256", 2)
          .mockResolvedValue(Utils.fromB64ToArray(mockReturnedHash));

        const actualDidMatch = await sut.compareKeyHash(masterPassword, masterKey, userId);

        expect(actualDidMatch).toBe(expectedToMatch);
      },
    );

    test.each([null as unknown as MasterKey, undefined as unknown as MasterKey])(
      "throws an error if masterKey is %s",
      async (masterKey) => {
        await expect(sut.compareKeyHash("my_master_password", masterKey, userId)).rejects.toThrow(
          "'masterKey' is required to be non-null.",
        );
      },
    );

    test.each([null as unknown as string, undefined as unknown as string])(
      "returns false when masterPassword is %s",
      async (masterPassword) => {
        const result = await sut.compareKeyHash(masterPassword, makeSymmetricCryptoKey(32), userId);
        expect(result).toBe(false);
      },
    );

    it("returns false when storedMasterKeyHash is null", async () => {
      stateProvider.singleUser.getFake(userId, MASTER_KEY_HASH).nextState(null);

      const result = await sut.compareKeyHash(
        "my_master_password",
        makeSymmetricCryptoKey(32),
        userId,
      );
      expect(result).toBe(false);
    });
  });
});
