// eslint-disable-next-line no-restricted-imports
import { KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { makeEncString } from "../../../../../spec";

import { MasterPasswordUnlockResponse } from "./master-password-unlock.response";

describe("MasterPasswordUnlockResponse", () => {
  const salt = "test@example.com";
  const encryptedUserKey = makeEncString("testUserKey");
  const testKdfResponse = { KdfType: KdfType.PBKDF2_SHA256, Iterations: 600_000 };

  it("should throw error when salt is not provided", () => {
    expect(() => {
      new MasterPasswordUnlockResponse({
        Salt: undefined,
        Kdf: testKdfResponse,
        MasterKeyEncryptedUserKey: encryptedUserKey.encryptedString,
      });
    }).toThrow("MasterPasswordUnlockResponse does not contain a valid salt");
  });

  it("should throw error when master key encrypted user key is not provided", () => {
    expect(() => {
      new MasterPasswordUnlockResponse({
        Salt: salt,
        Kdf: testKdfResponse,
        MasterKeyEncryptedUserKey: undefined,
      });
    }).toThrow(
      "MasterPasswordUnlockResponse does not contain a valid master key encrypted user key",
    );
  });

  it("should create response", () => {
    const response = new MasterPasswordUnlockResponse({
      Salt: salt,
      Kdf: testKdfResponse,
      MasterKeyEncryptedUserKey: encryptedUserKey.encryptedString,
    });

    expect(response.salt).toBe(salt);
    expect(response.kdf).toBeDefined();
    expect(response.kdf.toKdfConfig()).toEqual(new PBKDF2KdfConfig(600_000));
    expect(response.masterKeyWrappedUserKey).toEqual(encryptedUserKey);
  });

  describe("toMasterPasswordUnlockData", () => {
    it("should return MasterPasswordUnlockData", () => {
      const response = new MasterPasswordUnlockResponse({
        Salt: salt,
        Kdf: testKdfResponse,
        MasterKeyEncryptedUserKey: encryptedUserKey.encryptedString,
      });

      const unlockData = response.toMasterPasswordUnlockData();
      expect(unlockData).toBeDefined();
      expect(unlockData.salt).toBe(salt);
      expect(unlockData.kdf).toEqual(new PBKDF2KdfConfig(600_000));
      expect(unlockData.masterKeyWrappedUserKey).toEqual(encryptedUserKey);
    });
  });
});
