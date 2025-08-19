// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { makeEncString } from "../../../../../spec";

import { UserDecryptionOptionsResponse } from "./user-decryption-options.response";

describe("UserDecryptionOptionsResponse", () => {
  it("should create response when master password unlock is present", () => {
    const salt = "test@example.com";
    const encryptedUserKey = makeEncString("testUserKey");

    const response = new UserDecryptionOptionsResponse({
      HasMasterPassword: true,
      MasterPasswordUnlock: {
        Salt: salt,
        Kdf: {
          KdfType: KdfType.PBKDF2_SHA256,
          Iterations: 600_000,
        },
        MasterKeyEncryptedUserKey: encryptedUserKey.encryptedString,
      },
    });

    expect(response.hasMasterPassword).toBe(true);
    expect(response.masterPasswordUnlock).toBeDefined();
    expect(response.masterPasswordUnlock!.salt).toEqual(salt);
    expect(response.masterPasswordUnlock!.kdf.kdfType).toEqual(KdfType.PBKDF2_SHA256);
    expect(response.masterPasswordUnlock!.kdf.iterations).toEqual(600_000);
    expect(response.masterPasswordUnlock!.masterKeyWrappedUserKey).toEqual(encryptedUserKey);
    expect(response.trustedDeviceOption).toBeUndefined();
    expect(response.keyConnectorOption).toBeUndefined();
    expect(response.webAuthnPrfOption).toBeUndefined();
  });

  it("should create response when master password unlock is not present", () => {
    const response = new UserDecryptionOptionsResponse({
      HasMasterPassword: false,
    });

    expect(response.hasMasterPassword).toBe(false);
    expect(response.masterPasswordUnlock).toBeUndefined();
    expect(response.trustedDeviceOption).toBeUndefined();
    expect(response.keyConnectorOption).toBeUndefined();
    expect(response.webAuthnPrfOption).toBeUndefined();
  });
});
