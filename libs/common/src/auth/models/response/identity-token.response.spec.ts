// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { Argon2KdfConfig, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { makeEncString } from "../../../../spec";

import { IdentityTokenResponse } from "./identity-token.response";

describe("IdentityTokenResponse", () => {
  const accessToken = "testAccessToken";
  const tokenType = "Bearer";
  const expiresIn = 3600;
  const refreshToken = "testRefreshToken";
  const encryptedUserKey = makeEncString("testUserKey");
  const kdfFields = { Kdf: 0, KdfIterations: 600_000 };

  it("should throw an error when access token is missing", () => {
    const response = {
      access_token: undefined as unknown,
      token_type: tokenType,
    };

    expect(() => new IdentityTokenResponse(response)).toThrow(
      "Identity response does not contain a valid access token",
    );
  });

  it("should throw an error when token type is missing", () => {
    const response = {
      access_token: accessToken,
      token_type: undefined as unknown,
    };

    expect(() => new IdentityTokenResponse(response)).toThrow(
      "Identity response does not contain a valid token type",
    );
  });

  it("should create response without optional fields", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accessToken).toEqual(accessToken);
    expect(identityTokenResponse.tokenType).toEqual(tokenType);
    expect(identityTokenResponse.expiresIn).toBeUndefined();
    expect(identityTokenResponse.refreshToken).toBeUndefined();
  });

  it("should create response with expires_in present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accessToken).toEqual(accessToken);
    expect(identityTokenResponse.tokenType).toEqual(tokenType);
    expect(identityTokenResponse.expiresIn).toEqual(expiresIn);
    expect(identityTokenResponse.refreshToken).toBeUndefined();
  });

  it("should create response with refresh_token present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      expires_in: expiresIn,
      refresh_token: refreshToken,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accessToken).toEqual(accessToken);
    expect(identityTokenResponse.tokenType).toEqual(tokenType);
    expect(identityTokenResponse.expiresIn).toEqual(expiresIn);
    expect(identityTokenResponse.refreshToken).toEqual(refreshToken);
  });

  it("should create response with key is not present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      Key: undefined as unknown,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.key).toBeUndefined();
  });

  it("should create response with key present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      Key: encryptedUserKey.encryptedString,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.key).toEqual(encryptedUserKey);
  });

  it("should create response with user decryption options is not present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      UserDecryptionOptions: undefined as unknown,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.userDecryptionOptions).toBeUndefined();
  });

  it("should create response with user decryption options present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      UserDecryptionOptions: {},
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.userDecryptionOptions).toBeDefined();
  });

  it("should create response with accountKeys not present", () => {
    const response = {
      access_token: accessToken,
      token_type: tokenType,
      AccountKeys: null as unknown,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accountKeysResponseModel).toBeNull();
  });

  it("should create response with accountKeys present", () => {
    const accountKeysData = {
      publicKeyEncryptionKeyPair: {
        publicKey: "testPublicKey",
        wrappedPrivateKey: "testPrivateKey",
      },
    };

    const response = {
      access_token: accessToken,
      token_type: tokenType,
      AccountKeys: accountKeysData,
      ...kdfFields,
    };

    const identityTokenResponse = new IdentityTokenResponse(response);
    expect(identityTokenResponse.accountKeysResponseModel).toBeDefined();
    expect(
      identityTokenResponse.accountKeysResponseModel?.publicKeyEncryptionKeyPair,
    ).toBeDefined();
  });

  describe("kdfConfig", () => {
    it("should build a PBKDF2KdfConfig when Kdf is PBKDF2_SHA256", () => {
      const response = {
        access_token: accessToken,
        token_type: tokenType,
        Kdf: KdfType.PBKDF2_SHA256,
        KdfIterations: 600_000,
      };

      const identityTokenResponse = new IdentityTokenResponse(response);
      expect(identityTokenResponse.kdfConfig).toBeInstanceOf(PBKDF2KdfConfig);
      expect((identityTokenResponse.kdfConfig as PBKDF2KdfConfig).iterations).toEqual(600_000);
    });

    it("should build an Argon2KdfConfig when Kdf is Argon2id", () => {
      const response = {
        access_token: accessToken,
        token_type: tokenType,
        Kdf: KdfType.Argon2id,
        KdfIterations: 3,
        KdfMemory: 64,
        KdfParallelism: 4,
      };

      const identityTokenResponse = new IdentityTokenResponse(response);
      expect(identityTokenResponse.kdfConfig).toBeInstanceOf(Argon2KdfConfig);
      const argon2Config = identityTokenResponse.kdfConfig as Argon2KdfConfig;
      expect(argon2Config.iterations).toEqual(3);
      expect(argon2Config.memory).toEqual(64);
      expect(argon2Config.parallelism).toEqual(4);
    });

    it("should throw when Kdf is absent or unrecognized", () => {
      const response = {
        access_token: accessToken,
        token_type: tokenType,
      };

      expect(() => new IdentityTokenResponse(response)).toThrow(
        "kdf is required on IdentityTokenResponse",
      );
    });
  });
});
