import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { USER_DECRYPTION_OPTIONS } from "@bitwarden/auth/common";
// eslint-disable-next-line no-restricted-imports
import {
  Argon2KdfConfig,
  CryptoFunctionService,
  KdfConfig,
  KeyGenerationService,
  PBKDF2KdfConfig,
} from "@bitwarden/legacy-crypto";

import {
  FakeAccountService,
  FakeStateProvider,
  makeEncString,
  makeSymmetricCryptoKey,
  mockAccountServiceWith,
} from "../../../../spec";
import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { Utils } from "../../../platform/misc/utils";
import { USER_SERVER_CONFIG } from "../../../platform/services/config/default-config.service";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { MASTER_PASSWORD_UNLOCK_DATA } from "../../state-definitions";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../types/master-password.types";

import { FORCE_SET_PASSWORD_REASON, MasterPasswordService } from "./master-password.service";

describe("MasterPasswordService", () => {
  let sut: MasterPasswordService;

  let keyGenerationService: MockProxy<KeyGenerationService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  const userId = "00000000-0000-0000-0000-000000000000" as UserId;

  const kdfPBKDF2: KdfConfig = new PBKDF2KdfConfig(600_000);
  const kdfArgon2: KdfConfig = new Argon2KdfConfig(4, 64, 3);
  const salt = "test@bitwarden.com" as MasterPasswordSalt;
  const userKey = makeSymmetricCryptoKey(64, 2) as UserKey;
  const sdkLoadServiceReady = jest.fn();

  beforeEach(() => {
    keyGenerationService = mock<KeyGenerationService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);

    sut = new MasterPasswordService(
      stateProvider,
      keyGenerationService,
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

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("saltForUser$", () => {
    it("throws when userid not present", async () => {
      expect(() => {
        sut.saltForUser$(null as unknown as UserId);
      }).toThrow("userId is null or undefined.");
    });
    // Removable with unwinding of PM31088_MasterPasswordServiceEmitSalt
    it("throws when userid present but not in account service", async () => {
      await expect(
        firstValueFrom(sut.saltForUser$("00000000-0000-0000-0000-000000000001" as UserId)),
      ).rejects.toThrow("Cannot read properties of undefined (reading 'email')");
    });
    // Removable with unwinding of PM31088_MasterPasswordServiceEmitSalt
    it("returns email-derived salt for legacy path", async () => {
      const result = await firstValueFrom(sut.saltForUser$(userId));
      // mockAccountServiceWith defaults email to "email"
      expect(result).toBe("email" as MasterPasswordSalt);
    });

    describe("saltForUser$ master password unlock data migration path", () => {
      // Flagged with  PM31088_MasterPasswordServiceEmitSalt PM-31088
      beforeEach(() => {
        stateProvider.singleUser.getFake(userId, USER_SERVER_CONFIG).nextState({
          featureStates: {
            [FeatureFlag.PM31088_MasterPasswordServiceEmitSalt]: true,
          },
        } as unknown as ServerConfig);
      });

      // Unwinding should promote these tests as part of saltForUser suite.
      it("returns salt from master password unlock data", async () => {
        const expectedSalt = "custom-salt" as MasterPasswordSalt;
        const unlockData = new MasterPasswordUnlockData(
          expectedSalt,
          new PBKDF2KdfConfig(600_000),
          makeEncString().toSdk() as MasterKeyWrappedUserKey,
        );
        stateProvider.singleUser
          .getFake(userId, MASTER_PASSWORD_UNLOCK_DATA)
          .nextState(unlockData.toJSON());

        const result = await firstValueFrom(sut.saltForUser$(userId));
        expect(result).toBe(expectedSalt);
      });

      it("throws when unlock data is null and user has a master password (hydration failure)", async () => {
        stateProvider.singleUser.getFake(userId, MASTER_PASSWORD_UNLOCK_DATA).nextState(null);
        // Simulate a user the server says has a master password
        stateProvider.singleUser
          .getFake(userId, USER_DECRYPTION_OPTIONS)
          .nextState({ hasMasterPassword: true });

        await expect(firstValueFrom(sut.saltForUser$(userId))).rejects.toThrow(
          "Master password unlock data not found for user.",
        );
      });

      it("returns email-derived salt when unlock data is null and user has no master password (TDE offboarding)", async () => {
        stateProvider.singleUser.getFake(userId, MASTER_PASSWORD_UNLOCK_DATA).nextState(null);

        const result = await firstValueFrom(sut.saltForUser$(userId));

        // mockAccountServiceWith defaults email to "email"; emailToSalt lowercases and trims it
        expect(result).toBe("email" as MasterPasswordSalt);
      });
    });
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

        const state = await firstValueFrom(
          stateProvider.getUser(userId, MASTER_PASSWORD_UNLOCK_DATA).state$,
        );
        expect(state).toEqual(masterPasswordUnlockData.toJSON());
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

  describe("masterPasswordUnlockData$", () => {
    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        expect(() => sut.masterPasswordUnlockData$(userId)).toThrow("userId is null or undefined.");
      },
    );

    it("returns null when no data is set", async () => {
      stateProvider.singleUser.getFake(userId, MASTER_PASSWORD_UNLOCK_DATA).nextState(null);

      const result = await firstValueFrom(sut.masterPasswordUnlockData$(userId));

      expect(result).toBeNull();
    });

    it.each([kdfPBKDF2, kdfArgon2])(
      "returns the master password unlock data for kdf %o from state",
      async (kdfConfig) => {
        const masterPasswordUnlockData = await sut.makeMasterPasswordUnlockData(
          "test-password",
          kdfConfig,
          salt,
          userKey,
        );
        await sut.setMasterPasswordUnlockData(masterPasswordUnlockData, userId);

        const result = await firstValueFrom(sut.masterPasswordUnlockData$(userId));

        expect(result).toEqual(masterPasswordUnlockData.toJSON());
      },
    );
  });

  describe("clearMasterPasswordUnlockData", () => {
    it("clears the master password unlock data from state", async () => {
      const masterKeyWrappedUserKey = makeEncString().toSdk() as MasterKeyWrappedUserKey;
      const masterPasswordUnlockData = new MasterPasswordUnlockData(
        salt,
        kdfPBKDF2,
        masterKeyWrappedUserKey,
      );
      stateProvider.singleUser
        .getFake(userId, MASTER_PASSWORD_UNLOCK_DATA)
        .nextState(masterPasswordUnlockData.toJSON());

      await sut.clearMasterPasswordUnlockData(userId);

      const state = await firstValueFrom(
        stateProvider.getUser(userId, MASTER_PASSWORD_UNLOCK_DATA).state$,
      );
      expect(state).toBeNull();
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(sut.clearMasterPasswordUnlockData(userId)).rejects.toThrow(
          "userId is null or undefined.",
        );
      },
    );
  });
});
