import { Jsonify } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";
import { WrappedAccountCryptographicState } from "@bitwarden/sdk-internal";

import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "./master-password/types/master-password.types";
import { ACCOUNT_CRYPTOGRAPHIC_STATE, MASTER_PASSWORD_UNLOCK_DATA } from "./state-definitions";

describe("ACCOUNT_CRYPTOGRAPHIC_STATE", () => {
  it("deserializer returns object as-is", () => {
    const mockState = {
      V1: {
        private_key: "test" as any,
      },
    } as WrappedAccountCryptographicState;

    const result = ACCOUNT_CRYPTOGRAPHIC_STATE.deserializer(mockState);

    expect(result).toBe(mockState);
  });
});

describe("MASTER_PASSWORD_UNLOCK_DATA", () => {
  it("has the correct configuration", () => {
    expect(MASTER_PASSWORD_UNLOCK_DATA.stateDefinition).toBeDefined();
    expect(MASTER_PASSWORD_UNLOCK_DATA.key).toBe("masterPasswordUnlockKey");
    expect(MASTER_PASSWORD_UNLOCK_DATA.clearOn).toEqual(["logout"]);
  });

  describe("deserializer", () => {
    const kdfPBKDF2: KdfConfig = new PBKDF2KdfConfig(600_000);
    const kdfArgon2: KdfConfig = new Argon2KdfConfig(4, 64, 3);
    const salt = "test@bitwarden.com" as MasterPasswordSalt;
    const encryptedUserKey = "testUserKet" as MasterKeyWrappedUserKey;

    it("returns null when value is null", () => {
      const deserialized = MASTER_PASSWORD_UNLOCK_DATA.deserializer(
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

      const deserialized = MASTER_PASSWORD_UNLOCK_DATA.deserializer(data);
      expect(deserialized).toEqual(new MasterPasswordUnlockData(salt, kdfPBKDF2, encryptedUserKey));
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

      const deserialized = MASTER_PASSWORD_UNLOCK_DATA.deserializer(data);
      expect(deserialized).toEqual(new MasterPasswordUnlockData(salt, kdfArgon2, encryptedUserKey));
    });
  });
});
