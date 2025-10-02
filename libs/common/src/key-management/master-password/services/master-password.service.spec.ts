import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";
import { PureCrypto } from "@bitwarden/sdk-internal";

import {
  FakeAccountService,
  FakeSingleUserState,
  FakeStateProvider,
  makeEncString,
  makeSymmetricCryptoKey,
  mockAccountServiceWith,
} from "../../../../spec";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { LogService } from "../../../platform/abstractions/log.service";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";
import { KeyGenerationService } from "../../crypto";
import { CryptoFunctionService } from "../../crypto/abstractions/crypto-function.service";
import { EncryptedString, EncString } from "../../crypto/models/enc-string";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../types/master-password.types";

import {
  FORCE_SET_PASSWORD_REASON,
  MASTER_KEY,
  MASTER_KEY_ENCRYPTED_USER_KEY,
  MASTER_PASSWORD_UNLOCK_KEY,
  MasterPasswordService,
} from "./master-password.service";

describe("MasterPasswordService", () => {
  let sut: MasterPasswordService;

  let stateProvider: FakeStateProvider;
  let keyGenerationService: MockProxy<KeyGenerationService>;
  let logService: MockProxy<LogService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let accountService: FakeAccountService;
  let masterKeyState: FakeSingleUserState<MasterKey>;
  let forceSetPasswordReasonState: FakeSingleUserState<ForceSetPasswordReason>;
  let masterKeyEncryptedUserKeyState: FakeSingleUserState<EncryptedString>;
  let masterPasswordUnlockKeyState: FakeSingleUserState<MasterPasswordUnlockData>;

  const userId = "00000000-0000-0000-0000-000000000000" as UserId;

  const testMasterKeyEncryptedKey =
    "0.gbauOANURUHqvhLTDnva1A==|nSW+fPumiuTaDB/s12+JO88uemV6rhwRSR+YR1ZzGr5j6Ei3/h+XEli2Unpz652NlZ9NTuRpHxeOqkYYJtp7J+lPMoclgteXuAzUu9kqlRc=";

  const sdkLoadServiceReady = jest.fn();

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    keyGenerationService = mock<KeyGenerationService>();
    logService = mock<LogService>();
    cryptoFunctionService = mock<CryptoFunctionService>();

    masterKeyState = stateProvider.singleUser.getFake(userId, MASTER_KEY);
    forceSetPasswordReasonState = stateProvider.singleUser.getFake(
      userId,
      FORCE_SET_PASSWORD_REASON,
    );
    masterKeyEncryptedUserKeyState = stateProvider.singleUser.getFake(
      userId,
      MASTER_KEY_ENCRYPTED_USER_KEY,
    );
    masterPasswordUnlockKeyState = stateProvider.singleUser.getFake(
      userId,
      MASTER_PASSWORD_UNLOCK_KEY,
    );

    sut = new MasterPasswordService(
      stateProvider,
      keyGenerationService,
      logService,
      cryptoFunctionService,
      accountService,
    );

    keyGenerationService.stretchKey.mockResolvedValue(makeSymmetricCryptoKey(64, 3));
    Object.defineProperty(SdkLoadService, "Ready", {
      value: new Promise((resolve) => {
        sdkLoadServiceReady();
        resolve(undefined);
      }),
      configurable: true,
    });
  });

  describe("saltForUser$", () => {
    it("throws when userid not present", async () => {
      expect(() => {
        sut.saltForUser$(null as unknown as UserId);
      }).toThrow("userId is null or undefined.");
    });
    it("throws when userid present but not in account service", async () => {
      await expect(
        firstValueFrom(sut.saltForUser$("00000000-0000-0000-0000-000000000001" as UserId)),
      ).rejects.toThrow("Cannot read properties of undefined (reading 'email')");
    });
    it("returns salt", async () => {
      const salt = await firstValueFrom(sut.saltForUser$(userId));
      expect(salt).toBeDefined();
    });
  });

  describe("setForceSetPasswordReason", () => {
    it("calls stateProvider with the provided reason and user ID", async () => {
      const reason = ForceSetPasswordReason.WeakMasterPassword;

      await sut.setForceSetPasswordReason(reason, userId);

      expect(forceSetPasswordReasonState.nextMock).toHaveBeenCalledWith(reason);
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
      forceSetPasswordReasonState.nextState(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.WeakMasterPassword, userId);

      expect(forceSetPasswordReasonState.nextMock).not.toHaveBeenCalled();
    });

    it("allows overwriting AdminForcePasswordReset with None", async () => {
      forceSetPasswordReasonState.nextState(ForceSetPasswordReason.AdminForcePasswordReset);

      await sut.setForceSetPasswordReason(ForceSetPasswordReason.None, userId);

      expect(forceSetPasswordReasonState.nextMock).toHaveBeenCalledWith(
        ForceSetPasswordReason.None,
      );
    });
  });

  describe("decryptUserKeyWithMasterKey", () => {
    const masterKey = makeSymmetricCryptoKey(64, 0) as MasterKey;
    const userKey = makeSymmetricCryptoKey(64, 1) as UserKey;
    const masterKeyEncryptedUserKey = makeEncString("test-encrypted-user-key");

    const decryptUserKeyWithMasterKeyMock = jest.spyOn(
      PureCrypto,
      "decrypt_user_key_with_master_key",
    );

    beforeEach(() => {
      decryptUserKeyWithMasterKeyMock.mockReturnValue(userKey.toEncoded());
    });

    it("successfully decrypts", async () => {
      const decryptedUserKey = await sut.decryptUserKeyWithMasterKey(
        masterKey,
        userId,
        masterKeyEncryptedUserKey,
      );

      expect(decryptedUserKey).toEqual(new SymmetricCryptoKey(userKey.toEncoded()));
      expect(sdkLoadServiceReady).toHaveBeenCalled();
      expect(PureCrypto.decrypt_user_key_with_master_key).toHaveBeenCalledWith(
        masterKeyEncryptedUserKey.toSdk(),
        masterKey.toEncoded(),
      );
      expect(sdkLoadServiceReady.mock.invocationCallOrder[0]).toBeLessThan(
        decryptUserKeyWithMasterKeyMock.mock.invocationCallOrder[0],
      );
    });

    it("returns null when failed to decrypt", async () => {
      decryptUserKeyWithMasterKeyMock.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      const decryptedUserKey = await sut.decryptUserKeyWithMasterKey(
        masterKey,
        userId,
        masterKeyEncryptedUserKey,
      );
      expect(decryptedUserKey).toBeNull();
    });

    it("returns error when master key is null", async () => {
      masterKeyState.nextState(null);

      await expect(
        sut.decryptUserKeyWithMasterKey(
          null as unknown as MasterKey,
          userId,
          masterKeyEncryptedUserKey,
        ),
      ).rejects.toThrow("No master key found.");
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

      expect(masterKeyEncryptedUserKeyState.nextMock).toHaveBeenCalledWith(encryptedKey.toJSON());
    });
  });

  describe("makeMasterPasswordAuthenticationData", () => {
    const password = "test-password";
    const kdf: KdfConfig = new PBKDF2KdfConfig(600_000);
    const salt = "test@bitwarden.com" as MasterPasswordSalt;
    const masterKey = makeSymmetricCryptoKey(32, 2);
    const masterKeyHash = makeSymmetricCryptoKey(32, 3).toEncoded();

    beforeEach(() => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(masterKey);
      cryptoFunctionService.pbkdf2.mockResolvedValue(masterKeyHash);
    });

    it("derives master key and creates authentication hash", async () => {
      const result = await sut.makeMasterPasswordAuthenticationData(password, kdf, salt);

      expect(keyGenerationService.deriveKeyFromPassword).toHaveBeenCalledWith(password, salt, kdf);
      expect(cryptoFunctionService.pbkdf2).toHaveBeenCalledWith(
        masterKey.toEncoded(),
        password,
        "sha256",
        1,
      );

      expect(result).toEqual({
        kdf,
        salt,
        masterPasswordAuthenticationHash: Utils.fromBufferToB64(masterKeyHash),
      });
    });

    it("throws if password is null", async () => {
      await expect(
        sut.makeMasterPasswordAuthenticationData(null as unknown as string, kdf, salt),
      ).rejects.toThrow();
    });
    it("throws if kdf is null", async () => {
      await expect(
        sut.makeMasterPasswordAuthenticationData(password, null as unknown as KdfConfig, salt),
      ).rejects.toThrow();
    });
    it("throws if salt is null", async () => {
      await expect(
        sut.makeMasterPasswordAuthenticationData(
          password,
          kdf,
          null as unknown as MasterPasswordSalt,
        ),
      ).rejects.toThrow();
    });
  });

  describe("wrapUnwrapUserKeyWithPassword", () => {
    const password = "test-password";
    const kdf: KdfConfig = new PBKDF2KdfConfig(600_000);
    const salt = "test@bitwarden.com" as MasterPasswordSalt;
    const userKey = makeSymmetricCryptoKey(64, 2) as UserKey;

    it("wraps and unwraps user key with password", async () => {
      const unlockData = await sut.makeMasterPasswordUnlockData(password, kdf, salt, userKey);
      const unwrappedUserkey = await sut.unwrapUserKeyFromMasterPasswordUnlockData(
        password,
        unlockData,
      );
      expect(unwrappedUserkey).toEqual(userKey);
    });

    it("throws if password is null", async () => {
      await expect(
        sut.makeMasterPasswordUnlockData(null as unknown as string, kdf, salt, userKey),
      ).rejects.toThrow();
    });
    it("throws if kdf is null", async () => {
      await expect(
        sut.makeMasterPasswordUnlockData(password, null as unknown as KdfConfig, salt, userKey),
      ).rejects.toThrow();
    });
    it("throws if salt is null", async () => {
      await expect(
        sut.makeMasterPasswordUnlockData(
          password,
          kdf,
          null as unknown as MasterPasswordSalt,
          userKey,
        ),
      ).rejects.toThrow();
    });
    it("throws if userKey is null", async () => {
      await expect(
        sut.makeMasterPasswordUnlockData(password, kdf, salt, null as unknown as UserKey),
      ).rejects.toThrow();
    });
  });

  describe("setMasterPasswordUnlockData", () => {
    const kdfPBKDF2: KdfConfig = new PBKDF2KdfConfig(600_000);
    const kdfArgon2: KdfConfig = new Argon2KdfConfig(4, 64, 3);
    const salt = "test@bitwarden.com" as MasterPasswordSalt;
    const userKey = makeSymmetricCryptoKey(64, 2) as UserKey;

    it.each([kdfPBKDF2, kdfArgon2])(
      "sets the master password unlock data kdf %o in the state",
      async (kdfConfig) => {
        const masterKeyWrappedUserKey = makeEncString().toSdk() as MasterKeyWrappedUserKey;
        const masterPasswordUnlockData = new MasterPasswordUnlockData(
          salt,
          kdfConfig,
          masterKeyWrappedUserKey,
        );

        await sut.setMasterPasswordUnlockData(masterPasswordUnlockData, userId);

        expect(masterPasswordUnlockKeyState.nextMock).toHaveBeenCalledWith(
          masterPasswordUnlockData.toJSON(),
        );
      },
    );

    it("throws if masterPasswordUnlockData is null", async () => {
      await expect(
        sut.setMasterPasswordUnlockData(null as unknown as MasterPasswordUnlockData, userId),
      ).rejects.toThrow("masterPasswordUnlockData is null or undefined.");
    });

    it("throws if userId is null", async () => {
      const masterPasswordUnlockData = await sut.makeMasterPasswordUnlockData(
        "test-password",
        kdfPBKDF2,
        salt,
        userKey,
      );

      await expect(
        sut.setMasterPasswordUnlockData(masterPasswordUnlockData, null as unknown as UserId),
      ).rejects.toThrow("userId is null or undefined.");
    });
  });

  describe("MASTER_PASSWORD_UNLOCK_KEY", () => {
    it("has the correct configuration", () => {
      expect(MASTER_PASSWORD_UNLOCK_KEY.stateDefinition).toBeDefined();
      expect(MASTER_PASSWORD_UNLOCK_KEY.key).toBe("masterPasswordUnlockKey");
      expect(MASTER_PASSWORD_UNLOCK_KEY.clearOn).toEqual(["logout"]);
    });

    describe("deserializer", () => {
      const kdfPBKDF2: KdfConfig = new PBKDF2KdfConfig(600_000);
      const kdfArgon2: KdfConfig = new Argon2KdfConfig(4, 64, 3);
      const salt = "test@bitwarden.com" as MasterPasswordSalt;
      const encryptedUserKey = "testUserKet" as MasterKeyWrappedUserKey;

      it("returns null when value is null", () => {
        const deserialized = MASTER_PASSWORD_UNLOCK_KEY.deserializer(
          null as unknown as Jsonify<MasterPasswordUnlockData>,
        );
        expect(deserialized).toBeNull();
      });

      it("returns master password unlock data when value is present and kdf type is pbkdf2", () => {
        const data: Jsonify<MasterPasswordUnlockData> = {
          salt: salt,
          kdf: {
            kdfType: KdfType.PBKDF2_SHA256,
            iterations: kdfPBKDF2.iterations,
          },
          masterKeyWrappedUserKey: encryptedUserKey as string,
        };

        const deserialized = MASTER_PASSWORD_UNLOCK_KEY.deserializer(data);
        expect(deserialized).toEqual(
          new MasterPasswordUnlockData(salt, kdfPBKDF2, encryptedUserKey),
        );
      });

      it("returns master password unlock data when value is present and kdf type is argon2", () => {
        const data: Jsonify<MasterPasswordUnlockData> = {
          salt: salt,
          kdf: {
            kdfType: KdfType.Argon2id,
            iterations: kdfArgon2.iterations,
            memory: kdfArgon2.memory,
            parallelism: kdfArgon2.parallelism,
          },
          masterKeyWrappedUserKey: encryptedUserKey as string,
        };

        const deserialized = MASTER_PASSWORD_UNLOCK_KEY.deserializer(data);
        expect(deserialized).toEqual(
          new MasterPasswordUnlockData(salt, kdfArgon2, encryptedUserKey),
        );
      });
    });
  });
});
