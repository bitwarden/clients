// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { makeEncString } from "../../../../spec";

import { UserDecryptionResponse } from "./user-decryption.response";

describe("UserDecryptionResponse", () => {
  it("should create response when masterPasswordUnlock provided", () => {
    const salt = "test@example.com";
    const encryptedUserKey = makeEncString("testUserKey");
    const kdfIterations = 600_000;

    const response = {
      MasterPasswordUnlock: {
        Salt: salt,
        Kdf: {
          KdfType: KdfType.PBKDF2_SHA256 as number,
          Iterations: kdfIterations,
        },
        MasterKeyEncryptedUserKey: encryptedUserKey.encryptedString,
      },
    };

    const userDecryptionResponse = new UserDecryptionResponse(response);
    expect(userDecryptionResponse.masterPasswordUnlock).toBeDefined();
    expect(userDecryptionResponse.masterPasswordUnlock!.salt).toEqual(salt);
    expect(userDecryptionResponse.masterPasswordUnlock!.kdf).toBeDefined();
    expect(userDecryptionResponse.masterPasswordUnlock!.kdf!.kdfType).toEqual(
      KdfType.PBKDF2_SHA256,
    );
    expect(userDecryptionResponse.masterPasswordUnlock!.kdf!.iterations).toEqual(kdfIterations);
    expect(userDecryptionResponse.masterPasswordUnlock!.masterKeyWrappedUserKey).toEqual(
      encryptedUserKey,
    );
  });

  it.each([null, undefined, "should be object type"])(
    "should create response when masterPasswordUnlock is %s",
    (masterPasswordUnlock) => {
      const userDecryptionResponse = new UserDecryptionResponse({
        MasterPasswordUnlock: masterPasswordUnlock,
      });

      expect(userDecryptionResponse.masterPasswordUnlock).toBeUndefined();
    },
  );
});
