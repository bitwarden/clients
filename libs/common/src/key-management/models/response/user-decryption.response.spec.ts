// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/key-management";

import { UserDecryptionResponse } from "./user-decryption.response";

describe("UserDecryptionResponse", () => {
  it("should create response when masterPasswordUnlock provided", () => {
    const salt = "test@example.com";
    const encryptedUserKey = "testUserKey";
    const kdfIterations = 600_000;

    const response = {
      MasterPasswordUnlock: {
        Salt: salt,
        Kdf: {
          KdfType: KdfType.PBKDF2_SHA256 as number,
          Iterations: kdfIterations,
        },
        MasterKeyEncryptedUserKey: encryptedUserKey,
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

  it("should parse v2UpgradeToken when V2UpgradeToken is provided", () => {
    const wrappedUserKey1 = "wrappedUserKey1";
    const wrappedUserKey2 = "wrappedUserKey2";

    const response = {
      V2UpgradeToken: {
        WrappedUserKey1: wrappedUserKey1,
        WrappedUserKey2: wrappedUserKey2,
      },
    };

    const userDecryptionResponse = new UserDecryptionResponse(response);

    expect(userDecryptionResponse.v2UpgradeToken).toBeDefined();
    expect(userDecryptionResponse.v2UpgradeToken!.wrappedUserKey1).toEqual(wrappedUserKey1);
    expect(userDecryptionResponse.v2UpgradeToken!.wrappedUserKey2).toEqual(wrappedUserKey2);
  });

  it.each([null, undefined, "not object type"])(
    "should leave v2UpgradeToken undefined when V2UpgradeToken is %s",
    (v2UpgradeToken) => {
      const userDecryptionResponse = new UserDecryptionResponse({
        V2UpgradeToken: v2UpgradeToken,
      });

      expect(userDecryptionResponse.v2UpgradeToken).toBeUndefined();
    },
  );

  describe("toSdk", () => {
    it("should map every option when the response is fully populated", () => {
      const userDecryptionResponse = new UserDecryptionResponse({
        MasterPasswordUnlock: {
          Salt: "test@example.com",
          Kdf: {
            KdfType: KdfType.PBKDF2_SHA256 as number,
            Iterations: 600_000,
          },
          MasterKeyEncryptedUserKey: "masterKeyEncryptedUserKey",
        },
        V2UpgradeToken: {
          WrappedUserKey1: "wrappedUserKey1",
          WrappedUserKey2: "wrappedUserKey2",
        },
        WebAuthnPrfOptions: [
          {
            EncryptedPrivateKey: "2.abc|def|ghi",
            EncryptedUserKey: "4.jkl",
            CredentialId: "credentialId",
            Transports: ["usb"],
          },
        ],
      });

      expect(userDecryptionResponse.toSdk()).toEqual({
        masterPasswordUnlock: {
          salt: "test@example.com",
          kdf: {
            pBKDF2: { iterations: 600_000 },
          },
          masterKeyWrappedUserKey: "masterKeyEncryptedUserKey",
        },
        v2UpgradeToken: {
          wrapped_user_key_1: "wrappedUserKey1",
          wrapped_user_key_2: "wrappedUserKey2",
        },
        webAuthnPrfOptions: [
          {
            encryptedPrivateKey: "2.abc|def|ghi",
            encryptedUserKey: "4.jkl",
            credentialId: "credentialId",
            transports: ["usb"],
          },
        ],
      });
    });

    it("should leave optional options undefined and default webAuthnPrfOptions to an empty array", () => {
      const userDecryptionResponse = new UserDecryptionResponse({});

      expect(userDecryptionResponse.toSdk()).toEqual({
        masterPasswordUnlock: undefined,
        v2UpgradeToken: undefined,
        webAuthnPrfOptions: [],
      });
    });

    it("should drop webAuthnPrfOptions that are missing a wrapped key", () => {
      const userDecryptionResponse = new UserDecryptionResponse({
        WebAuthnPrfOptions: [
          {
            EncryptedUserKey: "4.jkl",
            CredentialId: "missingPrivateKey",
            Transports: [],
          },
          {
            EncryptedPrivateKey: "2.abc|def|ghi",
            CredentialId: "missingUserKey",
            Transports: [],
          },
        ],
      });

      expect(userDecryptionResponse.toSdk().webAuthnPrfOptions).toEqual([]);
    });
  });
});
